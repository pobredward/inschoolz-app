import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { getRankingData } from '../../lib/experience';

interface RankingUser {
  userId: string;
  userName: string;
  level: number;
  totalExperience: number;
  schoolName?: string;
  rank: number;
  avatar?: string;
}

interface RankingData {
  global: RankingUser[];
  regional: RankingUser[];
  school: RankingUser[];
  userRanks: {
    global: number;
    regional: number;
    school: number;
  };
}

function RankingItem({ user, showSchool = true }: { 
  user: RankingUser; 
  showSchool?: boolean;
}) {
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
    <View style={styles.rankItem}>
      <View style={styles.rankIconContainer}>
        {getRankIcon(user.rank)}
      </View>
      
      {user.avatar ? (
        <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.userName.slice(0, 2)}
          </Text>
        </View>
      )}

      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.userName}
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv.{user.level}</Text>
          </View>
        </View>
        
        {showSchool && user.schoolName && (
          <View style={styles.schoolRow}>
            <Ionicons name="school" size={12} color="#6B7280" />
            <Text style={styles.schoolText} numberOfLines={1}>
              {user.schoolName}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.experienceContainer}>
        <View style={styles.experienceRow}>
          <Ionicons name="star" size={16} color="#10B981" />
          <Text style={styles.experienceText}>
            {user.totalExperience.toLocaleString()}
          </Text>
        </View>
        <Text style={styles.experienceLabel}>총 경험치</Text>
      </View>
    </View>
  );
}

function MyRankingSummary({ userRanks }: { userRanks: RankingData['userRanks'] }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <Ionicons name="trending-up" size={20} color="#10B981" />
        <Text style={styles.summaryTitle}>내 랭킹 현황</Text>
      </View>
      
      <View style={styles.summaryContent}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryRank}>#{userRanks.global}</Text>
          <Text style={styles.summaryLabel}>전국 랭킹</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryRank}>#{userRanks.regional}</Text>
          <Text style={styles.summaryLabel}>지역 랭킹</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryRank}>#{userRanks.school}</Text>
          <Text style={styles.summaryLabel}>학교 랭킹</Text>
        </View>
      </View>
    </View>
  );
}

function TabButton({ 
  title, 
  icon, 
  active, 
  onPress 
}: { 
  title: string; 
  icon: string; 
  active: boolean; 
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.activeTabButton]}
      onPress={onPress}
    >
      <Ionicons 
        name={icon as any} 
        size={16} 
        color={active ? '#10B981' : '#6B7280'} 
      />
      <Text style={[styles.tabButtonText, active && styles.activeTabButtonText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function RankingScreen() {
  const { user } = useAuthStore();
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'global' | 'regional' | 'school'>('global');

  useEffect(() => {
    loadRankingData();
  }, [user]);

  const loadRankingData = async () => {
    if (!user) return;

    try {
      setError(null);
      
      const globalData = await getRankingData('global', undefined, undefined, undefined, 50);
      const regionalData = await getRankingData('region', undefined, user.regions?.sido, user.regions?.sigungu, 50);
      const schoolData = await getRankingData('school', user.school?.id, undefined, undefined, 50);

      const data = {
        global: globalData.map((item, index) => ({
          ...item,
          userName: item.displayName,
          totalExperience: item.totalExperience,
          avatar: item.profileImageUrl,
          rank: item.rank
        })),
        regional: regionalData.map((item, index) => ({
          ...item,
          userName: item.displayName,
          totalExperience: item.totalExperience,
          avatar: item.profileImageUrl,
          rank: item.rank
        })),
        school: schoolData.map((item, index) => ({
          ...item,
          userName: item.displayName,
          totalExperience: item.totalExperience,
          avatar: item.profileImageUrl,
          rank: item.rank
        })),
        userRanks: {
          global: globalData.findIndex(item => item.userId === user.uid) + 1 || 999,
          regional: regionalData.findIndex(item => item.userId === user.uid) + 1 || 999,
          school: schoolData.findIndex(item => item.userId === user.uid) + 1 || 999,
        }
      };

      setRankingData(data);
    } catch (err) {
      console.error('랭킹 데이터 로딩 실패:', err);
      setError('랭킹 데이터를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadRankingData();
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle" size={64} color="#9CA3AF" />
          <Text style={styles.centerTitle}>로그인이 필요합니다</Text>
          <Text style={styles.centerDescription}>
            랭킹을 확인하려면 먼저 로그인해주세요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getCurrentRankingData = () => {
    if (!rankingData) return [];
    
    switch (activeTab) {
      case 'global':
        return rankingData.global;
      case 'regional':
        return rankingData.regional;
      case 'school':
        return rankingData.school;
      default:
        return [];
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="trophy" size={32} color="#10B981" />
          <Text style={styles.headerTitle}>랭킹 보드</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          학교별, 지역별, 전국 랭킹을 확인하고 친구들과 경쟁해보세요!
        </Text>
      </View>

      {rankingData && (
        <MyRankingSummary userRanks={rankingData.userRanks} />
      )}

      <View style={styles.tabContainer}>
        <TabButton
          title="전국"
          icon="people"
          active={activeTab === 'global'}
          onPress={() => setActiveTab('global')}
        />
        <TabButton
          title="지역"
          icon="location"
          active={activeTab === 'regional'}
          onPress={() => setActiveTab('regional')}
        />
        <TabButton
          title="학교"
          icon="school"
          active={activeTab === 'school'}
          onPress={() => setActiveTab('school')}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#10B981']}
            tintColor="#10B981"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text>로딩 중...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.rankingList}>
            {getCurrentRankingData().map((user, index) => (
              <RankingItem 
                key={user.userId} 
                user={user} 
                showSchool={activeTab !== 'school'} 
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  summaryRank: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: '#ECFDF5',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeTabButtonText: {
    color: '#10B981',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  rankingList: {
    padding: 16,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  rankIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 16,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  experienceLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  centerDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
});
