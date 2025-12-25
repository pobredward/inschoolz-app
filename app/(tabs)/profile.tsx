import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator, Linking, Animated } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { checkAttendance, UserAttendance } from '../../lib/attendance';
import { User } from '../../types';
import { getUserActivitySummary, getFollowersCount, getFollowingCount } from '../../lib/users';
import { getKoreanDateString } from '../../utils/timeUtils';
import { formatPhoneNumber } from '../../utils/formatters';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth} from '../../lib/firebase';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';
import FollowersModal from '../../components/FollowersModal';
import { SafeProfileImage } from '../../components/SafeProfileImage';
import { deleteAccount } from '../../lib/auth';
import { useRewardedAd } from '../../components/ads/AdMobAds';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuest } from '../../providers/QuestProvider';
import { useQuestTracker } from '../../hooks/useQuestTracker';

export default function ProfileScreen() {
  const { 
    user, 
    clearAuth, 
    isLoading: authLoading, 
    attendanceData, 
    loadAttendanceData, 
    performAttendanceCheck 
  } = useAuthStore();
  const { trackAction } = useQuest();
  const { trackDailyAttendance } = useQuestTracker();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [userStats, setUserStats] = useState({
    totalPosts: 0,
    totalComments: 0,
    totalLikes: 0,
    totalViews: 0,
    totalExperience: 0,
    level: 1,
    currentExp: 0,
    nextLevelXP: 10
  });

  // AuthStore의 user.stats가 변경될 때마다 로컬 userStats 동기화
  useEffect(() => {
    if (user?.stats) {
      setUserStats(prevStats => ({
        ...prevStats,
        level: user.stats.level || 1,
        currentExp: user.stats.currentExp || 0,
        nextLevelXP: user.stats.currentLevelRequiredXp || 10,
        totalExperience: user.stats.totalExperience || 0
      }));
    }
  }, [user?.stats?.level, user?.stats?.currentExp, user?.stats?.currentLevelRequiredXp, user?.stats?.totalExperience]);
  const [loading, setLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowersModalVisible, setIsFollowersModalVisible] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');
  
  // 애니메이션을 위한 Animated Value
  const shimmerAnim = useRef(new Animated.Value(0)).current;


  // 리워드 광고 제한 상태
  const [adWatchCount, setAdWatchCount] = useState(0);
  const [lastAdWatchTime, setLastAdWatchTime] = useState<number | null>(null);
  const [timeUntilNextAd, setTimeUntilNextAd] = useState(0);
  const [adSettings, setAdSettings] = useState({ experienceReward: 30, dailyLimit: 5, cooldownMinutes: 30 });

  // 광고 설정 로드
  useEffect(() => {
    const loadAdSettings = async () => {
      try {
        const { getSystemSettings } = await import('../../lib/experience');
        const settings = await getSystemSettings();
        setAdSettings({
          experienceReward: settings.ads.rewardedVideo.experienceReward,
          dailyLimit: settings.ads.rewardedVideo.dailyLimit,
          cooldownMinutes: settings.ads.rewardedVideo.cooldownMinutes
        });
      } catch (error) {
        console.error('광고 설정 로드 실패:', error);
      }
    };
    loadAdSettings();
  }, []);

  // 리워드 광고 완료 시 경험치 추가
  const handleRewardEarned = async (reward: any) => {
    if (!user?.uid) return;
    
    console.log('🔍 === AdMob 리워드 디버깅 시작 ===');
    console.log('🔍 현재 adSettings:', adSettings);
    console.log('🔍 adSettings.experienceReward:', adSettings.experienceReward);
    console.log('🔍 AdMob reward 객체:', reward);
    console.log('🔍 AdMob reward.amount:', reward?.amount);
    console.log('🔍 AdMob reward.type:', reward?.type);
    
    // AdMob에서 전달한 값과 설정값 비교
    const admobAmount = reward?.amount;
    const settingsAmount = adSettings.experienceReward;
    console.log('🔍 값 비교 - AdMob:', admobAmount, 'vs Settings:', settingsAmount);
    
    // 실제 사용할 경험치 값 결정
    const experienceToAward = settingsAmount; // 설정값 우선 사용
    console.log('🔍 실제 지급할 경험치:', experienceToAward);
    
    try {
      // 경험치 추가 - 리워드 광고는 amount 매개변수로 직접 전달
      const { awardExperience } = await import('../../lib/experience');
      const result = await awardExperience(user.uid, 'attendance', experienceToAward);
      console.log('🔍 경험치 지급 결과:', result);
      console.log('🔍 === AdMob 리워드 디버깅 종료 ===');
      
      // 광고 시청 데이터 업데이트
      const now = Date.now();
      const newCount = adWatchCount + 1;
      setAdWatchCount(newCount);
      setLastAdWatchTime(now);
      await saveAdWatchData(newCount, now);
      
      // 사용자 데이터 새로고침
      await loadData();
      
      const remainingAds = adSettings.dailyLimit - newCount;
      Alert.alert(
        '🎉 보상 획득!', 
        `경험치 +${experienceToAward}을 받았습니다!\n\n오늘 남은 광고 시청 횟수: ${remainingAds}회`
      );
    } catch (error) {
      console.error('경험치 추가 오류:', error);
      Alert.alert('오류', '보상 지급 중 오류가 발생했습니다.');
    }
  };

  const { showRewardedAd, isLoaded, isLoading, loadAttempts, loadingTime } = useRewardedAd(handleRewardEarned);

  // Firebase에서 광고 시청 데이터 로드
  const loadAdWatchData = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const adWatchRef = doc(db, 'users', user.uid, 'adWatchData', today);
      const adWatchSnap = await getDoc(adWatchRef);
      
      if (adWatchSnap.exists()) {
        const data = adWatchSnap.data();
        setAdWatchCount(data.count || 0);
        setLastAdWatchTime(data.lastWatchTime || null);
      } else {
        setAdWatchCount(0);
        setLastAdWatchTime(null);
      }
    } catch (error) {
      console.error('Firebase 광고 데이터 로드 오류:', error);
    }
  }, [user?.uid]);

  // Firebase에 광고 시청 데이터 저장
  const saveAdWatchData = async (count: number, watchTime: number) => {
    if (!user?.uid) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const adWatchRef = doc(db, 'users', user.uid, 'adWatchData', today);
      
      const adWatchData = {
        count,
        lastWatchTime: watchTime,
        date: today,
        updatedAt: new Date()
      };
      
      // Firebase에 저장
      await setDoc(adWatchRef, adWatchData, { merge: true });
    } catch (error) {
      console.error('Firebase 광고 데이터 저장 오류:', error);
    }
  };

  // 다음 광고까지 남은 시간 계산
  const calculateTimeUntilNextAd = useCallback(() => {
    if (!lastAdWatchTime) return 0;
    
    const now = Date.now();
    const timeSinceLastAd = now - lastAdWatchTime;
    const cooldownMs = adSettings.cooldownMinutes * 60 * 1000;
    
    return Math.max(0, cooldownMs - timeSinceLastAd);
  }, [lastAdWatchTime, adSettings.cooldownMinutes]);

  // 광고 시청 가능 여부 확인
  const canWatchAd = () => {
    if (adWatchCount >= adSettings.dailyLimit) return false;
    if (!lastAdWatchTime) return true;
    
    return calculateTimeUntilNextAd() === 0;
  };

  // 시간을 분 단위로만 포맷 (초는 표시하지 않음)
  const formatTime = (milliseconds: number) => {
    const totalMinutes = Math.ceil(milliseconds / (1000 * 60)); // 올림 처리로 더 정확한 표시
    if (totalMinutes === 0) {
      return '1분 미만';
    }
    return `${totalMinutes}분`;
  };


  // 리워드 광고 시청
  const handleWatchRewardedAd = () => {
    if (!user?.uid) {
      Alert.alert('로그인 필요', '광고를 시청하려면 로그인해주세요.');
      return;
    }

    // 클릭 시 로딩 방식에서는 Alert 대신 바로 로딩 시작
    if (!isLoaded && !isLoading) {
      // 광고 로딩을 시작하고 사용자에게 피드백 제공
      console.log('광고 로딩을 시작합니다...');
    }

    // 일일 제한 확인
    if (adWatchCount >= adSettings.dailyLimit) {
      Alert.alert(
        '일일 제한 도달', 
        `오늘은 더 이상 광고를 시청할 수 없습니다.\n\n일일 제한: ${adSettings.dailyLimit}회\n내일 다시 시도해주세요!`
      );
      return;
    }

    // 쿨다운 확인
    if (!canWatchAd()) {
      const timeLeft = formatTime(timeUntilNextAd);
      Alert.alert(
        '⏰ 잠시 기다려주세요', 
        `다음 광고 시청까지 ${timeLeft} 남았습니다.\n\n• 광고 시청 시간: 1분\n• 광고 간격: ${adSettings.cooldownMinutes}분\n• 최적의 수익을 위한 제한입니다.`
      );
      return;
    }

    const remainingAds = adSettings.dailyLimit - adWatchCount;
    Alert.alert(
      '🎁 광고 시청하기',
      `1분 광고를 시청하면 경험치 +${adSettings.experienceReward}을 받을 수 있습니다!\n\n오늘 남은 횟수: ${remainingAds}회\n다음 광고까지: ${adSettings.cooldownMinutes}분 간격`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '시청하기', 
          onPress: () => {
            showRewardedAd();
          }
        }
      ]
    );
  };

  // 타이머 업데이트 - 분 단위 표시이므로 30초마다 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilNextAd(calculateTimeUntilNextAd());
    }, 30000); // 30초마다 업데이트 (분 단위 표시에 충분)

    return () => clearInterval(interval);
  }, [lastAdWatchTime, calculateTimeUntilNextAd]);

  // 광고 시청 데이터 로드
  useEffect(() => {
    if (user?.uid) {
      loadAdWatchData();
    }
  }, [user?.uid, loadAdWatchData]);

  // Shimmer 애니메이션 효과
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      console.log('로그인되지 않아 프로필 데이터 로드를 건너뜁니다.');
      return;
    }

    try {
      setLoading(true);
      
      // 사용자 데이터 직접 로드 (안전한 접근)
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as User;
        setUserData(data);
      } else {
        console.warn('사용자 문서가 존재하지 않습니다:', user.uid);
      }

      // 출석 데이터 로드 (오류 처리 강화) - authStore의 전역 상태 사용
      try {
        await loadAttendanceData(user.uid);
      } catch (attendanceError) {
        console.error('출석 데이터 로드 오류:', attendanceError);
        // 출석 데이터 로드 실패는 전체 로딩을 방해하지 않음
      }

      // 사용자 활동 통계 로드 (오류 처리 강화)
      try {
        const stats = await getUserActivitySummary(user.uid);
        setUserStats(stats);
      } catch (statsError) {
        console.error('활동 통계 로드 오류:', statsError);
        // 기본값 유지
      }


      // 팔로워/팔로잉 수 로드 (오류 처리 강화)
      try {
        const [followersNum, followingNum] = await Promise.all([
          getFollowersCount(user.uid),
          getFollowingCount(user.uid)
        ]);
        setFollowersCount(followersNum);
        setFollowingCount(followingNum);
      } catch (followError) {
        console.error('팔로워/팔로잉 수 로드 오류:', followError);
        // 기본값 0 유지
      }

    } catch (error) {
      console.error('데이터 로드 오류:', error);
      // 사용자에게 오류 알림
      Alert.alert('오류', '데이터를 불러오는 중 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, loadAttendanceData]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        loadData();
      }
      // 로그인하지 않은 경우 리디렉션 제거 - 대신 UI에서 처리
    }
  }, [user, authLoading, loadData]);

  const onRefresh = async () => {
    if (!user?.uid) return;
    
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('새로고침 오류:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAttendanceCheck = async () => {
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (attendanceData?.checkedToday) {
      Alert.alert('출석체크', '오늘은 이미 출석체크를 완료했습니다!');
      return;
    }

    try {
      setLoading(true);
      const result = await performAttendanceCheck(user.uid);

      // 퀘스트 트래킹: 출석체크 (8단계, 10단계)
      try {
        // trackDailyAttendance 함수를 사용하여 일관성 유지
        await trackDailyAttendance(result.streak);
        console.log('✅ 퀘스트 트래킹: 출석체크 완료', result.streak);
      } catch (questError) {
        console.error('❌ 퀘스트 트래킹 오류:', questError);
      }

      // 사용자 통계 다시 로드 (안전한 호출)
      try {
        const updatedStats = await getUserActivitySummary(user.uid);
        setUserStats(updatedStats);
      } catch (statsError) {
        console.warn('통계 업데이트 실패:', statsError);
        // 출석체크는 성공했으므로 통계 업데이트 실패는 무시
      }

      let message = `+${result.expGained || 10} XP를 획득했습니다! 🎉`;
      if (result.leveledUp) {
        message += `\n🎉 레벨업! Lv.${result.oldLevel} → Lv.${result.newLevel}`;
      }
      if (result.streak === 7) {
        message += `\n🔥 7일 연속 출석 달성! 보너스 +50 XP`;
      } else if (result.streak === 30) {
        message += `\n🔥 30일 연속 출석 달성! 보너스 +200 XP`;
      }

      Alert.alert('출석체크 완료!', message);
    } catch (error) {
      console.error('출석체크 오류:', error);
      Alert.alert('오류', '출석체크 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '로그아웃', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAuth();
              router.replace('/login');
            } catch (error) {
              console.error('로그아웃 오류:', error);
              Alert.alert(
                '오류',
                error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.'
              );
            }
          }
        },
      ]
    );
  };

  // 계정 삭제 처리
  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ 계정 삭제',
      '정말로 계정을 삭제하시겠습니까?\n\n삭제되는 정보:\n• 프로필 정보 (이름, 이메일, 전화번호 등)\n• 계정 설정 및 기록\n• 랭킹 및 경험치 정보\n\n유지되는 정보:\n• 작성한 게시글과 댓글 (작성자명은 "삭제된 계정"으로 변경)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            // 비밀번호 입력 프롬프트
            Alert.prompt(
              '비밀번호 확인',
              '계정 삭제를 위해 현재 비밀번호를 입력하세요.',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '삭제',
                  style: 'destructive',
                  onPress: async (password: string) => {
                    if (!password?.trim()) {
                      Alert.alert('오류', '비밀번호를 입력해주세요.');
                      return;
                    }

                    try {
                      if (!user) {
                        Alert.alert('오류', '로그인 정보를 찾을 수 없습니다.');
                        return;
                      }

                      // Firebase User 객체와 비밀번호로 계정 삭제
                      const firebaseUser = auth.currentUser;
                      if (!firebaseUser) {
                        Alert.alert('오류', '인증 정보를 찾을 수 없습니다.');
                        return;
                      }

                      await deleteAccount(firebaseUser, password);
                      Alert.alert('완료', '계정이 성공적으로 삭제되었습니다.');
                      
                      // 상태 초기화 및 로그인 화면으로 이동
                      clearAuth();
                      router.replace('/login');
                    } catch (error: any) {
                      console.error('계정 삭제 오류:', error);
                      Alert.alert('오류', error.message || '계정 삭제 중 오류가 발생했습니다.');
                    }
                  }
                }
              ],
              'secure-text'
            );
          }
        }
      ]
    );
  };

  // 웹 링크로 이동하는 함수
  const openWebLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('오류', '링크를 열 수 없습니다.');
      }
    } catch (error) {
      console.error('링크 열기 오류:', error);
      Alert.alert('오류', '링크를 여는 중 문제가 발생했습니다.');
    }
  };

  // 인증 로딩 중
  if (authLoading) {
    return (
      <SafeScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  // 로그인하지 않은 상태에서 로그인 안내 화면
  if (!user) {
    return (
      <SafeScreenContainer>
        <View style={styles.loginRequiredContainer}>
          <Text style={styles.loginRequiredIcon}>👤</Text>
          <Text style={styles.loginRequiredTitle}>로그인이 필요합니다</Text>
          <Text style={styles.loginRequiredSubtitle}>
            마이페이지를 보려면 로그인해주세요.
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </SafeScreenContainer>
    );
  }

  // 실제 출석 기록을 기반으로 주간 달력 생성 (안전한 처리)
  const generateWeeklyCalendar = () => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const weekDays = [];
    
    try {
      // 오늘 날짜 기준으로 이번 주 월요일부터 일요일까지 계산
      const today = new Date();
      const currentDay = today.getDay(); // 0(일) ~ 6(토)
      
      // 이번 주 월요일 찾기 (월요일을 주의 시작으로)
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // 일요일이면 -6, 그 외는 1-currentDay
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      
      // 월요일부터 일요일까지 7일 생성
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        // 한국 시간대 기준으로 날짜 문자열 생성
        const dateStr = getKoreanDateString(date);
        
        // 실제 출석 기록에서 해당 날짜 확인 (안전한 접근)
        const isChecked = attendanceData?.monthlyLog?.[dateStr] === true;
        
        // 오늘 날짜인지 확인
        const isToday = date.toDateString() === today.toDateString();
        
        weekDays.push({
          day: days[date.getDay()],
          date: date.getDate(),
          isChecked,
          isToday
        });
      }
    } catch (error) {
      console.error('주간 달력 생성 오류:', error);
      // 오류 발생 시 빈 배열 반환하거나 기본 달력 생성
      return [];
    }
    
    return weekDays;
  };

  const weeklyCalendar = generateWeeklyCalendar();

  return (
    <SafeScreenContainer
      scrollable={true}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 게이미파이 프로필 카드 */}
      <View style={styles.profileCard}>
        {/* 상단 그라디언트 헤더 */}
        <LinearGradient
          colors={['#10B981', '#059669', '#14B8A6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          {/* 빠른 액션 버튼들 */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/profile-edit')}
            >
              <Text style={styles.quickActionIcon}>✏️</Text>
              <Text style={styles.quickActionText}>수정</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/favorite-schools')}
            >
              <Text style={styles.quickActionIcon}>🏫</Text>
              <Text style={styles.quickActionText}>학교</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* 프로필 정보 영역 */}
        <View style={styles.profileContent}>
          {/* 아바타와 레벨 */}
          <View style={styles.profileImageWrapper}>
            <View style={styles.profileImageContainer}>
              <SafeProfileImage
                uri={user.profile?.profileImageUrl}
                size={96}
                style={styles.profileImage}
              />
            </View>
            <View style={styles.levelBadge}>
              <LinearGradient
                colors={['#FBBF24', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.levelBadgeGradient}
              >
                <Text style={styles.levelBadgeText}>Lv.{userStats.level}</Text>
              </LinearGradient>
            </View>
          </View>

          {/* 프로필 정보 */}
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user.profile?.userName || '익명'}</Text>
            <Text style={styles.userSchool}>
              🏫 {userData?.school?.name || '학교 미설정'}
            </Text>
            
            {/* 팔로워/팔로잉 - 게임 스타일 */}
            <View style={styles.followContainer}>
              <TouchableOpacity 
                style={styles.followCard}
                onPress={() => {
                  setFollowersModalType('followers');
                  setIsFollowersModalVisible(true);
                }}
              >
                <LinearGradient
                  colors={['#ECFDF5', '#D1FAE5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.followCardGradient}
                >
                  <Text style={styles.followLabel}>팔로워</Text>
                  <Text style={styles.followCount}>{followersCount}</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.followCard}
                onPress={() => {
                  setFollowersModalType('following');
                  setIsFollowersModalVisible(true);
                }}
              >
                <LinearGradient
                  colors={['#F0FDFA', '#CCFBF1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.followCardGradient}
                >
                  <Text style={styles.followLabel}>팔로잉</Text>
                  <Text style={styles.followCount}>{followingCount}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* 경험치 바 - 게임 스타일 */}
            <View style={styles.expContainer}>
              <View style={styles.expHeader}>
                <Text style={styles.expLabel}>⚡ 경험치</Text>
                <Text style={styles.expValue}>
                  {userStats.currentExp.toLocaleString()} / {userStats.nextLevelXP.toLocaleString()} XP
                </Text>
              </View>
              <View style={styles.expBarContainer}>
                <View style={styles.expBarBackground}>
                  <LinearGradient
                    colors={['#34D399', '#10B981', '#14B8A6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.expBarFill,
                      { width: `${Math.min((userStats.currentExp / userStats.nextLevelXP) * 100, 100)}%` }
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.shimmerOverlay,
                        {
                          transform: [{
                            translateX: shimmerAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-200, 200],
                            })
                          }]
                        }
                      ]}
                    />
                  </LinearGradient>
                </View>
              </View>
            </View>

            {/* 기본 정보 - 컴팩트하게 */}
            <View style={styles.basicInfoGrid}>
              <View style={styles.basicInfoColumn}>
                <View style={styles.basicInfoRow}>
                  <Text style={styles.basicInfoIcon}>👤</Text>
                  <Text style={styles.basicInfoText}>{userData?.profile?.realName || '미설정'}</Text>
                </View>
                <View style={styles.basicInfoRow}>
                  <Text style={styles.basicInfoIcon}>
                    {userData?.profile?.gender === 'male' ? '👨' : 
                     userData?.profile?.gender === 'female' ? '👩' : '🧑'}
                  </Text>
                  <Text style={styles.basicInfoText}>
                    {userData?.profile?.gender === 'male' ? '남성' : 
                     userData?.profile?.gender === 'female' ? '여성' :
                     userData?.profile?.gender === 'other' ? '기타' : '미설정'}
                  </Text>
                </View>
                <View style={styles.basicInfoRow}>
                  <Text style={styles.basicInfoIcon}>🎂</Text>
                  <Text style={styles.basicInfoText} numberOfLines={1}>
                    {userData?.profile?.birthYear 
                      ? `${userData.profile.birthYear}.${userData.profile.birthMonth}.${userData.profile.birthDay}` 
                      : '미설정'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.basicInfoColumn}>
                <View style={styles.basicInfoRow}>
                  <Text style={styles.basicInfoIcon}>📧</Text>
                  <Text style={styles.basicInfoText} numberOfLines={1}>{user.email || '미설정'}</Text>
                </View>
                <View style={styles.basicInfoRow}>
                  <Text style={styles.basicInfoIcon}>📱</Text>
                  <Text style={styles.basicInfoText}>{formatPhoneNumber(userData?.profile?.phoneNumber || '') || '미설정'}</Text>
                </View>
                <View style={styles.basicInfoRow}>
                  <Text style={styles.basicInfoIcon}>📍</Text>
                  <Text style={styles.basicInfoText} numberOfLines={1}>
                    {(() => {
                      const parts = [
                        userData?.regions?.sido,
                        userData?.regions?.sigungu
                      ].filter(Boolean);
                      return parts.length > 0 ? parts.join(' ') : '미설정';
                    })()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>


        {/* 출석체크 - 게임 스타일 */}
        <View style={styles.attendanceSection}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionHeader}
          >
            <View style={styles.attendanceHeader}>
              <Text style={styles.sectionTitle}>📅 출석체크</Text>
              <View style={styles.attendanceStats}>
                <Text style={styles.streakText}>
                  {attendanceData?.streak && attendanceData.streak > 0 
                    ? `🔥 ${attendanceData.streak}일`
                    : ''}
                </Text>
                <Text style={styles.totalText}>총 {attendanceData?.totalCount || 0}일</Text>
              </View>
            </View>
          </LinearGradient>
          
          <View style={styles.attendanceContent}>
            <TouchableOpacity
              style={[styles.attendanceButton]}
              onPress={handleAttendanceCheck}
              disabled={attendanceData?.checkedToday || loading}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={attendanceData?.checkedToday 
                  ? ['#f3f4f6', '#e5e7eb'] 
                  : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.attendanceButtonGradient}
              >
                <Text style={[
                  styles.attendanceButtonText,
                  attendanceData?.checkedToday && styles.attendanceButtonTextDisabled
                ]}>
                  {loading ? '처리 중...' : attendanceData?.checkedToday ? '✅ 출석 완료' : '출석체크'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* 주간 출석 달력 */}
            <View style={styles.weeklyCalendar}>
              <Text style={styles.calendarTitle}>이번 주 출석 현황 (월~일)</Text>
              <View style={styles.calendarGrid}>
                {weeklyCalendar.map((day, index) => (
                  <View key={index} style={styles.calendarDay}>
                    <Text style={[
                      styles.dayText,
                      day.isToday && styles.todayText
                    ]}>
                      {day.day}
                    </Text>
                    <View style={[
                      styles.dayCircle,
                      day.isChecked && styles.checkedDay,
                      day.isToday && !day.isChecked && styles.todayCircle
                    ]}>
                      <Text style={[
                        styles.dayNumber,
                        day.isChecked && styles.checkedDayNumber,
                        day.isToday && !day.isChecked && styles.todayNumber
                      ]}>
                        {day.date}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* 활동 통계 - 게임 스타일 */}
        <View style={styles.statsSection}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>📊 활동 통계</Text>
          </LinearGradient>
          
          <View style={styles.statsContent}>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/my-posts')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#ECFDF5', '#D1FAE5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statCardGradient}
              >
                <Text style={styles.statIcon}>📝</Text>
                <Text style={styles.statTitle}>내가 쓴 글</Text>
                <Text style={styles.statArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/my-comments')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#ECFDF5', '#D1FAE5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statCardGradient}
              >
                <Text style={styles.statIcon}>💬</Text>
                <Text style={styles.statTitle}>내 댓글</Text>
                <Text style={styles.statArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/my-scraps' as any)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#ECFDF5', '#D1FAE5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statCardGradient}
              >
                <Text style={styles.statIcon}>🔖</Text>
                <Text style={styles.statTitle}>스크랩한 글</Text>
                <Text style={styles.statArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>


        {/* 설정 - 게임 스타일 */}
        <View style={styles.menuSection}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>⚙️ 설정</Text>
          </LinearGradient>
          
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#ECFDF5', '#D1FAE5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.settingButtonGradient}
              >
                <Text style={styles.settingIcon}>🔔</Text>
                <Text style={styles.settingText}>알림 설정</Text>
                <Text style={styles.settingArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/my-reports')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#ECFDF5', '#D1FAE5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.settingButtonGradient}
              >
                <Text style={styles.settingIcon}>🚨</Text>
                <Text style={styles.settingText}>신고 기록</Text>
                <Text style={styles.settingArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/blocked-users')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#ECFDF5', '#D1FAE5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.settingButtonGradient}
              >
                <Text style={styles.settingIcon}>🚫</Text>
                <Text style={styles.settingText}>차단된 사용자</Text>
                <Text style={styles.settingArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#FEE2E2', '#FECACA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.settingButtonGradient}
              >
                <Text style={styles.settingIcon}>🗑️</Text>
                <Text style={[styles.settingText, styles.deleteText]}>계정 삭제</Text>
                <Text style={styles.settingArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* 정책 및 약관 섹션 - 게임 스타일 */}
        <View style={styles.policySection}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>📋 정책 및 약관</Text>
          </LinearGradient>
          
          <View style={styles.policyCard}>
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/about')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F9FAFB', '#F3F4F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.policyButtonGradient}
              >
                <Text style={styles.policyIcon}>ℹ️</Text>
                <Text style={styles.policyText}>회사소개</Text>
                <Text style={styles.policyArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/terms')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F9FAFB', '#F3F4F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.policyButtonGradient}
              >
                <Text style={styles.policyIcon}>📄</Text>
                <Text style={styles.policyText}>이용약관</Text>
                <Text style={styles.policyArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/privacy')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F9FAFB', '#F3F4F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.policyButtonGradient}
              >
                <Text style={styles.policyIcon}>🔒</Text>
                <Text style={styles.policyText}>개인정보처리방침</Text>
                <Text style={styles.policyArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/youth-protection')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F9FAFB', '#F3F4F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.policyButtonGradient}
              >
                <Text style={styles.policyIcon}>🛡️</Text>
                <Text style={styles.policyText}>청소년보호정책</Text>
                <Text style={styles.policyArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/help')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F9FAFB', '#F3F4F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.policyButtonGradient}
              >
                <Text style={styles.policyIcon}>❓</Text>
                <Text style={styles.policyText}>고객지원</Text>
                <Text style={styles.policyArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

      {/* 팔로워/팔로잉 모달 */}
      <FollowersModal
        visible={isFollowersModalVisible}
        onClose={() => setIsFollowersModalVisible(false)}
        userId={user.uid}
        type={followersModalType}
        title={followersModalType === 'followers' ? '팔로워' : '팔로잉'}
      />
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  // 게이미파이 프로필 카드
  profileCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  gradientHeader: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 80,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 12,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  profileContent: {
    marginTop: -60,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  profileImageWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    borderWidth: 4,
    borderColor: 'white',
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  profileImage: {
    // SafeProfileImage 컴포넌트가 크기를 관리
  },
  levelBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  levelBadgeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 4,
  },
  userSchool: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  followContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  followCard: {
    flex: 1,
    maxWidth: 140,
  },
  followCardGradient: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#D1FAE5',
    alignItems: 'center',
  },
  followLabel: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 4,
  },
  followCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#047857',
  },
  expContainer: {
    marginBottom: 16,
  },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  expValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#059669',
  },
  expBarContainer: {
    position: 'relative',
  },
  expBarBackground: {
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  expBarFill: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 200,
  },
  basicInfoGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  basicInfoColumn: {
    flex: 1,
    gap: 8,
  },
  basicInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  basicInfoIcon: {
    fontSize: 12,
  },
  basicInfoText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  // 출석체크 - 게임 스타일
  attendanceSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceStats: {
    alignItems: 'flex-end',
  },
  streakText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  totalText: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
  },
  attendanceContent: {
    padding: 12,
  },
  attendanceButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  attendanceButtonGradient: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  attendanceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  attendanceButtonTextDisabled: {
    color: '#6b7280',
  },
  weeklyCalendar: {
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: '14%', // 7일 달력이므로 각 요일 너비 계산
    alignItems: 'center',
    marginBottom: 8,
  },
  dayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  todayText: {
    color: '#10B981',
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  checkedDay: {
    backgroundColor: '#10B981',
  },
  todayCircle: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  checkedDayNumber: {
    color: 'white',
  },
  todayNumber: {
    color: '#10B981',
  },
  // 활동 통계 - 게임 스타일
  statsSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#D1FAE5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#047857',
  },
  statsContent: {
    padding: 12,
    gap: 12,
  },
  statCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#047857',
    flex: 1,
  },
  statArrow: {
    fontSize: 20,
    color: '#34D399',
    fontWeight: 'bold',
  },
  
  // 설정 - 게임 스타일
  menuSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  menuCard: {
    padding: 12,
    gap: 8,
  },
  settingButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: 12,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#047857',
    fontWeight: '600',
    flex: 1,
  },
  settingArrow: {
    fontSize: 20,
    color: '#34D399',
    fontWeight: 'bold',
  },
  deleteText: {
    color: '#DC2626',
  },
  loginRequiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  loginRequiredIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  loginRequiredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  loginRequiredSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 25,
  },
  loginButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // 정책 및 약관 - 게임 스타일
  policySection: {
    backgroundColor: 'white',
    margin: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  policyCard: {
    padding: 12,
    gap: 8,
  },
  policyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  policyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  policyIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  policyText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  policyArrow: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },

 }); 