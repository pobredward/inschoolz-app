import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreenContainer } from '../../../../components/SafeScreenContainer';
import { useAuthStore } from '../../../../store/authStore';
import { getRankings, RankingUser } from '../../../../lib/ranking';
import { logger } from '../../../../utils/logger';

interface RankingState {
  users: RankingUser[];
  hasMore: boolean;
  isLoading: boolean;
  error?: string;
  lastDoc?: any;
}

// 랭킹 아이템 컴포넌트
function RankingItem({ user, index }: { 
  user: RankingUser; 
  index: number; 
}) {
  const router = useRouter();
  const rank = index + 1;
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Ionicons name="trophy" size={24} color="#EAB308" />;
      case 2:
        return <Ionicons name="medal" size={24} color="#9CA3AF" />;
      case 3:
        return <Ionicons name="medal" size={24} color="#D97706" />;
      default:
        return (
          <View style={styles.rankNumber}>
            <Text style={styles.rankNumberText}>#{rank}</Text>
          </View>
        );
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FEF3C7';
      case 2:
        return '#F3F4F6';
      case 3:
        return '#FED7AA';
      default:
        return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.rankItem, { backgroundColor: getRankBg(rank) }]}
      onPress={() => router.push(`/users/${user.id}` as any)}
    >
      <View style={styles.rankIconContainer}>
        {getRankIcon(rank)}
      </View>
      
      <View style={styles.userIcon}>
        <Text style={styles.userIconText}>
          {user.userName.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.userName}
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv.{user.stats.level}</Text>
          </View>
        </View>
        {user.school?.name && (
          <View style={styles.schoolRow}>
            <Ionicons name="school" size={12} color="#6B7280" />
            <Text style={styles.schoolText} numberOfLines={1}>
              {user.school.name}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.experienceContainer}>
        <View style={styles.experienceRow}>
          <Ionicons name="star" size={16} color="#10B981" />
          <Text style={styles.experienceText}>
            {user.stats.totalExperience.toLocaleString()}
          </Text>
        </View>
        <Text style={styles.experienceLabel}>경험치</Text>
      </View>
    </TouchableOpacity>
  );
}

// 사용자 순위 표시 컴포넌트
function UserRankBadge({ rank, isCurrentUser }: { rank: number; isCurrentUser: boolean }) {
  if (!isCurrentUser || rank === 0) return null;
  
  return (
    <View style={styles.userRankBadge}>
      <View style={styles.userRankContent}>
        <Ionicons name="trending-up" size={16} color="#10B981" />
        <Text style={styles.userRankText}>
          이 지역에서 내 순위: <Text style={styles.userRankNumber}>#{rank}</Text>
        </Text>
      </View>
    </View>
  );
}

// CustomHeader 컴포넌트
function CustomHeader({ title, subtitle, onBack }: { 
  title: string; 
  subtitle: string; 
  onBack: () => void; 
}) {
  return (
    <View style={styles.customHeader}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.customBackButton}
      >
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      
      <View style={styles.customHeaderContent}>
        <View style={styles.customHeaderTitleRow}>
          <Ionicons name="location" size={20} color="#3B82F6" />
          <Text style={styles.customHeaderTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.customHeaderSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export default function RegionRankingScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const sido = params.sido as string;
  const sigungu = params.sigungu as string;
  
  const [state, setState] = useState<RankingState>({
    users: [],
    hasMore: false,
    isLoading: true,
  });

  const [refreshing, setRefreshing] = useState(false);

  const loadRankings = async (reset = false) => {
    try {
      logger.debug('지역 랭킹 로드 시작:', { sido, sigungu, reset });
      
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));
      
      const result = await getRankings({
        type: 'regional',
        sido: decodeURIComponent(sido),
        sigungu: decodeURIComponent(sigungu),
        limit: 20,
        lastDoc: reset ? undefined : state.lastDoc,
      });

      setState(prev => ({
        users: reset ? result.users : [...prev.users, ...result.users],
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        isLoading: false,
      }));
      
      logger.debug('지역 랭킹 로드 완료:', { userCount: result.users.length });
    } catch (error) {
      logger.error('지역 랭킹 로드 오류:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: '랭킹을 불러오는 중 오류가 발생했습니다.' 
      }));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (sido && sigungu) {
      loadRankings(true);
    }
  }, [sido, sigungu]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRankings(true);
  };

  const handleLoadMore = () => {
    if (!state.isLoading && state.hasMore) {
      loadRankings(false);
    }
  };

  // 현재 사용자의 순위 계산
  const currentUserRank = user ? state.users.findIndex(u => u.id === user.uid) + 1 : 0;
  const isCurrentUserInRegion = user && 
    user.regions?.sido === decodeURIComponent(sido) && 
    user.regions?.sigungu === decodeURIComponent(sigungu);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <CustomHeader 
          title={`${decodeURIComponent(sido)} ${decodeURIComponent(sigungu)}`}
          subtitle="이 지역에 속한 사용자들의 경험치 순위입니다"
          onBack={() => router.back()} 
        />
        
        <SafeScreenContainer
          scrollable={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
        >
          {/* 현재 사용자 순위 표시 */}
          {isCurrentUserInRegion && (
            <UserRankBadge 
              rank={currentUserRank} 
              isCurrentUser={currentUserRank > 0}
            />
          )}
          {state.isLoading && state.users.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>로딩 중...</Text>
            </View>
          ) : state.error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{state.error}</Text>
            </View>
          ) : state.users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>사용자가 없습니다</Text>
              <Text style={styles.emptyText}>
                이 지역에는 아직 사용자가 없습니다.
              </Text>
            </View>
          ) : (
            <View style={styles.rankingList}>
              {state.users.map((user, index) => (
                <RankingItem
                  key={user.id}
                  user={user}
                  index={index}
                />
              ))}

              {/* 더 보기 버튼 */}
              {state.hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={handleLoadMore}
                  disabled={state.isLoading}
                >
                  <Text style={styles.loadMoreText}>
                    {state.isLoading ? '로딩 중...' : '더 보기'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </SafeScreenContainer>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 64,
  },
  customBackButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 20,
  },
  customHeaderContent: {
    flex: 1,
  },
  customHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  customHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  customHeaderSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  userRankBadge: {
    margin: 16,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  userRankContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userRankText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  userRankNumber: {
    fontWeight: 'bold',
  },
  rankingList: {
    padding: 16,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rankIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  levelBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  levelText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  schoolText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  experienceContainer: {
    alignItems: 'flex-end',
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  experienceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  experienceLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
});
