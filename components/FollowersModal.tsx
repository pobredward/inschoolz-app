import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { User } from '../types';
import { getFollowers, getFollowings } from '../lib/users';

interface FollowersModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
  title: string;
}

export default function FollowersModal({ visible, onClose, userId, type, title }: FollowersModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!visible || !userId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      let result;
      if (type === 'followers') {
        result = await getFollowers(userId, 1, 50);
      } else {
        result = await getFollowings(userId, 1, 50);
      }
      
      console.log('팔로워/팔로잉 데이터 로드 완료:', result.users?.length || 0, '명');
      console.log('첫 번째 사용자 프로필:', result.users?.[0]?.profile);
      
      setUsers(result.users || []);
      setFilteredUsers(result.users || []);
    } catch (error) {
      console.error(`${type} 목록 조회 오류:`, error);
      setError(`${title} 목록을 불러오는 중 오류가 발생했습니다.`);
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 필터링
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => {
        const userName = user.profile?.userName?.toLowerCase() || '';
        const schoolName = user.school?.name?.toLowerCase() || '';
        const region = `${user.regions?.sido || ''} ${user.regions?.sigungu || ''}`.toLowerCase();
        
        return userName.includes(searchQuery.toLowerCase()) ||
               schoolName.includes(searchQuery.toLowerCase()) ||
               region.includes(searchQuery.toLowerCase());
      });
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    fetchUsers();
  }, [visible, userId, type]);

  const handleClose = () => {
    setSearchQuery('');
    setUsers([]);
    setFilteredUsers([]);
    setError(null);
    onClose();
  };

  const handleUserPress = (user: User) => {
    handleClose();
    router.push(`/users/${user.uid}`);
  };

  // 안전한 데이터 접근 함수들
  const getSchoolInfo = (user: User) => {
    if (!user.school?.name) return null;
    
    let schoolInfo = user.school.name;
    if (user.school.grade && user.school.classNumber) {
      schoolInfo += ` (${user.school.grade}학년 ${user.school.classNumber}반)`;
    }
    return schoolInfo;
  };

  const getRegionInfo = (user: User) => {
    if (!user.regions?.sido) return null;
    return `${user.regions.sido} ${user.regions.sigungu || ''}`.trim();
  };

  const renderUserItem = ({ item: user }: { item: User }) => {
    const schoolInfo = getSchoolInfo(user);
    const regionInfo = getRegionInfo(user);
    
    // 디버깅: 프로필 이미지 URL 확인
    if (user.profile?.profileImageUrl) {
      console.log('사용자 프로필 이미지 URL:', user.profile.profileImageUrl);
    }

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleUserPress(user)}
      >
        {/* 프로필 이미지 */}
        <View style={styles.profileImageContainer}>
          {user.profile?.profileImageUrl ? (
            <Image
              source={{ uri: user.profile.profileImageUrl }}
              style={styles.profileImage}
              onError={() => {
                console.warn('프로필 이미지 로드 실패, 기본 아이콘 표시');
              }}
            />
          ) : (
            <Ionicons name="person-circle" size={48} color="#10B981" />
          )}
        </View>

        {/* 사용자 정보 */}
        <View style={styles.userInfo}>
          {/* 유저네임과 배지 */}
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.profile?.userName || '익명'}
            </Text>
            {user.role === 'admin' && (
              <View style={[styles.badge, styles.adminBadge]}>
                <Text style={styles.badgeText}>관리자</Text>
              </View>
            )}
            {user.role === 'teacher' && (
              <View style={[styles.badge, styles.teacherBadge]}>
                <Text style={styles.badgeText}>선생님</Text>
              </View>
            )}
            {user.isVerified && (
              <View style={[styles.badge, styles.verifiedBadge]}>
                <Text style={styles.badgeText}>인증</Text>
              </View>
            )}
          </View>

          {/* 학교 정보 */}
          {schoolInfo && (
            <View style={styles.infoRow}>
              <Ionicons name="school" size={12} color="#3B82F6" />
              <Text style={styles.infoText} numberOfLines={1}>
                {schoolInfo}
              </Text>
            </View>
          )}

          {/* 지역 정보 */}
          {regionInfo && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={12} color="#EF4444" />
              <Text style={styles.infoText} numberOfLines={1}>
                {regionInfo}
              </Text>
            </View>
          )}

          {/* 정보가 없는 경우 */}
          {!schoolInfo && !regionInfo && (
            <Text style={styles.noInfoText}>정보 없음</Text>
          )}
        </View>

        {/* 화살표 아이콘 */}
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people" size={64} color="#D1D5DB" />
      {searchQuery ? (
        <View style={styles.emptyTextContainer}>
          <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
          <Text style={styles.emptySubtitle}>"{searchQuery}"에 대한 결과를 찾을 수 없습니다.</Text>
        </View>
      ) : (
        <View style={styles.emptyTextContainer}>
          <Text style={styles.emptyTitle}>{title}가 없습니다</Text>
          <Text style={styles.emptySubtitle}>아직 {title}가 없습니다.</Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 검색창 */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="이름, 학교, 지역으로 검색..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* 콘텐츠 */}
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>불러오는 중...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchUsers}>
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.uid}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={filteredUsers.length === 0 ? styles.emptyListContainer : undefined}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  adminBadge: {
    backgroundColor: '#FEE2E2',
  },
  teacherBadge: {
    backgroundColor: '#DBEAFE',
  },
  verifiedBadge: {
    backgroundColor: '#D1FAE5',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    flex: 1,
  },
  noInfoText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTextContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyListContainer: {
    flex: 1,
  },
}); 