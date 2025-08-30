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
import { School, Post } from '../../types';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncUserExperienceData } from '../../lib/experience';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import PostListItem from '../../components/PostListItem';
import { Timestamp } from 'firebase/firestore';

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

  // 사용자 데이터 및 출석 정보 로드
  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // 로그인된 경우에만 개인 데이터 로드
      if (user?.uid) {
        // 경험치 데이터 동기화
        await syncUserExperienceData(user.uid);
        
        // 출석 정보만 로드 (나머지는 추후 구현)
        const attendanceInfo = await checkAttendance(user.uid);
        setAttendance(attendanceInfo);
        
        // 게임 통계 로드
        try {
          const gameStatsResponse = await getUserGameStats(user.uid);
          if (gameStatsResponse.success && gameStatsResponse.data) {
            setGameStats({
              bestReactionTimes: gameStatsResponse.data.bestReactionTimes,
              todayPlays: gameStatsResponse.data.todayPlays,
              maxPlays: gameStatsResponse.data.maxPlays
            });
          }
        } catch (error) {
          console.error('게임 통계 로드 실패:', error);
        }
        
        // TODO: 추후 다른 데이터들도 로드 구현
        // const mainSchoolInfo = await getMainSchool(user.uid);
        // const rankings = await getRankingPreview(user.uid, user.school?.id, user.regions?.sido, user.regions?.sigungu);
        // setMainSchool(mainSchoolInfo);
        // setRankingPreview(rankings);
      }
      
      // 인기 게시글은 로그인 여부와 관계없이 로드
      const posts = await getPopularPostsForHome(3);
      setPopularPosts(posts);
      
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
              <Text style={styles.gameDesc}>로그인 후 플레이</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.gameCard}
              onPress={() => Alert.alert('준비 중', '곧 출시될 예정입니다! 🚀')}
            >
              <Text style={styles.gameIcon}>🧩</Text>
              <Text style={styles.gameTitle}>타일 맞추기</Text>
              <Text style={styles.gameDesc}>준비 중</Text>
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
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>📚 Inschoolz</Text>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.profile?.userName || '익명'}</Text>
          <View style={styles.expBar}>
            <View style={styles.expBarBackground}>
              <View style={[styles.expBarFill, { width: `${expProgress.percentage}%` }]} />
            </View>
            <Text style={styles.expText}>
              Lv.{user.stats?.level || 1} ({expProgress.current}/{expProgress.required})
            </Text>
          </View>
        </View>
      </View>

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
            <Text style={styles.gameDesc}>
              {gameStats.bestReactionTimes.reactionGame 
                                        ? `최고: ${gameStats.bestReactionTimes.reactionGame.toFixed(2)}ms` 
                : '도전해보세요!'
              }
            </Text>
            <Text style={styles.gamePlayCount}>
              오늘 {gameStats.todayPlays.reactionGame || 0}/{gameStats.maxPlays || 5} 플레이
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.gameCard}
            onPress={() => Alert.alert('준비 중', '곧 출시될 예정입니다! 🚀')}
          >
            <Text style={styles.gameIcon}>🧩</Text>
            <Text style={styles.gameTitle}>타일 맞추기</Text>
            <Text style={styles.gameDesc}>준비 중</Text>
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
  expBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
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
    width: '48%',
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
});
