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
import { useAuthStore } from '../../store/authStore';
import { 
  getRankings, 
  getAggregatedRankings,
  AggregatedRegion,
  AggregatedSchool,
  AggregatedRankingResponse,
  searchRegions,
  searchSchools
} from '../../lib/ranking';
import { logger } from '../../utils/logger';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';

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

// 집계된 랭킹 상태 타입
interface AggregatedRankingState {
  regions?: AggregatedRegion[];
  schools?: AggregatedSchool[];
  isLoading: boolean;
  error?: string;
}

// 검색 상태 타입
interface SearchState {
  keyword: string;
  isSearching: boolean;
  searchResults: {
    regions: AggregatedRegion[];
    schools: AggregatedSchool[];
  };
}

interface RankingState {
  users: RankingUser[];
  hasMore: boolean;
  isLoading: boolean;
  lastDoc?: any;
  error?: string;
}

// 집계된 지역 랭킹 아이템 컴포넌트
function AggregatedRegionItem({ region, index, onPress }: { 
  region: AggregatedRegion; 
  index: number;
  onPress: () => void;
}) {
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

  return (
    <TouchableOpacity style={styles.aggregatedRankItem} onPress={onPress}>
      <View style={styles.rankContainer}>
        {getRankIcon(rank)}
      </View>

      <View style={styles.aggregatedUserInfo}>
        <Text style={styles.aggregatedUserName} numberOfLines={1}>
          {region.sido} {region.sigungu}
        </Text>
        <View style={styles.aggregatedStatsRow}>
          <View style={styles.aggregatedStatItem}>
            <Ionicons name="people" size={12} color="#6B7280" />
            <Text style={styles.aggregatedStatText}>
              {region.userCount.toLocaleString()}명 참여
            </Text>
          </View>
        </View>
        <Text style={styles.aggregatedAverageText}>
          평균 {region.averageExperience.toLocaleString()}XP
        </Text>
      </View>

      <View style={styles.aggregatedExperienceContainer}>
        <View style={styles.experienceRow}>
          <Ionicons name="star" size={16} color="#10B981" />
          <Text style={styles.aggregatedExperienceText}>
            {region.totalExperience.toLocaleString()}
          </Text>
        </View>
        <Text style={styles.experienceLabel}>총 경험치</Text>
        <View style={styles.detailArrow}>
          <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
          <Text style={styles.detailText}>상세보기</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// 집계된 학교 랭킹 아이템 컴포넌트
function AggregatedSchoolItem({ school, index, onPress }: { 
  school: AggregatedSchool; 
  index: number;
  onPress: () => void;
}) {
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

  return (
    <TouchableOpacity style={styles.aggregatedRankItem} onPress={onPress}>
      <View style={styles.rankContainer}>
        {getRankIcon(rank)}
      </View>

      <View style={styles.aggregatedUserInfo}>
        <Text style={styles.aggregatedUserName} numberOfLines={1}>
          {school.name}
        </Text>
        <View style={styles.aggregatedStatsRow}>
          <View style={styles.aggregatedStatItem}>
            <Ionicons name="people" size={12} color="#6B7280" />
            <Text style={styles.aggregatedStatText}>
              {school.userCount.toLocaleString()}명 참여
            </Text>
          </View>
        </View>
        {school.regions && (
          <View style={styles.aggregatedStatsRow}>
            <View style={styles.aggregatedStatItem}>
              <Ionicons name="location" size={12} color="#6B7280" />
              <Text style={styles.aggregatedStatText}>
                {school.regions.sido} {school.regions.sigungu}
              </Text>
            </View>
          </View>
        )}
        <Text style={styles.aggregatedAverageText}>
          평균 {school.averageExperience.toLocaleString()}XP
        </Text>
      </View>

      <View style={styles.aggregatedExperienceContainer}>
        <View style={styles.experienceRow}>
          <Ionicons name="star" size={16} color="#10B981" />
          <Text style={styles.aggregatedExperienceText}>
            {school.totalExperience.toLocaleString()}
          </Text>
        </View>
        <Text style={styles.experienceLabel}>총 경험치</Text>
        <View style={styles.detailArrow}>
          <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
          <Text style={styles.detailText}>상세보기</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
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

  // 집계된 랭킹 상태
  const [aggregatedState, setAggregatedState] = useState<AggregatedRankingState>({
    isLoading: false,
  });

  // 검색 상태
  const [searchState, setSearchState] = useState<SearchState>({
    keyword: '',
    isSearching: false,
    searchResults: {
      regions: [],
      schools: [],
    },
  });

  const rankingTypes = [
    { id: 'national' as RankingType, name: '전국', color: '#f59e0b', icon: 'earth' },
    { id: 'regional' as RankingType, name: '지역', color: '#10b981', icon: 'location' },
    { id: 'school' as RankingType, name: '학교', color: '#3b82f6', icon: 'school' },
  ];

  // 집계된 랭킹 데이터 로드
  const loadAggregatedRankings = async (reset = false) => {
    try {
      logger.debug('집계된 랭킹 데이터 로드 시작:', { type: selectedType, reset });
      
      setAggregatedState(prev => ({ ...prev, isLoading: true, error: undefined }));

      // 현재 offset 계산
      const currentOffset = reset ? 0 : (
        selectedType === 'regional' 
          ? (aggregatedState.regions?.length || 0)
          : (aggregatedState.schools?.length || 0)
      );

      if (selectedType === 'regional') {
        const result = await getAggregatedRankings('regional_aggregated', 20, currentOffset);
        setAggregatedState(prev => ({
          regions: reset ? result.regions : [...(prev.regions || []), ...(result.regions || [])],
          isLoading: false,
          hasMore: result.hasMore,
        }));
      } else if (selectedType === 'school') {
        const result = await getAggregatedRankings('school_aggregated', 20, currentOffset);
        setAggregatedState(prev => ({
          schools: reset ? result.schools : [...(prev.schools || []), ...(result.schools || [])],
          isLoading: false,
          hasMore: result.hasMore,
        }));
      }
      
      logger.debug('집계된 랭킹 데이터 로드 완료');
    } catch (error) {
      logger.error('집계된 랭킹 로드 오류:', error);
      setAggregatedState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: '랭킹을 불러오는 중 오류가 발생했습니다.' 
      }));
    }
  };

  // 검색 함수
  const handleSearch = async (keyword: string) => {
    try {
      logger.debug('검색 시작:', { keyword, selectedType });
      
      setSearchState(prev => ({ 
        ...prev, 
        keyword, 
        isSearching: true 
      }));

      if (selectedType === 'regional') {
        const regions = await searchRegions(keyword, 20);
        setSearchState(prev => ({
          ...prev,
          searchResults: { ...prev.searchResults, regions },
          isSearching: false,
        }));
      } else if (selectedType === 'school') {
        const schools = await searchSchools(keyword, 20);
        setSearchState(prev => ({
          ...prev,
          searchResults: { ...prev.searchResults, schools },
          isSearching: false,
        }));
      }
      
      logger.debug('검색 완료');
    } catch (error) {
      logger.error('검색 오류:', error);
      setSearchState(prev => ({ 
        ...prev, 
        isSearching: false 
      }));
      Alert.alert('오류', '검색 중 오류가 발생했습니다.');
    }
  };

  // 검색 초기화
  const clearSearch = () => {
    setSearchState({
      keyword: '',
      isSearching: false,
      searchResults: {
        regions: [],
        schools: [],
      },
    });
  };

  // 랭킹 데이터 로드
  const loadRankings = async (reset = false) => {
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
      if (selectedType === 'school' && user?.school?.id) {
        (options as any).schoolId = user.school.id;
      } else if (selectedType === 'regional' && user?.regions?.sido && user?.regions?.sigungu) {
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
    if (!authLoading) {
      if (selectedType === 'national') {
        // 전국 랭킹은 기존 방식으로 개인 랭킹 표시
        loadRankings(true);
      } else if (selectedType === 'regional' || selectedType === 'school') {
        // 지역/학교 탭은 집계된 랭킹 표시
        loadAggregatedRankings(true);
      }
    }
  }, [selectedType, searchQuery, user, authLoading]);

  const handleRefresh = () => {
    if (selectedType === 'national') {
      loadRankings(true);
    } else if (selectedType === 'regional' || selectedType === 'school') {
      loadAggregatedRankings(true);
    }
  };

  const handleLoadMoreAggregated = () => {
    if (!aggregatedState.isLoading && aggregatedState.hasMore) {
      loadAggregatedRankings(false);
    }
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
    // 모든 탭은 비회원도 접근 가능 (집계된 데이터 표시)
    return true;
  };

  const getEmptyMessage = () => {
    return searchQuery ? '검색 결과가 없습니다.' : '랭킹 데이터가 없습니다.';
  };

  const navigateToLogin = () => {
    router.push('/login');
  };

  // 인증 로딩 중
  if (authLoading) {
    return (
      <SafeScreenContainer style={styles.centerContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  return (
    <SafeScreenContainer scrollable={true}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 랭킹</Text>
        
        {/* 안내 메시지 */}
        <View style={styles.guestNotice}>
          <Text style={styles.guestNoticeText}>
            🏆 지역/학교 랭킹을 클릭하면 해당 지역이나 학교 내 개인 랭킹을 자세히 볼 수 있습니다!
          </Text>
        </View>
        
        {/* 랭킹 타입 선택 */}
        <View style={styles.typeSelector}>
          {rankingTypes.map((type) => {
            return (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeButton,
                  selectedType === type.id && styles.typeButtonActive,
                  { borderColor: type.color }
                ]}
                onPress={() => {
                  setSelectedType(type.id);
                  // 탭 변경 시 데이터 초기화
                  setRankingState({
                    users: [],
                    hasMore: false,
                    isLoading: false,
                  });
                  setAggregatedState({
                    isLoading: false,
                  });
                  // 검색 상태도 초기화
                  clearSearch();
                }}
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
            );
          })}
        </View>

        {/* 검색 */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder={
              selectedType === 'regional' 
                ? "지역명으로 검색 (예: 서울, 강남구)"
                : selectedType === 'school'
                ? "학교명으로 검색"
                : "사용자 이름으로 검색"
            }
            value={
              (selectedType === 'regional' || selectedType === 'school') 
                ? searchState.keyword 
                : searchQuery
            }
            onChangeText={
              (selectedType === 'regional' || selectedType === 'school')
                ? handleSearch
                : handleSearchChange
            }
          />
          {/* 검색 초기화 버튼 */}
          {((selectedType === 'regional' || selectedType === 'school') && searchState.keyword) && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearSearch}
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 랭킹 리스트 */}
      <View style={styles.listContainer}>
        {selectedType === 'national' ? (
          // 전국 랭킹: 개인 유저 랭킹 표시
          rankingState.users.length > 0 ? (
            rankingState.users.map((user) => {
              const rank = user.rank || 999;
              return (
                <TouchableOpacity 
                  key={user.id} 
                  style={styles.rankingItem}
                  onPress={() => router.push(`/users/${user.id}` as any)}
                >
                  <View style={styles.rankContainer}>
                    <Text style={[styles.rankIcon, { color: getRankColor(rank) }]}>
                      {getRankIcon(rank)}
                    </Text>
                    <Text style={[styles.rankNumber, { color: getRankColor(rank) }]}>
                      {rank}
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
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
            </View>
          )
        ) : selectedType === 'regional' ? (
          // 지역 랭킹: 집계된 지역별 랭킹 표시 또는 검색 결과
          searchState.isSearching ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.emptyText}>검색 중...</Text>
            </View>
          ) : searchState.keyword ? (
            // 검색 결과 표시
            searchState.searchResults.regions.length > 0 ? (
              searchState.searchResults.regions.map((region, index) => (
                <AggregatedRegionItem
                  key={region.id}
                  region={region}
                  index={index}
                  onPress={() => {
                    router.push(`/ranking/region/${encodeURIComponent(region.sido)}/${encodeURIComponent(region.sigungu)}` as any);
                  }}
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
                <Text style={styles.emptyText}>'{searchState.keyword}'와 일치하는 지역이 없습니다.</Text>
              </View>
            )
          ) : (
            // 기본 지역 랭킹 표시
            aggregatedState.isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.emptyText}>로딩 중...</Text>
              </View>
            ) : aggregatedState.error ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{aggregatedState.error}</Text>
              </View>
            ) : aggregatedState.regions && aggregatedState.regions.length > 0 ? (
              <>
                {aggregatedState.regions.map((region, index) => (
                  <AggregatedRegionItem
                    key={region.id}
                    region={region}
                    index={index}
                    onPress={() => {
                      router.push(`/ranking/region/${encodeURIComponent(region.sido)}/${encodeURIComponent(region.sigungu)}` as any);
                    }}
                  />
                ))}
                {aggregatedState.hasMore && (
                  <TouchableOpacity 
                    style={styles.loadMoreButton}
                    onPress={handleLoadMoreAggregated}
                    disabled={aggregatedState.isLoading}
                  >
                    {aggregatedState.isLoading ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>더 보기</Text>
                        <Ionicons name="chevron-down" size={20} color="#10B981" />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>지역 랭킹 데이터가 없습니다.</Text>
              </View>
            )
          )
        ) : selectedType === 'school' ? (
          // 학교 랭킹: 집계된 학교별 랭킹 표시 또는 검색 결과
          searchState.isSearching ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.emptyText}>검색 중...</Text>
            </View>
          ) : searchState.keyword ? (
            // 검색 결과 표시
            searchState.searchResults.schools.length > 0 ? (
              searchState.searchResults.schools.map((school, index) => (
                <AggregatedSchoolItem
                  key={school.id}
                  school={school}
                  index={index}
                  onPress={() => {
                    router.push(`/ranking/school/${school.id}` as any);
                  }}
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
                <Text style={styles.emptyText}>'{searchState.keyword}'와 일치하는 학교가 없습니다.</Text>
              </View>
            )
          ) : (
            // 기본 학교 랭킹 표시
            aggregatedState.isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.emptyText}>로딩 중...</Text>
              </View>
            ) : aggregatedState.error ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{aggregatedState.error}</Text>
              </View>
            ) : aggregatedState.schools && aggregatedState.schools.length > 0 ? (
              <>
                {aggregatedState.schools.map((school, index) => (
                  <AggregatedSchoolItem
                    key={school.id}
                    school={school}
                    index={index}
                    onPress={() => {
                      router.push(`/ranking/school/${school.id}` as any);
                    }}
                  />
                ))}
                {aggregatedState.hasMore && (
                  <TouchableOpacity 
                    style={styles.loadMoreButton}
                    onPress={handleLoadMoreAggregated}
                    disabled={aggregatedState.isLoading}
                  >
                    {aggregatedState.isLoading ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>더 보기</Text>
                        <Ionicons name="chevron-down" size={20} color="#10B981" />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>학교 랭킹 데이터가 없습니다.</Text>
              </View>
            )
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
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
  guestNotice: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  guestNoticeText: {
    color: '#1e40af',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
  typeButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#f3f4f6',
  },
  typeButtonTextDisabled: {
    color: '#9ca3af',
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
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  listContainer: {
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
  rankNumberFirst: {
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
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
  // 집계된 랭킹 아이템 스타일
  aggregatedRankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aggregatedUserInfo: {
    flex: 1,
    marginRight: 12,
  },
  aggregatedUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  aggregatedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  aggregatedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  aggregatedStatText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  aggregatedAverageText: {
    fontSize: 12,
    color: '#6B7280',
  },
  aggregatedExperienceContainer: {
    alignItems: 'flex-end',
  },
  aggregatedExperienceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  detailArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 2,
  },
  rankNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  experienceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 4,
  },
}); 