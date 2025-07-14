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
// 기본 시간 포맷팅 함수
const formatSmartTime = (timestamp: any) => {
  const date = new Date(timestamp?.seconds * 1000 || Date.now());
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return '방금 전';
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  return `${Math.floor(diffInHours / 24)}일 전`;
};
import { SafeScreenContainer } from '../../components/SafeScreenContainer';

interface RankingPreview {
  national: Array<{
    id: string;
    userName: string;
    stats: {
      totalExperience: number;
      level: number;
    };
    school?: {
      name: string;
    };
  }>;
  regional: Array<{
    id: string;
    userName: string;
    stats: {
      totalExperience: number;
      level: number;
    };
    school?: {
      name: string;
    };
  }>;
  school: Array<{
    id: string;
    userName: string;
    stats: {
      totalExperience: number;
      level: number;
    };
  }>;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [attendance, setAttendance] = useState<UserAttendance | null>(null);
  const [isCheckingAttendance, setIsCheckingAttendance] = useState(false);
  const [mainSchool, setMainSchool] = useState<School | null>(null);
  const [gameStats, setGameStats] = useState<{
    bestReactionTimes: { [key: string]: number | null };
    todayPlays: { [key: string]: number };
  }>({
    bestReactionTimes: { reactionGame: null, tileGame: null },
    todayPlays: { reactionGame: 0, tileGame: 0 }
  });
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const [rankingPreview, setRankingPreview] = useState<RankingPreview | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      
      // 경험치 데이터 동기화
      await syncUserExperienceData(user.uid);
      
      const [
        attendanceInfo, 
        mainSchoolInfo, 
        gameStatsResponse,
        posts,
        rankings
      ] = await Promise.all([
        checkAttendance(user.uid),
        getMainSchool(user.uid),
        getUserGameStats(user.uid),
        getPopularPostsForHome(3),
        getRankingPreview(
          user.uid,
          user.school?.id,
          user.regions?.sido,
          user.regions?.sigungu
        )
      ]);
      
      setAttendance(attendanceInfo);
      setMainSchool(mainSchoolInfo);
      setPopularPosts(posts);
      setRankingPreview(rankings);
      
      if (gameStatsResponse.success && gameStatsResponse.data) {
        setGameStats({
          bestReactionTimes: gameStatsResponse.data.bestReactionTimes,
          todayPlays: gameStatsResponse.data.todayPlays
        });
      }
    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // Firebase 실시간 리스너는 AuthStore에서 중앙 관리됨
  // 로컬 상태는 AuthStore의 user 데이터를 직접 사용

  useEffect(() => {
    loadUserData();
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleAttendanceCheck = async () => {
    if (!user?.uid || attendance?.checkedToday || isCheckingAttendance) return;
    
    setIsCheckingAttendance(true);
    try {
      const result = await checkAttendance(user.uid);
      setAttendance(result);
      
      if (result.checkedToday) {
        Alert.alert('출석 완료!', '경험치 +10을 획득했습니다! 🎉');
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
    router.push('/ranking' as any);
  };

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

  return (
    <SafeScreenContainer 
      scrollable={true}
      contentContainerStyle={{
        paddingHorizontal: 0, // 기본 패딩 제거 (각 섹션에서 개별 설정)
      }}
    >
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >


      {/* 헤더 - 사용자 정보 & 경험치 */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>안녕하세요!</Text>
          <Text style={styles.userName}>{user?.profile?.userName || '사용자'}님</Text>
        </View>
        <View style={styles.expContainer}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv.{user?.stats?.level || 1}</Text>
          </View>
          <View style={styles.expBar}>
            <View style={[styles.expFill, { width: `${expProgress.percentage}%` }]} />
          </View>
          <Text style={styles.expText}>{expProgress.current}/{expProgress.required} XP</Text>
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
          <Text style={styles.sectionTitle}>🔥 실시간 인기 글</Text>
          <TouchableOpacity onPress={() => navigateToCommunity('national')}>
            <Text style={styles.moreText}>더보기</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.popularPostsContainer}>
          {popularPosts.length > 0 ? (
            popularPosts.map((post, index) => (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postCard}
                onPress={() => navigateToPost(post)}
              >
                <View style={styles.postContentContainer}>
                  <View style={styles.postRank}>
                    <Text style={styles.postRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.postInfo}>
                    <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
                    <Text style={styles.postContent} numberOfLines={2}>
                      {(post as any).previewContent || post.content?.replace(/<[^>]*>/g, '').slice(0, 150) || ''}
                    </Text>
                    <View style={styles.postMeta}>
                      <Text style={styles.postStat}>❤️ {post.stats.likeCount}</Text>
                      <Text style={styles.postStat}>💬 {post.stats.commentCount}</Text>
                      <Text style={styles.postMetaText}>•</Text>
                      <Text style={styles.postMetaText}>
                        {post.authorInfo.isAnonymous ? '익명' : post.authorInfo.displayName}
                      </Text>
                      <Text style={styles.postMetaText}>•</Text>
                      <Text style={styles.postMetaText}>{formatSmartTime(post.createdAt)}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>아직 인기 글이 없습니다</Text>
            </View>
          )}
        </View>
      </View>

      {/* 랭킹 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏆 랭킹</Text>
          <TouchableOpacity onPress={navigateToRanking}>
            <Text style={styles.moreText}>전체보기</Text>
          </TouchableOpacity>
        </View>
        
        {/* 전국 랭킹 */}
        <View style={styles.rankingSection}>
          <Text style={styles.rankingTitle}>🌍 전국 랭킹</Text>
          {rankingPreview?.national.slice(0, 3).map((user, index) => (
            <View key={user.id} style={styles.rankingItem}>
              <Text style={styles.rankingRank}>{getRankIcon(index + 1)}</Text>
              <Text style={styles.rankingName}>{user.userName}</Text>
              <Text style={styles.rankingLevel}>Lv.{user.stats.level}</Text>
            </View>
          ))}
        </View>

        {/* 지역 랭킹 */}
        {rankingPreview?.regional && rankingPreview.regional.length > 0 && (
          <View style={styles.rankingSection}>
            <Text style={styles.rankingTitle}>🏘️ 지역 랭킹</Text>
            {rankingPreview.regional.slice(0, 3).map((user, index) => (
              <View key={user.id} style={styles.rankingItem}>
                <Text style={styles.rankingRank}>{getRankIcon(index + 1)}</Text>
                <Text style={styles.rankingName}>{user.userName}</Text>
                <Text style={styles.rankingLevel}>Lv.{user.stats.level}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 학교 랭킹 */}
        {rankingPreview?.school && rankingPreview.school.length > 0 && (
          <View style={styles.rankingSection}>
            <Text style={styles.rankingTitle}>🏫 학교 랭킹</Text>
            {rankingPreview.school.slice(0, 3).map((user, index) => (
              <View key={user.id} style={styles.rankingItem}>
                <Text style={styles.rankingRank}>{getRankIcon(index + 1)}</Text>
                <Text style={styles.rankingName}>{user.userName}</Text>
                <Text style={styles.rankingLevel}>Lv.{user.stats.level}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 미니게임 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎮 미니게임</Text>
        <View style={styles.gameGrid}>
          <TouchableOpacity 
            style={styles.gameCard}
            onPress={() => navigateToGame('reaction')}
          >
            <Text style={styles.gameIcon}>⚡</Text>
            <Text style={styles.gameName}>반응속도</Text>
            <Text style={styles.gameScore}>
              최고: {gameStats.bestReactionTimes.reactionGame ? `${gameStats.bestReactionTimes.reactionGame}ms` : '-'}
            </Text>
            <Text style={styles.gameReward}>+15 XP</Text>
            <Text style={styles.gamePlays}>오늘: {gameStats.todayPlays.reactionGame}/5</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.gameCard, styles.gameCardDisabled]}
            onPress={() => navigateToGame('tile')}
          >
            <Text style={styles.gameIcon}>🧩</Text>
            <Text style={styles.gameName}>타일 맞추기</Text>
            <Text style={styles.gameScore}>곧 출시</Text>
            <Text style={styles.gameReward}>+20 XP</Text>
            <Text style={styles.gamePlays}>준비 중</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.gameCard, styles.gameCardDisabled]}
            onPress={() => navigateToGame('calculation')}
          >
            <Text style={styles.gameIcon}>🧮</Text>
            <Text style={styles.gameName}>빠른 계산</Text>
            <Text style={styles.gameScore}>곧 출시</Text>
            <Text style={styles.gameReward}>+18 XP</Text>
            <Text style={styles.gamePlays}>준비 중</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.gameCard, styles.gameCardDisabled]}
            onPress={() => navigateToGame('word')}
          >
            <Text style={styles.gameIcon}>📝</Text>
            <Text style={styles.gameName}>단어 맞추기</Text>
            <Text style={styles.gameScore}>곧 출시</Text>
            <Text style={styles.gameReward}>+25 XP</Text>
            <Text style={styles.gamePlays}>준비 중</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
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
  userInfo: {
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  expContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  expBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
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
  },
  moreText: {
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  postContentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  postRank: {
    width: 24,
    height: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  postInfo: {
    flex: 1,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  postContent: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postStat: {
    fontSize: 12,
    color: '#6b7280',
  },
  postMetaText: {
    fontSize: 12,
    color: '#9ca3af',
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
  communityName: {
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
  rankingSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rankingRank: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 40,
  },
  rankingName: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  rankingLevel: {
    fontSize: 12,
    color: '#6b7280',
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
  gameName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  gameScore: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  gameReward: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 4,
  },
  gamePlays: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
