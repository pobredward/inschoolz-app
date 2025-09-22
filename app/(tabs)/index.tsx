import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { checkAttendance, UserAttendance } from '../../lib/attendance';
import { getUserById } from '../../lib/users';
import { getMainSchool } from '../../lib/schools';
import { getUserGameStats } from '../../lib/games';
import { getPopularPostsForHome } from '../../lib/boards';
import { getRankingPreview } from '../../lib/ranking';
import { getTodayMeals } from '../../lib/meals';
import { School, Post, MealInfo } from '../../types';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncUserExperienceData } from '../../lib/experience';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import PostListItem from '../../components/PostListItem';
import { useRewardedAd } from '../../components/ads/AdMobAds';
import { Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PromoBanner from '../../components/PromoBanner';

// 시간 포맷팅 함수 - 유틸리티 함수 활용
import { formatSmartTime } from '../../utils/timeUtils';

// 랭킹 미리보기 타입
interface RankingPreview {
  national: any[];
  regional: any[];
  school: any[];
}

export default function HomeScreen() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [todayMeals, setTodayMeals] = useState<MealInfo[]>([]);
  // 리워드 광고 완료 시 경험치 추가
  const handleRewardEarned = async (reward: any) => {
    if (!user?.uid) return;
    
    console.log('🔍 === AdMob 리워드 디버깅 시작 (홈) ===');
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
      // 경험치 추가 로직 - 리워드 광고는 amount 매개변수로 직접 전달
      const { awardExperience } = await import('../../lib/experience');
      const expResult = await awardExperience(user.uid, 'attendance', experienceToAward);
      console.log('🔍 경험치 지급 결과:', expResult);
      console.log('🔍 === AdMob 리워드 디버깅 종료 (홈) ===');
      
      // 광고 시청 데이터 업데이트
      const now = Date.now();
      const newCount = adWatchCount + 1;
      setAdWatchCount(newCount);
      setLastAdWatchTime(now);
      await saveAdWatchData(newCount, now);
      
      // 사용자 데이터 새로고침
      await loadUserData();
      
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

  // Firebase에서 광고 시청 데이터 로드
  const loadAdWatchData = async () => {
    if (!user?.uid) return;
    
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const adWatchRef = doc(db, 'users', user.uid, 'adWatchData', today);
      const adWatchSnap = await getDoc(adWatchRef);
      
      if (adWatchSnap.exists()) {
        const data = adWatchSnap.data();
        setAdWatchCount(data.count || 0);
        setLastAdWatchTime(data.lastWatchTime || null);
      } else {
        // 오늘 첫 접속 시 초기화
        setAdWatchCount(0);
        setLastAdWatchTime(null);
      }
      
      // 로컬 백업도 저장
      const adDataKey = `adWatch_${user.uid}_${today}`;
      const backupData = {
        count: adWatchCount,
        lastWatchTime: lastAdWatchTime
      };
      await AsyncStorage.setItem(adDataKey, JSON.stringify(backupData));
    } catch (error) {
      console.error('Firebase 광고 데이터 로드 오류:', error);
      // Firebase 실패 시 로컬 데이터 사용
      await loadLocalAdWatchData();
    }
  };

  // 로컬 백업 데이터 로드 (Firebase 실패 시)
  const loadLocalAdWatchData = async () => {
    if (!user?.uid) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const adDataKey = `adWatch_${user.uid}_${today}`;
      const adData = await AsyncStorage.getItem(adDataKey);
      
      if (adData) {
        const { count, lastWatchTime } = JSON.parse(adData);
        setAdWatchCount(count || 0);
        setLastAdWatchTime(lastWatchTime || null);
      }
    } catch (error) {
      console.error('로컬 광고 데이터 로드 오류:', error);
    }
  };

  // Firebase에 광고 시청 데이터 저장
  const saveAdWatchData = async (count: number, watchTime: number) => {
    if (!user?.uid) return;
    
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const adWatchRef = doc(db, 'users', user.uid, 'adWatchData', today);
      
      const adWatchData = {
        count,
        lastWatchTime: watchTime,
        date: today,
        updatedAt: Timestamp.now()
      };
      
      // Firebase에 저장
      await setDoc(adWatchRef, adWatchData, { merge: true });
      
      // 로컬 백업도 저장
      const adDataKey = `adWatch_${user.uid}_${today}`;
      await AsyncStorage.setItem(adDataKey, JSON.stringify({
        count,
        lastWatchTime: watchTime
      }));
      
      console.log('광고 시청 데이터 Firebase 저장 완료:', { count, date: today });
    } catch (error) {
      console.error('Firebase 광고 데이터 저장 오류:', error);
      // Firebase 실패 시에도 로컬에는 저장
      try {
        const today = new Date().toISOString().split('T')[0];
        const adDataKey = `adWatch_${user.uid}_${today}`;
        await AsyncStorage.setItem(adDataKey, JSON.stringify({
          count,
          lastWatchTime: watchTime
        }));
      } catch (localError) {
        console.error('로컬 광고 데이터 저장도 실패:', localError);
      }
    }
  };

  // 다음 광고까지 남은 시간 계산
  const calculateTimeUntilNextAd = () => {
    if (!lastAdWatchTime) return 0;
    
    const now = Date.now();
    const timeSinceLastAd = now - lastAdWatchTime;
    const cooldownMs = adSettings.cooldownMinutes * 60 * 1000;
    
    return Math.max(0, cooldownMs - timeSinceLastAd);
  };

  // 광고 시청 가능 여부 확인
  const canWatchAd = () => {
    if (adWatchCount >= adSettings.dailyLimit) return false;
    if (!lastAdWatchTime) return true;
    
    return calculateTimeUntilNextAd() === 0;
  };
  const [userData, setUserData] = useState<any>(null);
  const [attendance, setAttendance] = useState<UserAttendance | null>(null);
  const [isCheckingAttendance, setIsCheckingAttendance] = useState(false);
  const [mainSchool, setMainSchool] = useState<any>(null); // School type 제거
  const [gameStats, setGameStats] = useState<{
    bestReactionTimes: { [key: string]: number | null };
    todayPlays: { [key: string]: number };
    maxPlays?: number;
  }>({
    bestReactionTimes: { reactionGame: null, tileGame: null },
    todayPlays: { reactionGame: 0, tileGame: 0 },
    maxPlays: 5
  });
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const [rankingPreview, setRankingPreview] = useState<RankingPreview | null>(null);
  const [loading, setLoading] = useState(false);


  // 경험치 진행률 계산
  const expProgress = React.useMemo(() => {
    if (!user?.stats) return { current: 0, required: 10, percentage: 0 };
    
    const current = user.stats.currentExp || 0;
    const level = user.stats.level || 1;
    const required = level * 10; // 1->2레벨: 10XP, 2->3레벨: 20XP
    const percentage = Math.min((current / required) * 100, 100);
    
    return { current, required, percentage };
  }, [user?.stats]);

  // 타이머 업데이트 - 분 단위 표시이므로 30초마다 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilNextAd(calculateTimeUntilNextAd());
    }, 30000); // 30초마다 업데이트 (분 단위 표시에 충분)

    return () => clearInterval(interval);
  }, [lastAdWatchTime]);

  // 광고 시청 데이터 로드
  useEffect(() => {
    if (user?.uid) {
      loadAdWatchData();
    }
  }, [user?.uid]);

  // 사용자 데이터 및 출석 정보 로드 - 성능 최적화
  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // 인기 게시글을 먼저 로드하여 빠른 UI 표시
      const posts = await getPopularPostsForHome(2);
      setPopularPosts(posts);
      
      // 로그인된 경우에만 개인 데이터 로드
      if (user?.uid) {
        // 백그라운드에서 비동기 병렬 처리로 성능 개선
        Promise.all([
          // 경험치 데이터 동기화 (백그라운드)
          syncUserExperienceData(user.uid).catch(error => {
            console.error('경험치 동기화 실패 (백그라운드):', error);
          }),
          
          // 출석 정보 로드
          checkAttendance(user.uid).then(attendanceInfo => {
            setAttendance(attendanceInfo);
          }).catch(error => {
            console.error('출석 정보 로드 실패:', error);
          }),
          
          // 게임 통계 로드
          getUserGameStats(user.uid).then(gameStatsResponse => {
            if (gameStatsResponse.success && gameStatsResponse.data) {
              setGameStats({
                bestReactionTimes: gameStatsResponse.data.bestReactionTimes,
                todayPlays: gameStatsResponse.data.todayPlays,
                maxPlays: gameStatsResponse.data.maxPlays
              });
            }
          }).catch(error => {
            console.error('게임 통계 로드 실패:', error);
          }),

          // 급식 정보 로드
          user.school?.id ? getTodayMeals(user.school.id).then(mealsResponse => {
            if (mealsResponse.success) {
              setTodayMeals(mealsResponse.data);
            }
          }).catch(error => {
            console.error('급식 정보 로드 실패:', error);
          }) : Promise.resolve()
        ]);
        
        // TODO: 추후 다른 데이터들도 로드 구현
        // const mainSchoolInfo = await getMainSchool(user.uid);
        // const rankings = await getRankingPreview(user.uid, user.school?.id, user.regions?.sido, user.regions?.sigungu);
        // setMainSchool(mainSchoolInfo);
        // setRankingPreview(rankings);
      }
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // Firebase 실시간 리스너는 AuthStore에서 중앙 관리됨
  // 로컬 상태는 AuthStore의 user 데이터를 직접 사용

  useEffect(() => {
    if (!authLoading) {
      loadUserData();
    }
  }, [user?.uid, authLoading]);

  const onRefresh = async () => {
    if (!user?.uid) return;
    
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleAttendanceCheck = async () => {
    if (!user?.uid || attendance?.checkedToday || isCheckingAttendance) return;
    
    setIsCheckingAttendance(true);
    try {
      const result = await checkAttendance(user.uid, true);
      setAttendance(result);
      
      if (result.checkedToday) {
        Alert.alert('출석 완료!', `경험치 +${result.expGained || 10}을 획득했습니다! 🎉`);
      }
    } catch (error) {
      console.error('출석 체크 오류:', error);
      Alert.alert('오류', '출석 체크 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingAttendance(false);
    }
  };

  // 시간을 분 단위로만 포맷 (초는 표시하지 않음)
  const formatTime = (milliseconds: number) => {
    const totalMinutes = Math.ceil(milliseconds / (1000 * 60)); // 올림 처리로 더 정확한 표시
    if (totalMinutes === 0) {
      return '1분 미만';
    }
    return `${totalMinutes}분`;
  };

  // 리워디드 광고 시청 후 경험치 보상
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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `${rank}위`;
    }
  };

  const navigateToPost = (post: Post) => {
    router.push(`/board/national/${post.boardCode}/${post.id}` as any);
  };

  const navigateToCommunity = (type: 'national' | 'regional' | 'school') => {
    // 커뮤니티 탭으로 이동하면서 특정 타입을 파라미터로 전달
    router.push(`/(tabs)/community?tab=${type}` as any);
  };

  const navigateToGame = (gameId: string) => {
    if (gameId === 'reaction') {
      router.push('/games/reaction' as any);
    } else if (gameId === 'tile') {
      router.push('/games/tile' as any);
    } else {
      Alert.alert('준비 중', '곧 출시될 예정입니다! 🚀');
    }
  };

  const navigateToRanking = () => {
    router.push('/(tabs)/ranking');
  };

  const navigateToLogin = () => {
    router.push('/login' as any);
  };

  // 인증 로딩 중
  if (authLoading) {
    return (
      <SafeScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>앱을 시작하는 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  // 로그인하지 않은 상태
  if (!user) {
    return (
      <SafeScreenContainer scrollable={true}>
        <View style={styles.header}>
          <Text style={styles.title}>📚 Inschoolz</Text>
          <Text style={styles.subtitle}>학생들을 위한 커뮤니티</Text>
        </View>

        <View style={styles.loginPrompt}>
          <Ionicons name="person-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.loginPromptTitle}>로그인이 필요합니다</Text>
          <Text style={styles.loginPromptDescription}>
            Inschoolz의 모든 기능을 이용하려면 로그인해주세요.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={navigateToLogin}>
            <Text style={styles.loginButtonText}>로그인하기</Text>
          </TouchableOpacity>
        </View>

        {/* 홍보 배너 (로그인 없는 상태) */}
        <PromoBanner 
          onPress={() => {
            // 배너 클릭 시 동작 (필요시 수정)
            console.log('홍보 배너 클릭됨 (로그인 없음)');
          }}
          dismissible={true}
          shouldShow={() => {
            // 인증 로딩이 끝난 상태에서 항상 표시 (로그인 여부와 무관)
            const shouldDisplay = !authLoading;
            console.log('🔍 배너 shouldShow 체크 (로그인 없음):', { authLoading, shouldDisplay });
            return shouldDisplay;
          }}
        />

        {/* 개발/테스트용: 배너 상태 리셋 버튼 (로그인 없는 상태) */}
        {__DEV__ && (
          <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#ff6b6b',
                padding: 10,
                borderRadius: 8,
                alignItems: 'center'
              }}
              onPress={async () => {
                try {
                  await AsyncStorage.removeItem('promo_banner_dismissed');
                  await AsyncStorage.removeItem('promo_banner_daily_dismissed');
                  console.log('🔄 배너 상태 리셋됨 - 새로고침하세요');
                  Alert.alert('배너 상태 리셋', '앱을 다시 시작하면 배너가 표시됩니다.');
                } catch (error) {
                  console.error('배너 상태 리셋 실패:', error);
                }
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>
                🔄 배너 상태 리셋 (개발용)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 로그인 없이도 볼 수 있는 컨텐츠 */}
        
        {/* 인기 게시글 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 인기 게시글</Text>
            <TouchableOpacity onPress={() => navigateToCommunity('national')}>
              <Text style={styles.moreButton}>더보기</Text>
            </TouchableOpacity>
          </View>
          
          {popularPosts.length > 0 ? (
            popularPosts.map((post, index) => (
              <PostListItem
                key={post.id}
                post={post}
                onPress={navigateToPost}
                typeBadgeText="전국"
                boardBadgeText={(post as any).boardName || post.boardCode}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>아직 인기 게시글이 없습니다</Text>
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 미니게임</Text>
          <View style={styles.gameGrid}>
            <TouchableOpacity 
              style={styles.gameCard}
              onPress={() => Alert.alert('로그인 필요', '게임을 플레이하려면 로그인해주세요.')}
            >
              <Text style={styles.gameIcon}>⚡</Text>
              <Text style={styles.gameTitle}>반응속도</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.gameCard}
              onPress={() => Alert.alert('로그인 필요', '게임을 플레이하려면 로그인해주세요.')}
            >
              <Text style={styles.gameIcon}>🧩</Text>
              <Text style={styles.gameTitle}>타일 맞추기</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.gameCard}
              onPress={() => Alert.alert('준비 중', '곧 출시될 예정입니다! 🚀')}
            >
              <Text style={styles.gameIcon}>🧮</Text>
              <Text style={styles.gameTitle}>빠른 계산</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 커뮤니티</Text>
          <View style={styles.communityGrid}>
            <TouchableOpacity 
              style={styles.communityCard}
              onPress={() => navigateToCommunity('national')}
            >
              <Text style={styles.communityIcon}>🌍</Text>
              <Text style={styles.communityTitle}>전국</Text>
              <Text style={styles.communityDesc}>전국 학생들과 소통</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.communityCard}
              onPress={() => navigateToCommunity('regional')}
            >
              <Text style={styles.communityIcon}>🏘️</Text>
              <Text style={styles.communityTitle}>지역</Text>
              <Text style={styles.communityDesc}>로그인 후 이용</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.communityCard}
              onPress={() => navigateToCommunity('school')}
            >
              <Text style={styles.communityIcon}>🏫</Text>
              <Text style={styles.communityTitle}>학교</Text>
              <Text style={styles.communityDesc}>로그인 후 이용</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeScreenContainer>
    );
  }

  // 로그인된 상태에서 데이터 로딩 중
  if (loading) {
    return (
      <SafeScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  // 로그인된 상태의 메인 화면
  return (
    <SafeScreenContainer 
      scrollable={true}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      // 성능 최적화를 위한 스크롤 옵션
      scrollEventThrottle={16}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>📚 Inschoolz</Text>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.profile?.userName || '익명'}</Text>
          <View style={styles.expSection}>
            <View style={styles.expBar}>
              <View style={styles.expBarBackground}>
                <View style={[styles.expBarFill, { width: `${expProgress.percentage}%` }]} />
              </View>
              <Text style={styles.expText}>
                Lv.{user.stats?.level || 1} ({expProgress.current}/{expProgress.required})
              </Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.rewardedAdButton,
                { 
                  backgroundColor: canWatchAd() && isLoaded ? '#f59e0b' : 
                                  canWatchAd() && isLoading ? '#fbbf24' : '#9ca3af',
                  opacity: canWatchAd() ? 1 : 0.7
                }
              ]}
              onPress={handleWatchRewardedAd}
              disabled={!canWatchAd()}
            >
              <Text style={styles.rewardedAdButtonText}>
                {adWatchCount >= adSettings.dailyLimit 
                  ? '🚫 일일 제한' 
                  : !canWatchAd() 
                    ? `⏰ ${formatTime(timeUntilNextAd)}`
                    : isLoading 
                      ? `⏳ 잠시만 기다려주세요... (${loadingTime}초, ${loadAttempts}/3)`
                      : isLoaded
                        ? `🎁 +${adSettings.experienceReward} XP`
                        : `🎁 +${adSettings.experienceReward} XP`
                }
              </Text>
              {canWatchAd() && adWatchCount < adSettings.dailyLimit && (
                <Text style={styles.rewardedAdSubText}>
                  {isLoaded ? '✅ 준비됨! 1분 시청 후 보상' : 
                   isLoading ? `⏳ 광고 로딩 중... 잠시만 대기해주세요 (${loadingTime}초 경과, ${loadAttempts}/3 시도)` : '👆 클릭하여 시청하기 (1분 후 보상)'} • {adSettings.dailyLimit - adWatchCount}회 남음
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 홍보 배너 */}
      <PromoBanner 
        onPress={() => {
          // 배너 클릭 시 동작 (필요시 수정)
          console.log('홍보 배너 클릭됨');
        }}
        dismissible={true}
        shouldShow={() => {
          // 인증 로딩이 끝난 상태에서 항상 표시 (로그인 여부와 무관)
          const shouldDisplay = !authLoading;
          console.log('🔍 배너 shouldShow 체크:', { user: !!user, authLoading, shouldDisplay });
          return shouldDisplay;
        }}
      />

      {/* 개발/테스트용: 배너 상태 리셋 버튼 */}
      {__DEV__ && (
        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#ff6b6b',
              padding: 10,
              borderRadius: 8,
              alignItems: 'center'
            }}
            onPress={async () => {
              try {
                await AsyncStorage.removeItem('promo_banner_dismissed');
                console.log('🔄 배너 상태 리셋됨 - 새로고침하세요');
                Alert.alert('배너 상태 리셋', '앱을 다시 시작하면 배너가 표시됩니다.');
              } catch (error) {
                console.error('배너 상태 리셋 실패:', error);
              }
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              🔄 배너 상태 리셋 (개발용)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 출석 체크 */}
      <View style={styles.section}>
        <View style={styles.attendanceCard}>
          <Text style={styles.attendanceTitle}>📅 출석 체크</Text>
          {attendance?.checkedToday ? (
            <Text style={styles.attendanceDesc}>
              오늘 출석 완료! 연속 {attendance.streak}일째 출석 중! 🔥
            </Text>
          ) : (
            <Text style={styles.attendanceDesc}>
              {attendance?.streak ? `연속 ${attendance.streak}일째 출석 중!` : '출석체크로 경험치를 받으세요!'}
            </Text>
          )}
          <TouchableOpacity 
            style={[
              styles.attendanceButton,
              { 
                backgroundColor: attendance?.checkedToday ? '#10b981' : '#2563eb',
                opacity: isCheckingAttendance ? 0.7 : 1
              }
            ]}
            onPress={handleAttendanceCheck}
            disabled={attendance?.checkedToday || isCheckingAttendance}
          >
            <Text style={styles.attendanceButtonText}>
              {isCheckingAttendance 
                ? '처리중...' 
                : attendance?.checkedToday 
                  ? '✅ 출석 완료' 
                  : '출석 체크하기 (+10 XP)'
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 인기 게시글 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔥 인기 게시글</Text>
          <TouchableOpacity onPress={() => navigateToCommunity('national')}>
            <Text style={styles.moreButton}>더보기</Text>
          </TouchableOpacity>
        </View>
        
        {popularPosts.length > 0 ? (
          popularPosts.map((post, index) => (
            <PostListItem
              key={post.id}
              post={post}
              onPress={navigateToPost}
              typeBadgeText="전국"
              boardBadgeText={(post as any).boardName || post.boardCode}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>아직 인기 게시글이 없습니다</Text>
          </View>
        )}
      </View>

      {/* 급식 정보 */}
      {user?.school?.id && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🍽️ 오늘의 급식</Text>
            <TouchableOpacity 
              onPress={() => router.push('/meals')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>전체보기</Text>
              <Ionicons name="chevron-forward" size={16} color="#22c55e" />
            </TouchableOpacity>
          </View>
          
          {todayMeals.length > 0 ? (
            <View style={styles.mealsContainer}>
              {todayMeals.map((meal, index) => (
                <TouchableOpacity 
                  key={meal.id}
                  style={[styles.mealCard, index > 0 && styles.mealCardMargin]}
                  onPress={() => router.push('/meals')}
                >
                  <View style={styles.mealCardContent}>
                    <View style={styles.mealHeader}>
                      <View style={styles.mealTypeContainer}>
                        <Ionicons 
                          name={meal.mealType === 'breakfast' ? 'sunny-outline' : 
                                meal.mealType === 'lunch' ? 'restaurant-outline' : 'moon-outline'} 
                          size={20} 
                          color="#22c55e" 
                        />
                        <Text style={styles.mealType}>
                          {meal.mealType === 'breakfast' ? '조식' : 
                           meal.mealType === 'lunch' ? '중식' : '석식'}
                        </Text>
                      </View>
                      {meal.calories && (
                        <View style={styles.caloriesContainer}>
                          <Ionicons name="flash-outline" size={14} color="#6B7280" />
                          <Text style={styles.calories}>{meal.calories}</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.menuContainer}>
                      {meal.menu.map((menuItem, menuIndex) => (
                        <View key={menuIndex} style={styles.menuItem}>
                          <View style={styles.bulletPoint} />
                          <Text style={styles.menuText}>{menuItem}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.mealCard}
              onPress={() => router.push('/meals')}
            >
              <View style={styles.mealCardContent}>
                <Ionicons name="restaurant-outline" size={24} color="#22c55e" />
                <View style={styles.mealTextContent}>
                  <Text style={styles.mealTitle}>{user.school.name} 급식</Text>
                  <Text style={styles.mealSubtitle}>오늘의 메뉴를 확인해보세요</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 미니게임 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎮 미니게임</Text>
        <View style={styles.gameGrid}>
          <TouchableOpacity 
            style={styles.gameCard}
            onPress={() => navigateToGame('reaction')}
          >
            <Text style={styles.gameIcon}>⚡</Text>
            <Text style={styles.gameTitle}>반응속도</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.gameCard}
            onPress={() => navigateToGame('tile')}
          >
            <Text style={styles.gameIcon}>🧩</Text>
            <Text style={styles.gameTitle}>타일 맞추기</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gameCard}
            onPress={() => Alert.alert('준비 중', '곧 출시될 예정입니다! 🚀')}
          >
            <Text style={styles.gameIcon}>🧮</Text>
            <Text style={styles.gameTitle}>빠른 계산</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 커뮤니티 바로가기 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 커뮤니티</Text>
        <View style={styles.communityGrid}>
          <TouchableOpacity 
            style={styles.communityCard}
            onPress={() => navigateToCommunity('national')}
          >
            <Text style={styles.communityIcon}>🌍</Text>
            <Text style={styles.communityTitle}>전국</Text>
            <Text style={styles.communityDesc}>전국 학생들과 소통</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.communityCard}
            onPress={() => navigateToCommunity('regional')}
          >
            <Text style={styles.communityIcon}>🏘️</Text>
            <Text style={styles.communityTitle}>지역</Text>
            <Text style={styles.communityDesc}>우리 지역 친구들과 소통</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.communityCard}
            onPress={() => navigateToCommunity('school')}
          >
            <Text style={styles.communityIcon}>🏫</Text>
            <Text style={styles.communityTitle}>학교</Text>
            <Text style={styles.communityDesc}>우리 학교만의 공간</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },

  header: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  userInfo: {
    marginTop: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  expSection: {
    marginTop: 8,
  },
  expBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  expBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  expBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  expText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  rewardedAdButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  rewardedAdButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rewardedAdSubText: {
    color: 'white',
    fontSize: 10,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  loginPrompt: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  loginPromptDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  moreButton: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  attendanceCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  attendanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  attendanceDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  attendanceButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  attendanceButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  popularPostsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postBadgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  postTypeBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803d',
    backgroundColor: '#f0fdf4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  postBoardBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  postDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  postPreview: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStatsLeft: {
    flex: 1,
  },
  postStatsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  postStatItem: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  communityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  communityCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  communityIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  communityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  communityDesc: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  rankingGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  rankingCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rankingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  rankingItem: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 8,
  },
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gameCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '31%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  gameCardDisabled: {
    opacity: 0.6,
  },
  gameIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  gameDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  gamePlayCount: {
    fontSize: 11,
    color: '#9ca3af',
  },
  // 급식 관련 스타일
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
  mealsContainer: {
    gap: 12,
  },
  mealCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mealCardMargin: {
    marginTop: 12,
  },
  mealCardContent: {
    gap: 12,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  calories: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  menuContainer: {
    gap: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletPoint: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22c55e',
    marginTop: 6,
  },
  menuText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  moreMenuText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  mealTextContent: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  mealSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});
