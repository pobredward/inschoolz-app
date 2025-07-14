import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, Image } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';
import { checkAttendance, UserAttendance } from '../../lib/attendance';
import { getUserActivitySummary, getUserById } from '../../lib/users';
import { getBookmarkedPostsCount } from '../../lib/boards';
// 기본 날짜 함수
const getKoreanDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();
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
  const [loading, setLoading] = useState(true);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  const loadData = async () => {
    if (!user?.uid) return;

    try {
      // 사용자 데이터 직접 로드
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }

      // 출석 데이터 로드
      const attendance = await checkAttendance(user.uid);
      setAttendanceData(attendance);

      // 사용자 활동 통계 로드
      const stats = await getUserActivitySummary(user.uid);
      setUserStats(stats);

      // 북마크 개수 로드
      const bookmarkCountResult = await getBookmarkedPostsCount(user.uid);
      setBookmarkCount(bookmarkCountResult);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAttendanceCheck = async () => {
    if (!user?.uid) return;

    if (attendanceData.checkedToday) {
      Alert.alert('출석체크', '오늘은 이미 출석체크를 완료했습니다!');
      return;
    }

    try {
      setLoading(true);
      const result = await checkAttendance(user.uid, true);
      
      setAttendanceData(result);

      // 사용자 통계 다시 로드
      const updatedStats = await getUserActivitySummary(user.uid);
      setUserStats(updatedStats);

      let message = `+${result.expGained} XP를 획득했습니다! 🎉`;
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

  const menuItems = [
    { icon: '📝', name: '내가 쓴 글', count: userStats.totalPosts, onPress: () => router.push('/my-posts' as any) },
    { icon: '💬', name: '내 댓글', count: userStats.totalComments, onPress: () => router.push('/my-comments' as any) },
    { icon: '❤️', name: '좋아요한 글', count: userStats.totalLikes, onPress: () => router.push('/my-likes' as any) },
    { icon: '🔖', name: '스크랩', count: bookmarkCount, onPress: () => router.push('/my-bookmarks' as any) },
  ];

  const settingItems = [
    { icon: '✏️', name: '프로필 수정', onPress: () => router.push('/profile-edit') },
    { icon: '🔔', name: '알림 설정', onPress: () => Alert.alert('준비중', '알림 설정 기능은 준비중입니다.') },
    { icon: '🏫', name: '즐겨찾기 학교', onPress: () => router.push('/favorite-schools') },
    { icon: '❓', name: '도움말', onPress: () => Alert.alert('준비중', '도움말 기능은 준비중입니다.') },
    { icon: '📞', name: '고객센터', onPress: () => Alert.alert('준비중', '고객센터 기능은 준비중입니다.') },
    { icon: '🚪', name: '로그아웃', onPress: handleSignOut, isLogout: true },
  ];

  // 경험치 바 계산
  const expPercentage = userStats.nextLevelXP > 0 ? 
    Math.min((userStats.currentExp / userStats.nextLevelXP) * 100, 100) : 0;

  // 실제 출석 기록을 기반으로 주간 달력 생성
  const generateWeeklyCalendar = () => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const weekDays = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // 한국 시간대 기준으로 날짜 문자열 생성
      const dateStr = getKoreanDateString(date);
      
      // 실제 출석 기록에서 해당 날짜 확인
      const isChecked = attendanceData.monthlyLog?.[dateStr] === true;
      
      weekDays.push({
        day: days[date.getDay()],
        date: date.getDate(),
        isChecked,
        isToday: i === 0
      });
    }
    
    return weekDays;
  };

  const weeklyCalendar = generateWeeklyCalendar();

  return (
    <SafeScreenContainer 
      scrollable={true}
      contentContainerStyle={{
        paddingHorizontal: 0, // 기본 패딩 제거
      }}
    >
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 프로필 헤더 */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {(userData?.profile?.profileImageUrl || user?.profile?.profileImageUrl) ? (
              <Image 
                source={{ uri: userData?.profile?.profileImageUrl || user?.profile?.profileImageUrl }} 
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {userData?.profile?.userName?.charAt(0) || user?.profile?.userName?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.{userStats.level}</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{userData?.profile?.userName || user?.profile?.userName || '사용자'}</Text>
            <Text style={styles.userSchool}>{userData?.school?.name || '학교 미설정'}</Text>
            <View style={styles.expSection}>
              <View style={styles.expBar}>
                <View style={[styles.expFill, { width: `${expPercentage}%` }]} />
              </View>
              <Text style={styles.expText}>{userStats.currentExp}/{userStats.nextLevelXP} XP</Text>
            </View>
          </View>
        </View>

        {/* 상세 정보 카드 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 내 정보</Text>
          <View style={styles.infoContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>이름:</Text>
              <Text style={styles.infoValue}>{userData?.profile?.realName || '미설정'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>성별:</Text>
              <Text style={styles.infoValue}>
                {userData?.profile?.gender === 'male' ? '남성' : 
                 userData?.profile?.gender === 'female' ? '여성' :
                 userData?.profile?.gender === 'other' ? '기타' : '미설정'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>생년월일:</Text>
              <Text style={styles.infoValue}>
                {userData?.profile?.birthYear 
                  ? `${userData.profile.birthYear}년 ${userData.profile.birthMonth}월 ${userData.profile.birthDay}일` 
                  : '미설정'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>이메일:</Text>
              <Text style={styles.infoValue}>{userData?.email || user?.email || '미설정'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>연락처:</Text>
              <Text style={styles.infoValue}>{userData?.profile?.phoneNumber || '미설정'}</Text>
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
          <View style={styles.weeklyCalendarContainer}>
            <Text style={styles.calendarTitle}>최근 7일 출석 현황</Text>
            <View style={styles.weeklyCalendar}>
              {weeklyCalendar.map((day, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.calendarDay,
                    { 
                      backgroundColor: day.isChecked ? '#10b981' : '#ffffff',
                      borderColor: day.isToday ? '#2563eb' : '#d1d5db',
                      borderWidth: day.isToday ? 2 : 1
                    }
                  ]}
                >
                  <Text style={[
                    styles.calendarDayText,
                    { 
                      color: day.isChecked ? '#ffffff' : '#000000',
                      textShadowColor: day.isChecked ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2
                    }
                  ]}>
                    {day.day}
                  </Text>
                  <Text style={[
                    styles.calendarDateText,
                    { 
                      color: day.isChecked ? '#ffffff' : '#000000',
                      textShadowColor: day.isChecked ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2
                    }
                  ]}>
                    {day.date}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* 출석 보상 안내 */}
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>🎁 출석 보상</Text>
            <View style={styles.rewardList}>
              <Text style={styles.rewardItem}>• 매일 출석: +10 XP</Text>
              <Text style={styles.rewardItem}>• 7일 연속: +50 XP 보너스</Text>
              <Text style={styles.rewardItem}>• 30일 연속: +200 XP 보너스</Text>
            </View>
          </View>
        </View>

        {/* 활동 통계 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 활동 통계</Text>
          <View style={styles.statsGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity key={index} style={styles.statItem} onPress={item.onPress}>
                <Text style={styles.statIcon}>{item.icon}</Text>
                <Text style={styles.statCount}>{item.count}</Text>
                <Text style={styles.statName}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 설정 메뉴 */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>⚙️ 설정</Text>
          <View style={styles.settingsMenu}>
            {settingItems.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.settingItem,
                  item.isLogout && styles.logoutItem
                ]} 
                onPress={item.onPress}
              >
                <Text style={[
                  styles.settingIcon,
                  item.isLogout && styles.logoutText
                ]}>
                  {item.icon}
                </Text>
                <Text style={[
                  styles.settingName,
                  item.isLogout && styles.logoutText
                ]}>
                  {item.name}
                </Text>
                <Text style={[
                  styles.settingArrow,
                  item.isLogout && styles.logoutText
                ]}>
                  {item.isLogout ? '' : '›'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 앱 정보 */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>InSchoolz v1.0.0</Text>
          <Text style={styles.appInfoText}>© 2024 InSchoolz. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
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
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'white',
  },
  levelText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userSchool: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  expSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  expFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  expText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoCard: {
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
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  infoContent: {
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
  weeklyCalendarContainer: {
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  weeklyCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  calendarDateText: {
    fontSize: 10,
    marginTop: 4,
  },
  rewardInfo: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  rewardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  rewardList: {
    gap: 4,
  },
  rewardItem: {
    fontSize: 12,
    color: '#065f46',
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
  statItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statName: {
    fontSize: 12,
    color: '#6b7280',
  },
  activitySection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
  },
  activityIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  activityName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  activityCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  settingsSection: {
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
  settingsMenu: {
    gap: 8,
  },
  settingItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutItem: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  settingName: {
    fontSize: 16,
  },
  logoutText: {
    color: '#ef4444',
  },
  settingArrow: {
    fontSize: 18,
    color: '#9ca3af',
  },
  appInfo: {
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
  appInfoText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
}); 