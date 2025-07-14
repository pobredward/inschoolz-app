import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl, 
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getRankings } from '../../lib/ranking';
import { logger } from '../../utils/logger';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// 랭킹 타입 정의
type RankingType = 'national' | 'regional' | 'school';

interface RankingUser {
  id: string;
  userName: string;
  stats: {
    totalExperience: number;
    level: number;
    currentExp: number;
  };
  school?: {
    id: string;
    name: string;
  };
  regions?: {
    sido: string;
    sigungu: string;
  };
  profile?: {
    avatar?: string;
    displayName?: string;
  };
}

interface RankingState {
  users: RankingUser[];
  hasMore: boolean;
  isLoading: boolean;
  lastDoc?: any;
  error?: string;
}

export default function RankingScreen() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [selectedType, setSelectedType] = useState<RankingType>('national');
  const [searchQuery, setSearchQuery] = useState('');

  const [rankingState, setRankingState] = useState<RankingState>({
    users: [],
    hasMore: false,
    isLoading: false,
  });

  const rankingTypes = [
    { id: 'national' as RankingType, name: '전국', color: '#f59e0b', icon: 'earth' },
    { id: 'regional' as RankingType, name: '지역', color: '#10b981', icon: 'location' },
    { id: 'school' as RankingType, name: '학교', color: '#3b82f6', icon: 'school' },
  ];

  // 랭킹 데이터 로드
  const loadRankings = async (reset = false) => {
    if (!user) {
      console.log('로그인되지 않아 랭킹 데이터 로드를 건너뜁니다.');
      return;
    }

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
    if (!authLoading && user) {
      loadRankings(true);
    }
  }, [selectedType, searchQuery, user, authLoading]);

  const handleRefresh = () => {
    if (user) {
      loadRankings(true);
    }
  };

  const handleLoadMore = () => {
    if (!rankingState.isLoading && rankingState.hasMore && user) {
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
    if (!user) return false;
    
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

  const navigateToLogin = () => {
    router.push('/auth');
  };

  // 인증 로딩 중
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 로그인하지 않은 상태
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="trophy-outline" size={64} color="#9CA3AF" />
          <Text style={styles.centerTitle}>로그인이 필요합니다</Text>
          <Text style={styles.centerDescription}>
            랭킹을 확인하려면 먼저 로그인해주세요.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={navigateToLogin}>
            <Text style={styles.loginButtonText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 랭킹</Text>
        
        {/* 랭킹 타입 선택 */}
        <View style={styles.typeSelector}>
          {rankingTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeButton,
                selectedType === type.id && styles.typeButtonActive,
                { borderColor: type.color }
              ]}
              onPress={() => setSelectedType(type.id)}
            >
              <Ionicons 
                name={type.icon as any} 
                size={16} 
                color={selectedType === type.id ? 'white' : type.color} 
              />
              <Text style={[
                styles.typeButtonText,
                selectedType === type.id && styles.typeButtonTextActive
              ]}>
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 검색 */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="사용자 이름으로 검색"
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </View>
      </View>

      {/* 랭킹 리스트 */}
      <ScrollView 
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={rankingState.isLoading} onRefresh={handleRefresh} />
        }
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            handleLoadMore();
          }
        }}
      >
        {canShowRanking() ? (
          rankingState.users.length > 0 ? (
            rankingState.users.map((user, index) => (
              <View key={user.id} style={styles.rankingItem}>
                <View style={styles.rankContainer}>
                  <Text style={[styles.rankIcon, { color: getRankColor(index + 1) }]}>
                    {getRankIcon(index + 1)}
                  </Text>
                  <Text style={[styles.rankNumber, { color: getRankColor(index + 1) }]}>
                    {index + 1}
                  </Text>
                </View>
                
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.userName}</Text>
                  <Text style={styles.userLevel}>Lv.{user.stats.level}</Text>
                  {user.school && (
                    <Text style={styles.userSchool}>{user.school.name}</Text>
                  )}
                </View>
                
                <View style={styles.expContainer}>
                  <Text style={styles.expText}>{user.stats.totalExperience.toLocaleString()} XP</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
            </View>
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => router.push('/profile-edit')}
            >
              <Text style={styles.settingsButtonText}>설정하러 가기</Text>
            </TouchableOpacity>
          </View>
        )}

        {rankingState.hasMore && (
          <TouchableOpacity 
            style={styles.loadMoreButton}
            onPress={handleLoadMore}
            disabled={rankingState.isLoading}
          >
            <Text style={styles.loadMoreText}>
              {rankingState.isLoading ? '로딩 중...' : '더 보기'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  centerDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  loginButton: {
    backgroundColor: '#10B981',
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
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  typeButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  typeButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  rankingItem: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rankContainer: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 50,
  },
  rankIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userLevel: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 2,
  },
  userSchool: {
    fontSize: 12,
    color: '#6b7280',
  },
  expContainer: {
    alignItems: 'flex-end',
  },
  expText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  settingsButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadMoreButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  loadMoreText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
}); 