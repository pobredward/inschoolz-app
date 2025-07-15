import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { getAdminStats } from '@/lib/experience';

// 파스텔 그린 색상 팔레트
const pastelGreenColors = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalComments: number;
  pendingReports: number;
  totalExperience: number;
}

interface AdminMenuItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  onPress: () => void;
  enabled: boolean;
}

export default function AdminScreen() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      Alert.alert(
        '접근 권한 없음',
        '관리자만 접근할 수 있습니다.',
        [{ text: '확인', onPress: () => router.replace('/(tabs)') }]
      );
    }
  }, [user]);

  // 통계 데이터 로드
  const loadStats = async () => {
    try {
      setIsLoading(true);
      const statsData = await getAdminStats();
      setStats(statsData);
    } catch (error) {
      console.error('통계 데이터 로드 실패:', error);
      Alert.alert('오류', '통계 데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadStats();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  // 관리자 메뉴 항목들
  const adminMenuItems: AdminMenuItem[] = [
    {
      id: 'experience',
      title: '경험치 관리',
      description: '경험치 설정 및 레벨 관리',
      icon: 'star',
      color: pastelGreenColors[500],
      enabled: true,
      onPress: () => {
        router.push('/admin/experience');
      },
    },
    {
      id: 'community',
      title: '커뮤니티 관리',
      description: '게시판 생성 및 설정',
      icon: 'forum',
      color: pastelGreenColors[600],
      enabled: true,
      onPress: () => {
        router.push('/admin/community');
      },
    },
    {
      id: 'notifications',
      title: '알림 설정',
      description: '전체 사용자 알림 발송',
      icon: 'notifications',
      color: pastelGreenColors[400],
      enabled: true,
      onPress: () => {
        router.push('/admin/notifications' as any);
      },
    },
    {
      id: 'reports',
      title: '신고 관리',
      description: '신고 처리 및 제재',
      icon: 'report',
      color: '#ef4444',
      enabled: true,
      onPress: () => {
        router.push('/admin/reports');
      },
    },
    {
      id: 'users',
      title: '유저 관리',
      description: '회원 정보 및 권한 관리',
      icon: 'people',
      color: pastelGreenColors[700],
      enabled: true,
      onPress: () => {
        router.push('/admin/users');
      },
    },
    {
      id: 'games',
      title: '게임 관리',
      description: '미니게임 설정 및 점수',
      icon: 'games',
      color: pastelGreenColors[800],
      enabled: false,
      onPress: () => {
        Alert.alert('개발 중', '게임 관리 기능은 개발 중입니다.');
      },
    },
    {
      id: 'schools',
      title: '학교 관리',
      description: '학교 정보 관리 및 추가',
      icon: 'school',
      color: pastelGreenColors[900],
      enabled: true,
      onPress: () => {
        router.push('/admin/schools');
      },
    },
  ];

  // 관리자가 아닌 경우 빈 화면 반환
  if (!user || user.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="security" size={48} color={pastelGreenColors[300]} />
          <Text style={styles.accessDeniedText}>접근 권한이 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[pastelGreenColors[500]]}
            tintColor={pastelGreenColors[500]}
          />
        }
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="settings" size={24} color={pastelGreenColors[600]} />
              <Text style={styles.headerTitle}>관리자 대시보드</Text>
            </View>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={loadStats}
              disabled={isLoading}
            >
              <MaterialIcons 
                name="refresh" 
                size={20} 
                color={pastelGreenColors[600]} 
                style={isLoading ? styles.rotating : undefined}
              />
              <Text style={styles.refreshButtonText}>
                {isLoading ? '로딩 중...' : '통계 새로고침'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>
            인스쿨즈 시스템 관리 및 통계를 확인하세요.
          </Text>
        </View>

        {/* 통계 카드들 */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: pastelGreenColors[50] }]}>
              <MaterialIcons name="person" size={20} color={pastelGreenColors[600]} />
              <Text style={styles.statNumber}>
                {isLoading ? '로딩 중...' : stats?.totalUsers.toLocaleString() || '0'}
              </Text>
              <Text style={styles.statLabel}>총 사용자 수</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: pastelGreenColors[50] }]}>
              <MaterialIcons name="article" size={20} color={pastelGreenColors[600]} />
              <Text style={styles.statNumber}>
                {isLoading ? '로딩 중...' : stats?.totalPosts.toLocaleString() || '0'}
              </Text>
              <Text style={styles.statLabel}>총 게시글 수</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: pastelGreenColors[100] }]}>
              <MaterialIcons name="message" size={20} color={pastelGreenColors[700]} />
              <Text style={styles.statNumber}>
                {isLoading ? '로딩 중...' : stats?.totalComments.toLocaleString() || '0'}
              </Text>
              <Text style={styles.statLabel}>총 댓글 수</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
              <MaterialIcons name="report" size={20} color="#ef4444" />
              <Text style={[styles.statNumber, { color: '#ef4444' }]}>
                {isLoading ? '로딩 중...' : stats?.pendingReports.toLocaleString() || '0'}
              </Text>
              <Text style={styles.statLabel}>신고 건수</Text>
            </View>
          </View>
        </View>

        {/* 관리 메뉴 */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>관리 메뉴</Text>
          <Text style={styles.menuSubtitle}>
            시스템 설정 및 관리 기능에 빠르게 접근하세요.
          </Text>
          <View style={styles.menuGrid}>
            {adminMenuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  !item.enabled && styles.menuItemDisabled
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
                disabled={!item.enabled}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}15` }]}>
                  <MaterialIcons name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={[
                    styles.menuItemTitle,
                    !item.enabled && styles.menuItemTitleDisabled
                  ]}>
                    {item.title}
                  </Text>
                  <Text style={[
                    styles.menuItemDescription,
                    !item.enabled && styles.menuItemDescriptionDisabled
                  ]}>
                    {item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: pastelGreenColors[600],
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
  },
  refreshButtonText: {
    fontSize: 12,
    color: pastelGreenColors[600],
    fontWeight: '500',
  },
  rotating: {
    // 회전 애니메이션은 React Native에서 별도 구현 필요
  },
  headerSubtitle: {
    fontSize: 14,
    color: pastelGreenColors[600],
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  statLabel: {
    fontSize: 12,
    color: pastelGreenColors[600],
    textAlign: 'center',
  },
  menuContainer: {
    padding: 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  menuSubtitle: {
    fontSize: 14,
    color: pastelGreenColors[600],
    marginBottom: 16,
  },
  menuGrid: {
    gap: 12,
  },
  menuItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelGreenColors[800],
    marginBottom: 2,
  },
  menuItemTitleDisabled: {
    color: pastelGreenColors[500],
  },
  menuItemDescription: {
    fontSize: 12,
    color: pastelGreenColors[600],
  },
  menuItemDescriptionDisabled: {
    color: pastelGreenColors[400],
  },
}); 