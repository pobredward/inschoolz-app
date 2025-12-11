import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { usePostCacheStore } from '../../store/postCacheStore';
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
import { Timestamp } from 'firebase/firestore';
import { useQuestTracker } from '../../hooks/useQuestTracker';

// 시간 포맷팅 함수 - 유틸리티 함수 활용
import { formatSmartTime } from '../../utils/timeUtils';

// 랭킹 미리보기 타입
interface RankingPreview {
  national: any[];
  regional: any[];
  school: any[];
}

export default function HomeScreen() {
  const { 
    user, 
    isLoading: authLoading, 
    attendanceData, 
    loadAttendanceData, 
    performAttendanceCheck 
  } = useAuthStore();
  const { trackDailyAttendance } = useQuestTracker();
  const [refreshing, setRefreshing] = useState(false);
  const [todayMeals, setTodayMeals] = useState<MealInfo[]>([]);
  const [userData, setUserData] = useState<any>(null);
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
  
  // Shimmer 애니메이션
  const shimmerAnim = useRef(new Animated.Value(0)).current;


  // 경험치 진행률 계산 - user.stats의 개별 필드를 의존성으로 사용하여 실시간 업데이트 보장
  const expProgress = React.useMemo(() => {
    if (!user?.stats) return { current: 0, required: 10, percentage: 0 };
    
    const current = user.stats.currentExp || 0;
    const level = user.stats.level || 1;
    const required = user.stats.currentLevelRequiredXp || (level * 10); // currentLevelRequiredXp 사용
    const percentage = Math.min((current / required) * 100, 100);
    
    return { current, required, percentage };
  }, [user?.stats?.currentExp, user?.stats?.level, user?.stats?.currentLevelRequiredXp]);

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
          
          // 출석 정보 로드 - authStore의 전역 상태 사용
          loadAttendanceData(user.uid).catch(error => {
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

  const onRefresh = async () => {
    if (!user?.uid) return;
    
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleAttendanceCheck = async () => {
    if (!user?.uid || attendanceData?.checkedToday || isCheckingAttendance) return;
    
    setIsCheckingAttendance(true);
    try {
      const result = await performAttendanceCheck(user.uid);
      
      // 퀘스트 트래킹: 출석체크 (8단계, 10단계)
      try {
        await trackDailyAttendance(result.streak);
        console.log('✅ 퀘스트 트래킹: 출석체크 완료');
      } catch (questError) {
        console.error('❌ 퀘스트 트래킹 오류:', questError);
        // 출석체크는 성공했으므로 퀘스트 오류는 무시
      }
      
      if (result.checkedToday) {
        let message = `경험치 +${result.expGained || 10}을 획득했습니다! 🎉`;
        if (result.leveledUp) {
          message += `\n🎉 레벨업! Lv.${result.oldLevel} → Lv.${result.newLevel}`;
        }
        if (result.streak === 7) {
          message += `\n🔥 7일 연속 출석 달성! 보너스 +50 XP`;
        } else if (result.streak === 30) {
          message += `\n🔥 30일 연속 출석 달성! 보너스 +200 XP`;
        }
        Alert.alert('출석 완료!', message);
      }
    } catch (error) {
      console.error('출석 체크 오류:', error);
      Alert.alert('오류', '출석 체크 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingAttendance(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `${rank}위`;
    }
  };

  const { cachePost } = usePostCacheStore();
  
  const navigateToPost = (post: Post) => {
    // 게시글 데이터를 캐시에 저장 (즉시 표시용)
    cachePost(post.id, post);
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
    } else if (gameId === 'math') {
      router.push('/games/math' as any);
    } else if (gameId === 'typing') {
      router.push('/games/typing' as any);
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
          <LinearGradient
            colors={['#10B981', '#059669', '#14B8A6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <Text style={styles.title}>📚 Inschoolz</Text>
            <Text style={styles.subtitleWhite}>학생들을 위한 커뮤니티</Text>
          </LinearGradient>
        </View>

        <View style={styles.loginPrompt}>
          <Ionicons name="person-circle-outline" size={64} color="#10B981" />
          <Text style={styles.loginPromptTitle}>로그인이 필요합니다</Text>
          <Text style={styles.loginPromptDescription}>
            Inschoolz의 모든 기능을 이용하려면 로그인해주세요.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={navigateToLogin} activeOpacity={0.8}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButtonGradient}
            >
              <Text style={styles.loginButtonText}>로그인하기</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      {/* 로그인 없이도 볼 수 있는 컨텐츠 - 게임 스타일 */}
        
        {/* 인기 게시글 */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <LinearGradient
              colors={['#ECFDF5', '#D1FAE5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionHeaderGradient}
            >
              <Text style={styles.sectionTitle}>🔥 인기 게시글</Text>
              <TouchableOpacity onPress={() => navigateToCommunity('national')}>
                <Text style={styles.moreButton}>더보기 ›</Text>
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={styles.sectionContent}>
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
          </View>
        </View>
        
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <LinearGradient
              colors={['#ECFDF5', '#D1FAE5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionHeaderGradient}
            >
              <Text style={styles.sectionTitle}>🎮 미니게임</Text>
            </LinearGradient>
            
            <View style={styles.sectionContent}>
              <View style={styles.gameGrid}>
                <TouchableOpacity 
                  style={styles.gameCard}
                  onPress={() => Alert.alert('로그인 필요', '게임을 플레이하려면 로그인해주세요.')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#FEF3C7', '#FDE68A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gameCardGradient}
                  >
                    <Text style={styles.gameIcon}>⚡</Text>
                    <Text style={styles.gameTitle}>반응속도</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.gameCard}
                  onPress={() => Alert.alert('로그인 필요', '게임을 플레이하려면 로그인해주세요.')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#E9D5FF', '#DDD6FE']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gameCardGradient}
                  >
                    <Text style={styles.gameIcon}>🧩</Text>
                    <Text style={styles.gameTitle}>타일 맞추기</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.gameCard}
                  onPress={() => Alert.alert('준비 중', '곧 출시될 예정입니다! 🚀')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#DBEAFE', '#BFDBFE']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gameCardGradient}
                  >
                    <Text style={styles.gameIcon}>🧮</Text>
                    <Text style={styles.gameTitle}>빠른 계산</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <LinearGradient
              colors={['#ECFDF5', '#D1FAE5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionHeaderGradient}
            >
              <Text style={styles.sectionTitle}>📝 커뮤니티</Text>
            </LinearGradient>
            
            <View style={styles.sectionContent}>
              <View style={styles.communityGrid}>
                <TouchableOpacity 
                  style={styles.communityCard}
                  onPress={() => navigateToCommunity('national')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#ECFDF5', '#D1FAE5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.communityCardGradient}
                  >
                    <Text style={styles.communityIcon}>🌍</Text>
                    <Text style={styles.communityTitle}>전국</Text>
                    <Text style={styles.communityDesc}>전국 학생들과 소통</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.communityCard}
                  onPress={() => navigateToCommunity('regional')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#ECFDF5', '#D1FAE5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.communityCardGradient}
                  >
                    <Text style={styles.communityIcon}>🏘️</Text>
                    <Text style={styles.communityTitle}>지역</Text>
                    <Text style={styles.communityDesc}>로그인 후 이용</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.communityCard}
                  onPress={() => navigateToCommunity('school')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#ECFDF5', '#D1FAE5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.communityCardGradient}
                  >
                    <Text style={styles.communityIcon}>🏫</Text>
                    <Text style={styles.communityTitle}>학교</Text>
                    <Text style={styles.communityDesc}>로그인 후 이용</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
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
      {/* 헤더 - 게임 스타일 */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#10B981', '#059669', '#14B8A6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Text style={styles.title}>📚 Inschoolz</Text>
        </LinearGradient>
        
        <View style={styles.userInfo}>
          <View style={styles.userNameContainer}>
            <Text style={styles.userName}>{user.profile?.userName || '익명'}</Text>
            <View style={styles.levelBadge}>
              <LinearGradient
                colors={['#FBBF24', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.levelBadgeGradient}
              >
                <Text style={styles.levelBadgeText}>Lv.{user.stats?.level || 1}</Text>
              </LinearGradient>
            </View>
          </View>
          
          <View style={styles.expContainer}>
            <View style={styles.expHeader}>
              <Text style={styles.expLabel}>⚡ 경험치</Text>
              <Text style={styles.expValue}>
                {expProgress.current.toLocaleString()} / {expProgress.required.toLocaleString()} XP
              </Text>
            </View>
            <View style={styles.expBarContainer}>
              <View style={styles.expBarBackground}>
                <LinearGradient
                  colors={['#34D399', '#10B981', '#14B8A6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.expBarFill, { width: `${expProgress.percentage}%` }]}
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
        </View>
      </View>

      {/* 출석 체크 - 게임 스타일 */}
      <View style={styles.section}>
        <View style={styles.attendanceCard}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.attendanceHeader}
          >
            <Text style={styles.attendanceTitle}>📅 출석 체크</Text>
            {attendanceData?.streak != null && attendanceData.streak > 0 ? (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {attendanceData.streak}일</Text>
              </View>
            ) : null}
          </LinearGradient>
          
          <View style={styles.attendanceContent}>
            <Text style={styles.attendanceDesc}>
              {attendanceData?.checkedToday 
                ? '오늘 출석 완료! 매일 출석하고 경험치를 받으세요!' 
                : '출석체크로 경험치를 받으세요!'}
            </Text>
            
            <TouchableOpacity 
              style={styles.attendanceButton}
              onPress={handleAttendanceCheck}
              disabled={attendanceData?.checkedToday || isCheckingAttendance}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={attendanceData?.checkedToday 
                  ? ['#10B981', '#059669'] 
                  : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.attendanceButtonGradient}
              >
                <Text style={styles.attendanceButtonText}>
                  {isCheckingAttendance 
                    ? '처리중...' 
                    : attendanceData?.checkedToday 
                      ? '✅ 출석 완료' 
                      : '출석 체크하기 (+10 XP)'
                  }
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 인기 게시글 - 게임 스타일 */}
      <View style={styles.section}>
        <View style={styles.sectionCard}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionHeaderGradient}
          >
            <Text style={styles.sectionTitle}>🔥 인기 게시글</Text>
            <TouchableOpacity onPress={() => navigateToCommunity('national')}>
              <Text style={styles.moreButton}>더보기 ›</Text>
            </TouchableOpacity>
          </LinearGradient>
          
          <View style={styles.sectionContent}>
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
        </View>
      </View>

      {/* 급식 정보 - 게임 스타일 */}
      {user?.school?.id && (
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <LinearGradient
              colors={['#ECFDF5', '#D1FAE5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionHeaderGradient}
            >
              <Text style={styles.sectionTitle}>🍽️ 오늘의 급식</Text>
              <TouchableOpacity 
                onPress={() => router.push('/meals')}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>전체보기 ›</Text>
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={styles.sectionContent}>
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
          </View>
        </View>
      )}

      {/* 미니게임 - 게임 스타일 */}
      <View style={styles.section}>
        <View style={styles.sectionCard}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionHeaderGradient}
          >
            <Text style={styles.sectionTitle}>🎮 미니게임</Text>
          </LinearGradient>
          
          <View style={styles.sectionContent}>
            <View style={styles.gameGrid}>
              <TouchableOpacity 
                style={styles.gameCard}
                onPress={() => navigateToGame('reaction')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#FEF3C7', '#FDE68A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gameCardGradient}
                >
                  <Text style={styles.gameIcon}>⚡</Text>
                  <Text style={styles.gameTitle}>반응속도</Text>
                  <Text style={styles.gameXP}>+15 XP</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.gameCard}
                onPress={() => navigateToGame('tile')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#E9D5FF', '#DDD6FE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gameCardGradient}
                >
                  <Text style={styles.gameIcon}>🧩</Text>
                  <Text style={styles.gameTitle}>타일 맞추기</Text>
                  <Text style={styles.gameXP}>+10 XP</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.gameCard}
                onPress={() => navigateToGame('math')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#DBEAFE', '#BFDBFE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gameCardGradient}
                >
                  <Text style={styles.gameIcon}>🧮</Text>
                  <Text style={styles.gameTitle}>빠른 계산</Text>
                  <Text style={styles.gameXP}>+15 XP</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.gameCard}
                onPress={() => navigateToGame('typing')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#FED7AA', '#FDBA74']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gameCardGradient}
                >
                  <Text style={styles.gameIcon}>⌨️</Text>
                  <Text style={styles.gameTitle}>영단어 타이핑</Text>
                  <Text style={styles.gameXP}>+20 XP</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* 커뮤니티 바로가기 - 게임 스타일 */}
      <View style={styles.section}>
        <View style={styles.sectionCard}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionHeaderGradient}
          >
            <Text style={styles.sectionTitle}>📝 커뮤니티</Text>
          </LinearGradient>
          
          <View style={styles.sectionContent}>
            <View style={styles.communityGrid}>
              <TouchableOpacity 
                style={styles.communityCard}
                onPress={() => navigateToCommunity('national')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#ECFDF5', '#D1FAE5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.communityCardGradient}
                >
                  <Text style={styles.communityIcon}>🌍</Text>
                  <Text style={styles.communityTitle}>전국</Text>
                  <Text style={styles.communityDesc}>전국 학생들과 소통</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.communityCard}
                onPress={() => navigateToCommunity('regional')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#ECFDF5', '#D1FAE5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.communityCardGradient}
                >
                  <Text style={styles.communityIcon}>🏘️</Text>
                  <Text style={styles.communityTitle}>지역</Text>
                  <Text style={styles.communityDesc}>우리 지역 친구들과 소통</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.communityCard}
                onPress={() => navigateToCommunity('school')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#ECFDF5', '#D1FAE5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.communityCardGradient}
                >
                  <Text style={styles.communityIcon}>🏫</Text>
                  <Text style={styles.communityTitle}>학교</Text>
                  <Text style={styles.communityDesc}>우리 학교만의 공간</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
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

  // 헤더 - 게임 스타일
  header: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerGradient: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  userInfo: {
    padding: 16,
    paddingTop: 12,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
  levelBadge: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  levelBadgeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  expContainer: {
    marginTop: 4,
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
  // 로그인 프롬프트 - 게임 스타일
  loginPrompt: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#047857',
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
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  loginButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    alignItems: 'center',
    borderRadius: 12,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  subtitleWhite: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  // 섹션 - 게임 스타일
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionHeaderGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#D1FAE5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#047857',
  },
  sectionContent: {
    padding: 12,
  },
  moreButton: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  // 출석체크 - 게임 스타일
  attendanceCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#D1FAE5',
  },
  attendanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#047857',
  },
  streakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  streakText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  attendanceContent: {
    padding: 16,
  },
  attendanceDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  attendanceButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  attendanceButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderRadius: 12,
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
  // 커뮤니티 - 게임 스타일
  communityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  communityCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  communityCardGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    borderRadius: 12,
  },
  communityIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  communityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 4,
  },
  communityDesc: {
    fontSize: 11,
    color: '#059669',
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
  // 게임 - 게임 스타일
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gameCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  gameCardGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
  },
  gameIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  gameXP: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#059669',
  },
  // 급식 관련 스타일
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
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
