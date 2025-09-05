import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity
} from 'react-native';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';
import { 
  getDailyAdStats, 
  getRealtimeAdStats,
  calculateEstimatedRevenue,
  AdWatchStats 
} from '../../lib/ad-analytics';

export default function AdminAdsScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState<AdWatchStats | null>(null);
  const [estimatedRevenue, setEstimatedRevenue] = useState<{
    daily: number;
    monthly: number;
    yearly: number;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 관리자 권한 확인
  useEffect(() => {
    if (!user?.isAdmin) {
      Alert.alert('접근 권한 없음', '관리자만 접근할 수 있습니다.');
      router.back();
      return;
    }
    
    loadAdStats();
  }, [user]);

  const loadAdStats = async () => {
    try {
      setLoading(true);
      const stats = await getRealtimeAdStats();
      setTodayStats(stats.todayStats);
      setEstimatedRevenue(stats.estimatedRevenue);
    } catch (error) {
      console.error('광고 통계 로드 오류:', error);
      Alert.alert('오류', '광고 통계를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAdStats();
    setRefreshing(false);
  };

  const loadDateStats = async (date: string) => {
    try {
      setLoading(true);
      const stats = await getDailyAdStats(date);
      const revenue = calculateEstimatedRevenue(stats.totalWatches);
      setTodayStats(stats);
      setEstimatedRevenue(revenue);
      setSelectedDate(date);
    } catch (error) {
      console.error('날짜별 통계 로드 오류:', error);
      Alert.alert('오류', '통계를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !todayStats) {
    return (
      <SafeScreenContainer>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>광고 통계 로딩 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  return (
    <SafeScreenContainer>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>📊 광고 통계 관리</Text>
          <Text style={styles.subtitle}>리워드 광고 실시간 모니터링</Text>
        </View>

        {/* 오늘 통계 요약 */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>🎯 오늘의 광고 성과</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{todayStats?.totalUsers || 0}</Text>
              <Text style={styles.statLabel}>시청 사용자</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{todayStats?.totalWatches || 0}</Text>
              <Text style={styles.statLabel}>총 시청 횟수</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {todayStats?.avgWatchesPerUser.toFixed(1) || '0.0'}
              </Text>
              <Text style={styles.statLabel}>평균 시청/인</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                ${estimatedRevenue?.daily.toFixed(2) || '0.00'}
              </Text>
              <Text style={styles.statLabel}>예상 일일 수익</Text>
            </View>
          </View>
        </View>

        {/* 수익 예상 */}
        <View style={styles.revenueContainer}>
          <Text style={styles.sectionTitle}>💰 수익 예상</Text>
          
          <View style={styles.revenueGrid}>
            <View style={styles.revenueCard}>
              <Text style={styles.revenueLabel}>일일</Text>
              <Text style={styles.revenueAmount}>
                ${estimatedRevenue?.daily.toFixed(2) || '0.00'}
              </Text>
            </View>
            
            <View style={styles.revenueCard}>
              <Text style={styles.revenueLabel}>월간</Text>
              <Text style={styles.revenueAmount}>
                ${estimatedRevenue?.monthly.toFixed(2) || '0.00'}
              </Text>
            </View>
            
            <View style={styles.revenueCard}>
              <Text style={styles.revenueLabel}>연간</Text>
              <Text style={styles.revenueAmount}>
                ${estimatedRevenue?.yearly.toFixed(2) || '0.00'}
              </Text>
            </View>
          </View>
        </View>

        {/* 상위 시청자 */}
        {todayStats?.topWatchers && todayStats.topWatchers.length > 0 && (
          <View style={styles.topWatchersContainer}>
            <Text style={styles.sectionTitle}>🏆 상위 시청자</Text>
            
            {todayStats.topWatchers.slice(0, 5).map((watcher, index) => (
              <View key={watcher.userId} style={styles.watcherCard}>
                <View style={styles.watcherRank}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>
                <View style={styles.watcherInfo}>
                  <Text style={styles.watcherUserId}>
                    {watcher.userId.substring(0, 8)}...
                  </Text>
                  <Text style={styles.watcherCount}>
                    {watcher.watchCount}회 시청
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 정책 정보 */}
        <View style={styles.policyContainer}>
          <Text style={styles.sectionTitle}>📋 현재 정책</Text>
          
          <View style={styles.policyItem}>
            <Text style={styles.policyLabel}>일일 제한:</Text>
            <Text style={styles.policyValue}>5회</Text>
          </View>
          
          <View style={styles.policyItem}>
            <Text style={styles.policyLabel}>광고 간격:</Text>
            <Text style={styles.policyValue}>15분</Text>
          </View>
          
          <View style={styles.policyItem}>
            <Text style={styles.policyLabel}>보상:</Text>
            <Text style={styles.policyValue}>50 XP</Text>
          </View>
          
          <View style={styles.policyItem}>
            <Text style={styles.policyLabel}>eCPM:</Text>
            <Text style={styles.policyValue}>$12.00</Text>
          </View>
        </View>
      </ScrollView>
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  revenueContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  revenueGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  revenueCard: {
    flex: 1,
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  revenueLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  revenueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  topWatchersContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  watcherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  watcherRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  watcherInfo: {
    flex: 1,
  },
  watcherUserId: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  watcherCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  policyContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    marginBottom: 32,
  },
  policyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  policyLabel: {
    fontSize: 14,
    color: '#666',
  },
  policyValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});
