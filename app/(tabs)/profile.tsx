import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { checkAttendance, UserAttendance } from '../../lib/attendance';
import { getUserActivitySummary, getFollowersCount, getFollowingCount } from '../../lib/users';
import { getScrappedPostsCount } from '../../lib/boards';
import { getKoreanDateString } from '../../utils/timeUtils';
import { Ionicons } from '@expo/vector-icons';
import { formatPhoneNumber } from '../../utils/formatters';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth} from '../../lib/firebase';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';
import FollowersModal from '../../components/FollowersModal';
import { deleteAccount } from '../../lib/auth';

export default function ProfileScreen() {
  const { user, clearAuth, isLoading: authLoading } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<UserAttendance>({
    checkedToday: false,
    streak: 0,
    totalCount: 0,
    monthCount: 0,
    monthlyLog: {}
  });
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
  const [loading, setLoading] = useState(false);
  const [scrapCount, setScrapCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowersModalVisible, setIsFollowersModalVisible] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');

  const loadData = async () => {
    if (!user?.uid) {
      console.log('로그인되지 않아 프로필 데이터 로드를 건너뜁니다.');
      return;
    }

    try {
      setLoading(true);
      
      // 사용자 데이터 직접 로드 (안전한 접근)
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
      } else {
        console.warn('사용자 문서가 존재하지 않습니다:', user.uid);
      }

      // 출석 데이터 로드 (오류 처리 강화)
      try {
        const attendance = await checkAttendance(user.uid);
        setAttendanceData(attendance);
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

      // 스크랩 개수 로드 (오류 처리 강화)
      try {
        const scrapCountResult = await getScrappedPostsCount(user.uid);
        setScrapCount(scrapCountResult);
      } catch (scrapError) {
        console.error('스크랩 개수 로드 오류:', scrapError);
        // 기본값 0 유지
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
  };

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        loadData();
      }
      // 로그인하지 않은 경우 리디렉션 제거 - 대신 UI에서 처리
    }
  }, [user?.uid, authLoading]);

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

    if (attendanceData.checkedToday) {
      Alert.alert('출석체크', '오늘은 이미 출석체크를 완료했습니다!');
      return;
    }

    try {
      setLoading(true);
      const result = await checkAttendance(user.uid, true);
      
      setAttendanceData(result);

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
              router.replace('/auth');
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
                  onPress: async (password) => {
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
                      router.replace('/auth');
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
            onPress={() => router.push('/auth')}
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
    <SafeScreenContainer>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 프로필 헤더 */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            {user.profile?.profileImageUrl ? (
              <Image
                source={{ uri: user.profile.profileImageUrl }}
                style={styles.profileImage}
                onError={() => {
                  console.warn('프로필 이미지 로드 실패, 기본 아이콘 표시');
                }}
              />
            ) : (
              <Ionicons name="person-circle" size={80} color="#10B981" />
            )}
          </View>
          <Text style={styles.userName}>{user.profile?.userName || '익명'}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          
          {/* 레벨 및 경험치 */}
          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Lv.{userStats.level}</Text>
            <View style={styles.expBar}>
              <View style={styles.expBarBackground}>
                <View 
                  style={[
                    styles.expBarFill, 
                    { width: `${Math.min((userStats.currentExp / userStats.nextLevelXP) * 100, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.expText}>
                {userStats.currentExp}/{userStats.nextLevelXP} XP
              </Text>
            </View>
          </View>

          {/* 팔로워/팔로잉 정보 */}
          <View style={styles.followContainer}>
            <TouchableOpacity 
              style={styles.followButton}
              onPress={() => {
                setFollowersModalType('followers');
                setIsFollowersModalVisible(true);
              }}
            >
              <Text style={styles.followCount}>{followersCount}</Text>
              <Text style={styles.followLabel}>팔로워</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.followButton}
              onPress={() => {
                setFollowersModalType('following');
                setIsFollowersModalVisible(true);
              }}
            >
              <Text style={styles.followCount}>{followingCount}</Text>
              <Text style={styles.followLabel}>팔로잉</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 기본 정보 */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>📋 기본 정보</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>이름:</Text>
              <Text style={styles.infoValue}>{userData?.profile?.realName || '미설정'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>성별:</Text>
              <Text style={styles.infoValue}>{userData?.profile?.gender || '미설정'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>생년월일:</Text>
              <Text style={styles.infoValue}>
                {userData?.profile?.birthYear && userData?.profile?.birthMonth && userData?.profile?.birthDay
                  ? `${userData.profile.birthYear}년 ${userData.profile.birthMonth}월 ${userData.profile.birthDay}일`
                  : '미설정'
                }
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>연락처:</Text>
              <Text style={styles.infoValue}>
                {formatPhoneNumber(userData?.profile?.phoneNumber || '')}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>학교:</Text>
              <Text style={styles.infoValue}>{userData?.school?.name || '미설정'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>주소:</Text>
              <Text style={styles.infoValue}>
                {(() => {
                  const parts = [
                    userData?.regions?.sido,
                    userData?.regions?.sigungu, 
                    userData?.regions?.address
                  ].filter(Boolean);
                  return parts.length > 0 ? parts.join(' ') : '미설정';
                })()}
              </Text>
            </View>
          </View>
        </View>

        {/* 출석체크 */}
        <View style={styles.attendanceSection}>
          <View style={styles.attendanceHeader}>
            <Text style={styles.attendanceTitle}>📅 출석체크</Text>
            <View style={styles.attendanceStats}>
              <Text style={styles.streakText}>🔥 연속 {attendanceData.streak}일</Text>
              <Text style={styles.totalText}>총 {attendanceData.totalCount}일</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[
              styles.attendanceButton,
              attendanceData.checkedToday && styles.attendanceButtonDisabled
            ]}
            onPress={handleAttendanceCheck}
            disabled={attendanceData.checkedToday || loading}
          >
            <Text style={[
              styles.attendanceButtonText,
              attendanceData.checkedToday && styles.attendanceButtonTextDisabled
            ]}>
              {loading ? '처리 중...' : attendanceData.checkedToday ? '✅ 출석 완료' : '출석체크'}
            </Text>
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

        {/* 활동 통계 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 활동 통계</Text>
          <View style={styles.statsGrid}>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/my-posts')}
            >
              <Text style={styles.statIcon}>📝</Text>
              <Text style={styles.statLabel}>내가 쓴 글</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/my-comments')}
            >
              <Text style={styles.statIcon}>💬</Text>
              <Text style={styles.statLabel}>내 댓글</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/my-scraps' as any)}
            >
              <Text style={styles.statIcon}>🔖</Text>
              <Text style={styles.statLabel}>스크랩한 글</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 설정 */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>⚙️ 설정</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/profile-edit')}
            >
              <Text style={styles.settingIcon}>✏️</Text>
              <Text style={styles.settingText}>프로필 수정</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/notifications')}
            >
              <Text style={styles.settingIcon}>🔔</Text>
              <Text style={styles.settingText}>알림 설정</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/favorite-schools')}
            >
              <Text style={styles.settingIcon}>🏫</Text>
              <Text style={styles.settingText}>즐겨찾기 학교</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/my-reports')}
            >
              <Text style={styles.settingIcon}>🚨</Text>
              <Text style={styles.settingText}>신고 기록</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={() => router.push('/blocked-users')}
            >
              <Text style={styles.settingIcon}>🚫</Text>
              <Text style={styles.settingText}>차단된 사용자</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingButton}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.settingIcon}>🗑️</Text>
              <Text style={styles.settingText}>계정 삭제</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.settingButton, styles.signOutButton]}
              onPress={handleSignOut}
            >
              <Text style={styles.settingIcon}>🚪</Text>
              <Text style={[styles.settingText, styles.signOutText]}>로그아웃</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 정책 및 약관 섹션 */}
        <View style={styles.policySection}>
          <Text style={styles.sectionTitle}>📋 정책 및 약관</Text>
          <View style={styles.policyCard}>
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/about')}
            >
              <Text style={styles.policyIcon}>ℹ️</Text>
              <Text style={styles.policyText}>회사소개</Text>
              <Text style={styles.policyArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/terms')}
            >
              <Text style={styles.policyIcon}>📄</Text>
              <Text style={styles.policyText}>이용약관</Text>
              <Text style={styles.policyArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/privacy')}
            >
              <Text style={styles.policyIcon}>🔒</Text>
              <Text style={styles.policyText}>개인정보처리방침</Text>
              <Text style={styles.policyArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/youth-protection')}
            >
              <Text style={styles.policyIcon}>🛡️</Text>
              <Text style={styles.policyText}>청소년보호정책</Text>
              <Text style={styles.policyArrow}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.policyButton}
              onPress={() => openWebLink('https://www.inschoolz.com/help')}
            >
              <Text style={styles.policyIcon}>❓</Text>
              <Text style={styles.policyText}>고객지원</Text>
              <Text style={styles.policyArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
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
  profileHeader: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImageContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  levelContainer: {
    alignItems: 'center',
    width: '100%',
  },
  levelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
    textAlign: 'center',
  },
  expBar: {
    width: '100%',
    alignItems: 'center',
  },
  expBarBackground: {
    width: '100%',
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  expBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 5,
  },
  expText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  infoSection: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoCard: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  attendanceSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  attendanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  attendanceStats: {
    alignItems: 'flex-end',
  },
  streakText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 2,
  },
  totalText: {
    fontSize: 12,
    color: '#6b7280',
  },
  attendanceButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  attendanceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  attendanceButtonDisabled: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
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
  statsSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
  },
  menuSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuCard: {
    gap: 8,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  settingIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  settingArrow: {
    fontSize: 16,
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  signOutButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutText: {
    color: '#ef4444',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
    marginLeft: 12,
  },
  signOutItem: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
   sectionTitle: {
     fontSize: 18,
     fontWeight: 'bold',
     marginBottom: 12,
     color: '#111827',
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
  followContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 60,
  },
  followButton: {
    alignItems: 'center',
    padding: 8,
  },
  followCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  followLabel: {
    fontSize: 14,
    color: '#6B7280',
  },

   policySection: {
     backgroundColor: 'white',
     margin: 20,
     padding: 20,
     borderRadius: 12,
     shadowColor: '#000',
     shadowOffset: {
       width: 0,
       height: 2,
     },
     shadowOpacity: 0.1,
     shadowRadius: 3.84,
     elevation: 5,
   },
   policyCard: {
     gap: 8,
   },
   policyButton: {
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: '#f9fafb',
     borderRadius: 12,
     padding: 16,
     width: '100%',
   },
   policyIcon: {
     fontSize: 16,
     marginRight: 12,
   },
   policyText: {
     fontSize: 16,
     color: '#374151',
     flex: 1,
   },
   policyArrow: {
     fontSize: 16,
     color: '#9ca3af',
     marginLeft: 'auto',
   },
 }); 