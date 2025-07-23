import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  Alert, 
  ActivityIndicator,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { getBlockedUsers, toggleBlock } from '../lib/users';
import { formatRelativeTime } from '../utils/timeUtils';

interface BlockedUser {
  uid: string;
  profile?: {
    userName?: string;
    profileImageUrl?: string;
  };
  stats?: {
    level?: number;
  };
  school?: {
    name?: string;
  };
  blockedAt?: any;
}

export default function BlockedUsersScreen() {
  const { user } = useAuthStore();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingUser, setUnblockingUser] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const loadBlockedUsers = async (isRefresh = false) => {
    if (!user?.uid) return;

    if (!isRefresh) setLoading(true);
    try {
      const response = await getBlockedUsers(user.uid, 1, 50); // 첫 페이지만 로드
      setBlockedUsers(response.users);
      setTotalCount(response.totalCount);
    } catch (error) {
      console.error('차단된 사용자 목록 조회 실패:', error);
      Alert.alert('오류', '차단된 사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnblock = async (targetUserId: string, targetUserName: string) => {
    if (!user) return;

    Alert.alert(
      '차단 해제',
      `${targetUserName}님을 차단 해제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단 해제',
          style: 'destructive',
          onPress: async () => {
            setUnblockingUser(targetUserId);
            try {
              await toggleBlock(user.uid, targetUserId);
              setBlockedUsers(prev => prev.filter(u => u.uid !== targetUserId));
              setTotalCount(prev => prev - 1);
              Alert.alert('완료', `${targetUserName}님을 차단 해제했습니다.`);
            } catch (error) {
              console.error('차단 해제 실패:', error);
              Alert.alert('오류', '차단 해제에 실패했습니다.');
            } finally {
              setUnblockingUser(null);
            }
          }
        }
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBlockedUsers(true);
  };

  useEffect(() => {
    if (user) {
      loadBlockedUsers();
    }
  }, [user]);

  const renderBlockedUser = (blockedUser: BlockedUser) => (
    <View key={blockedUser.uid} style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          {blockedUser.profile?.profileImageUrl ? (
            <Image 
              source={{ uri: blockedUser.profile.profileImageUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={24} color="#9ca3af" />
          )}
        </View>
        
        <View style={styles.userDetails}>
          <View style={styles.userHeader}>
            <Text style={styles.userName}>
              {blockedUser.profile?.userName || '사용자'}
            </Text>
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedBadgeText}>차단됨</Text>
            </View>
          </View>
          
          <View style={styles.userMeta}>
            <Text style={styles.userLevel}>
              Lv.{blockedUser.stats?.level || 1}
            </Text>
            {blockedUser.school?.name && (
              <Text style={styles.userSchool}>
                {blockedUser.school.name}
              </Text>
            )}
          </View>
          
          {blockedUser.blockedAt && (
            <Text style={styles.blockedTime}>
              {formatRelativeTime(blockedUser.blockedAt)} 차단
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push(`/users/${blockedUser.uid}`)}
        >
          <Text style={styles.profileButtonText}>프로필</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.unblockButton, unblockingUser === blockedUser.uid && styles.unblockButtonDisabled]}
          onPress={() => handleUnblock(blockedUser.uid, blockedUser.profile?.userName || '사용자')}
          disabled={unblockingUser === blockedUser.uid}
        >
          {unblockingUser === blockedUser.uid ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Text style={styles.unblockButtonText}>차단 해제</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>차단된 사용자</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>차단된 사용자 목록을 불러오는 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  return (
    <SafeScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>차단된 사용자</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 안내 메시지 */}
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="shield-checkmark" size={20} color="#3b82f6" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>차단 기능 안내</Text>
            <Text style={styles.infoDescription}>
              차단된 사용자의 게시글과 댓글은 "차단한 사용자입니다"로 표시되며, 
              필요시 내용을 확인하거나 차단을 해제할 수 있습니다.
            </Text>
          </View>
        </View>

        {/* 통계 */}
        <View style={styles.statsCard}>
          <Text style={styles.statsText}>
            총 {totalCount}명의 사용자를 차단했습니다
          </Text>
        </View>

        {/* 차단된 사용자 목록 */}
        {blockedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark" size={48} color="#9ca3af" />
            <Text style={styles.emptyTitle}>차단된 사용자가 없습니다</Text>
            <Text style={styles.emptyDescription}>
              아직 차단한 사용자가 없습니다.
            </Text>
          </View>
        ) : (
          <View style={styles.userList}>
            {blockedUsers.map(renderBlockedUser)}
          </View>
        )}
      </ScrollView>
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  userList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userDetails: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  blockedBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  blockedBadgeText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userLevel: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 16,
  },
  userSchool: {
    fontSize: 14,
    color: '#6b7280',
  },
  blockedTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  profileButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  profileButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fff',
    minWidth: 80,
    alignItems: 'center',
  },
  unblockButtonDisabled: {
    opacity: 0.6,
  },
  unblockButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 