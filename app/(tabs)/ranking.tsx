import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl, 
  TextInput, 
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { getRankings, RankingUser, RankingType } from '../../lib/ranking';
import { DocumentSnapshot } from 'firebase/firestore';
import { logger } from '../../utils/logger';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';

interface RankingState {
  users: RankingUser[];
  hasMore: boolean;
  lastDoc?: DocumentSnapshot;
  isLoading: boolean;
  error?: string;
}



export default function RankingScreen() {
  const { user } = useAuthStore();
  const [selectedType, setSelectedType] = useState<RankingType>('national');
  const [searchQuery, setSearchQuery] = useState('');

  const [rankingState, setRankingState] = useState<RankingState>({
    users: [],
    hasMore: false,
    isLoading: true,
  });

  const rankingTypes = [
    { id: 'national' as RankingType, name: '전국', color: '#f59e0b', icon: 'earth' },
    { id: 'regional' as RankingType, name: '지역', color: '#10b981', icon: 'location' },
    { id: 'school' as RankingType, name: '학교', color: '#3b82f6', icon: 'school' },
  ];



  // 랭킹 데이터 로드
  const loadRankings = async (reset = false) => {
    if (!user) return;

    try {
      logger.debug('랭킹 데이터 로드 시작:', { type: selectedType, reset, searchQuery });
      
      setRankingState(prev => ({ ...prev, isLoading: true, error: undefined }));

      const options = {
        type: selectedType,
        limit: 10,
        lastDoc: reset ? undefined : rankingState.lastDoc,
        searchQuery: searchQuery || undefined,
      };

      // 타입별 추가 옵션
      if (selectedType === 'school' && user.school?.id) {
        (options as any).schoolId = user.school.id;
      } else if (selectedType === 'regional' && user.regions?.sido && user.regions?.sigungu) {
        (options as any).sido = user.regions.sido;
        (options as any).sigungu = user.regions.sigungu;
      }

      const result = await getRankings(options);

      setRankingState(prev => ({
        users: reset ? result.users : [...prev.users, ...result.users],
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        isLoading: false,
      }));
      
      logger.debug('랭킹 데이터 로드 완료:', { userCount: result.users.length, hasMore: result.hasMore });
    } catch (error) {
      logger.error('랭킹 로드 오류:', error);
      setRankingState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: '랭킹을 불러오는 중 오류가 발생했습니다.' 
      }));
    }
  };

  // 초기 로드 및 타입/검색 변경 시 리로드
  useEffect(() => {
    loadRankings(true);
  }, [selectedType, searchQuery, user]);

  const handleRefresh = () => {
    loadRankings(true);
  };

  const handleLoadMore = () => {
    if (!rankingState.isLoading && rankingState.hasMore) {
      loadRankings(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return '#fbbf24';
      case 2: return '#9ca3af';
      case 3: return '#cd7c2f';
      default: return '#6b7280';
    }
  };

  const canShowRanking = () => {
    if (selectedType === 'school') {
      return user?.school?.id;
    }
    if (selectedType === 'regional') {
      return user?.regions?.sido && user?.regions?.sigungu;
    }
    return true; // 전국은 항상 표시
  };

  const getEmptyMessage = () => {
    if (selectedType === 'school' && !user?.school?.id) {
      return '학교 정보를 설정하면 학교 랭킹을 확인할 수 있습니다.';
    }
    if (selectedType === 'regional' && (!user?.regions?.sido || !user?.regions?.sigungu)) {
      return '지역 정보를 설정하면 지역 랭킹을 확인할 수 있습니다.';
    }
    return searchQuery ? '검색 결과가 없습니다.' : '랭킹 데이터가 없습니다.';
  };

  // 사용자 순위 표시 컴포넌트
  const renderUserRankBadge = () => {
    const currentUserIndex = rankingState.users.findIndex(u => u.id === user?.uid);
    if (currentUserIndex === -1) return null;
    
    const rank = currentUserIndex + 1;
    return (
      <View style={styles.userRankBadge}>
        <Ionicons name="trophy" size={16} color="#10b981" />
        <Text style={styles.userRankText}>내 순위: #{rank}</Text>
      </View>
    );
  };

  const renderRankingItem = ({ item, index }: { item: RankingUser; index: number }) => {
    const rank = index + 1;
    const isCurrentUser = item.id === user?.uid;
    
    return (
      <View style={[styles.rankCard, isCurrentUser && styles.myRankCard]}>
        <View style={styles.rankPosition}>
          <Text style={styles.rankIcon}>{getRankIcon(rank)}</Text>
          <Text style={[styles.rankText, { color: getRankColor(rank) }]}>
            {rank}등
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isCurrentUser && styles.myUserName]}>
            {item.userName}
            {isCurrentUser && ' (나)'}
          </Text>
          {selectedType !== 'school' && item.school?.name && (
            <Text style={styles.userSchool}>{item.school.name}</Text>
          )}
          {item.regions && (
            <Text style={styles.userRegion}>
              {item.regions.sido} {item.regions.sigungu}
            </Text>
          )}
        </View>
        <View style={styles.userStats}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Lv.{item.stats.level}</Text>
          </View>
          <Text style={styles.xpText}>{item.stats.totalExperience.toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  if (!user) {
    return (
      <SafeScreenContainer>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>로그인이 필요합니다</Text>
          <Text style={styles.emptyMessage}>랭킹을 확인하려면 로그인해주세요.</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  return (
    <SafeScreenContainer>
      {/* 랭킹 타입 선택 */}
      <View style={styles.typeSelector}>
        {rankingTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeButton,
              { backgroundColor: selectedType === type.id ? type.color : '#f3f4f6' }
            ]}
            onPress={() => setSelectedType(type.id)}
          >
            <Ionicons 
              name={type.icon as any} 
              size={16} 
              color={selectedType === type.id ? 'white' : '#374151'} 
            />
            <Text style={[
              styles.typeButtonText,
              { color: selectedType === type.id ? 'white' : '#374151' }
            ]}>
              {type.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>



      {/* 검색 입력 */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="사용자 이름으로 검색..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* 랭킹 리스트 */}
      {!canShowRanking() ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="information-circle-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>정보가 필요합니다</Text>
          <Text style={styles.emptyMessage}>{getEmptyMessage()}</Text>
        </View>
      ) : (
        <FlatList
          data={rankingState.users}
          renderItem={renderRankingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.rankingList}
          refreshControl={
            <RefreshControl 
              refreshing={rankingState.isLoading && rankingState.users.length === 0} 
              onRefresh={handleRefresh} 
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={renderUserRankBadge}
          ListEmptyComponent={() => (
            rankingState.isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>랭킹을 불러오는 중...</Text>
              </View>
            ) : rankingState.error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                <Text style={styles.emptyTitle}>오류가 발생했습니다</Text>
                <Text style={styles.emptyMessage}>{rankingState.error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                  <Text style={styles.retryButtonText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="trophy-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyTitle}>랭킹이 없습니다</Text>
                <Text style={styles.emptyMessage}>{getEmptyMessage()}</Text>
              </View>
            )
          )}
          ListFooterComponent={() => (
            rankingState.isLoading && rankingState.users.length > 0 ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={styles.loadMoreText}>더 많은 랭킹을 불러오는 중...</Text>
              </View>
            ) : null
          )}
        />
      )}
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  typeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 4,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  rankingList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  myRankCard: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  rankPosition: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 60,
  },
  rankIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  myUserName: {
    color: '#10b981',
  },
  userSchool: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  userRegion: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  userStats: {
    alignItems: 'flex-end',
  },
  levelBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  levelBadgeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  xpText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  loadMoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userRankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  userRankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
    marginLeft: 6,
  },
}); 