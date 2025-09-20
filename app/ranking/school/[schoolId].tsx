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
import { SafeScreenContainer } from '../../../components/SafeScreenContainer';
import { useAuthStore } from '../../../store/authStore';
import { getRankings, RankingUser } from '../../../lib/ranking';
import { logger } from '../../../utils/logger';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// 학교 정보 타입
interface SchoolInfo {
  id: string;
  name: string;
  address?: string;
  type?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

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
        {user.regions && (
          <View style={styles.regionRow}>
            <Ionicons name="location" size={12} color="#6B7280" />
            <Text style={styles.regionText} numberOfLines={1}>
              {user.regions.sido} {user.regions.sigungu}
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
          이 학교에서 내 순위: <Text style={styles.userRankNumber}>#{rank}</Text>
        </Text>
      </View>
    </View>
  );
}

// CustomHeader 컴포넌트
function CustomHeader({ 
  title, 
  subtitle, 
  schoolInfo, 
  onBack 
}: { 
  title: string; 
  subtitle: string; 
  schoolInfo: SchoolInfo | null;
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
          <Ionicons name="school" size={20} color="#10B981" />
          <Text style={styles.customHeaderTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.customHeaderSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
        {schoolInfo?.regions && (
          <View style={styles.customHeaderInfoRow}>
            <Ionicons name="location" size={12} color="#6B7280" />
            <Text style={styles.customHeaderInfoText}>
              {schoolInfo.regions.sido} {schoolInfo.regions.sigungu}
            </Text>
          </View>
        )}
        {schoolInfo?.type && (
          <View style={styles.customHeaderInfoRow}>
            <Ionicons name="library" size={12} color="#6B7280" />
            <Text style={styles.customHeaderInfoText}>
              {schoolInfo.type}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function SchoolRankingScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const schoolId = params.schoolId as string;
  
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [state, setState] = useState<RankingState>({
    users: [],
    hasMore: false,
    isLoading: true,
  });

  const [refreshing, setRefreshing] = useState(false);

  // 학교 정보 로드
  const loadSchoolInfo = async () => {
    try {
      logger.debug('학교 정보 로드 시작:', { schoolId });
      
      const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
      if (schoolDoc.exists()) {
        const data = schoolDoc.data();
        setSchoolInfo({
          id: schoolDoc.id,
          name: data.name,
          address: data.address,
          type: data.type,
          regions: data.regions,
        });
        logger.debug('학교 정보 로드 완료:', data.name);
      } else {
        // 사용자 데이터에서 학교 이름 찾기 (fallback)
        const result = await getRankings({
          type: 'school',
          schoolId,
          limit: 1,
        });
        if (result.users.length > 0 && result.users[0].school) {
          setSchoolInfo({
            id: schoolId,
            name: result.users[0].school.name,
          });
          logger.debug('학교 정보 fallback 로드:', result.users[0].school.name);
        }
      }
    } catch (error) {
      logger.error('학교 정보 로드 오류:', error);
    }
  };

  const loadRankings = async (reset = false) => {
    try {
      logger.debug('학교 랭킹 로드 시작:', { schoolId, reset });
      
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));
      
      const result = await getRankings({
        type: 'school',
        schoolId,
        limit: 20,
        lastDoc: reset ? undefined : state.lastDoc,
      });

      setState(prev => ({
        users: reset ? result.users : [...prev.users, ...result.users],
        hasMore: result.hasMore,
        lastDoc: result.lastDoc,
        isLoading: false,
      }));
      
      logger.debug('학교 랭킹 로드 완료:', { userCount: result.users.length });
    } catch (error) {
      logger.error('학교 랭킹 로드 오류:', error);
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
    if (schoolId) {
      loadSchoolInfo();
      loadRankings(true);
    }
  }, [schoolId]);

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
  const isCurrentUserInSchool = user && user.school?.id === schoolId;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <CustomHeader 
          title={`${schoolInfo?.name || '학교'} 랭킹`}
          subtitle="이 학교에 속한 사용자들의 경험치 순위입니다"
          schoolInfo={schoolInfo}
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
          {isCurrentUserInSchool && (
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
                이 학교에는 아직 사용자가 없습니다.
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
    alignItems: 'flex-start',
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
    marginTop: -4,
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
    marginBottom: 4,
  },
  customHeaderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  customHeaderInfoText: {
    fontSize: 12,
    color: '#6B7280',
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
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
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
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  regionText: {
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
