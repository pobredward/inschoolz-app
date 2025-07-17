import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  Switch,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { 
  getUsersList, 
  updateUserRole, 
  updateUserStatus, 
  updateUserExperienceAdmin, 
  addUserWarning, 
  deleteUser, 
  bulkUpdateUsers,
  AdminUserListParams
} from '@/lib/users';
import { User } from '@/types'; // 통일된 타입 사용

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

interface AdminUsersScreenProps {}

export default function AdminUsersScreen({}: AdminUsersScreenProps) {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'user'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastActiveAt' | 'totalExperience' | 'userName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // 사용자 목록 로드
  const loadUsers = async (page = 1, append = false) => {
    try {
      if (!append) setLoading(true);
      
      const params: AdminUserListParams = {
        page,
        pageSize: 20,
        search: searchQuery,
        role: selectedRole,
        status: selectedStatus,
        sortBy,
        sortOrder,
      };

      const response = await getUsersList(params);
      
      if (append) {
        setUsers(prev => [...prev, ...response.users]);
      } else {
        setUsers(response.users);
      }
      
      setHasMore(response.hasMore);
      setCurrentPage(response.currentPage);
      setTotalCount(response.totalCount);
    } catch (error) {
      console.error('사용자 목록 로드 오류:', error);
      Alert.alert('오류', '사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadUsers();
  }, [searchQuery, selectedRole, selectedStatus, sortBy, sortOrder]);

  // 새로고침
  const onRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    loadUsers(1, false);
  };

  // 더 많은 사용자 로드
  const loadMoreUsers = () => {
    if (hasMore && !loading) {
      loadUsers(currentPage + 1, true);
    }
  };

  // 사용자 역할 변경
  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await updateUserRole(userId, newRole);
      Alert.alert('성공', '사용자 역할이 변경되었습니다.');
      loadUsers(1, false);
    } catch (error) {
      console.error('역할 변경 오류:', error);
      Alert.alert('오류', '역할 변경 중 오류가 발생했습니다.');
    }
  };

  // 사용자 상태 변경
  const handleUpdateStatus = async (userId: string, newStatus: 'active' | 'inactive' | 'suspended', reason?: string) => {
    try {
      await updateUserStatus(userId, newStatus, reason);
      Alert.alert('성공', '사용자 상태가 변경되었습니다.');
      loadUsers(1, false);
    } catch (error) {
      console.error('상태 변경 오류:', error);
      Alert.alert('오류', '상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 사용자 경험치 변경
  const handleUpdateExperience = async (userId: string, newExperience: number, reason: string) => {
    try {
      await updateUserExperienceAdmin(userId, newExperience, reason);
      Alert.alert('성공', '사용자 경험치가 변경되었습니다.');
      loadUsers(1, false);
    } catch (error) {
      console.error('경험치 변경 오류:', error);
      Alert.alert('오류', '경험치 변경 중 오류가 발생했습니다.');
    }
  };

  // 사용자 경고 추가
  const handleAddWarning = async (userId: string, reason: string, severity: 'low' | 'medium' | 'high') => {
    try {
      await addUserWarning(userId, reason, severity);
      Alert.alert('성공', '사용자에게 경고가 추가되었습니다.');
      loadUsers(1, false);
    } catch (error) {
      console.error('경고 추가 오류:', error);
      Alert.alert('오류', '경고 추가 중 오류가 발생했습니다.');
    }
  };

  // 사용자 삭제
  const handleDeleteUser = async (userId: string) => {
    Alert.alert(
      '사용자 삭제',
      '정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(userId);
              Alert.alert('성공', '사용자가 삭제되었습니다.');
              loadUsers(1, false);
            } catch (error) {
              console.error('사용자 삭제 오류:', error);
              Alert.alert('오류', '사용자 삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  // 사용자 선택 토글
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // 모든 사용자 선택 토글
  const toggleAllSelection = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user.uid));
    }
  };

  // 일괄 작업 실행
  const handleBulkAction = async (action: 'role' | 'status', value: string, reason?: string) => {
    try {
      if (action === 'role') {
        await bulkUpdateUsers(selectedUsers, { role: value as 'admin' | 'user' });
      } else if (action === 'status') {
        await bulkUpdateUsers(selectedUsers, { status: value as 'active' | 'inactive' | 'suspended', reason });
      }
      
      Alert.alert('성공', '일괄 작업이 완료되었습니다.');
      setSelectedUsers([]);
      setShowBulkActionModal(false);
      loadUsers(1, false);
    } catch (error) {
      console.error('일괄 작업 오류:', error);
      Alert.alert('오류', '일괄 작업 중 오류가 발생했습니다.');
    }
  };

  // 사용자 아이템 렌더링
  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      <View style={styles.userItemHeader}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleUserSelection(item.uid)}
        >
          {selectedUsers.includes(item.uid) && (
            <MaterialIcons name="check" size={16} color={pastelGreenColors[600]} />
          )}
        </TouchableOpacity>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.profile.userName}</Text>
          {item.profile.realName && (
            <Text style={styles.realName}>({item.profile.realName})</Text>
          )}
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        
        <View style={styles.userBadges}>
          <Text style={[styles.badge, styles.roleBadge]}>
            {item.role === 'admin' ? '관리자' : '사용자'}
          </Text>
          <Text style={[styles.badge, styles.levelBadge]}>
            Lv.{item.stats?.level || 1}
          </Text>
        </View>
      </View>
      
      <View style={styles.userStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>경험치</Text>
          <Text style={styles.statValue}>{item.stats?.totalExperience || 0}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>게시글</Text>
          <Text style={styles.statValue}>{item.stats?.postCount || 0}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>댓글</Text>
          <Text style={styles.statValue}>{item.stats?.commentCount || 0}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>좋아요</Text>
          <Text style={styles.statValue}>{item.stats?.likeCount || 0}</Text>
        </View>
      </View>
      
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => {
            // 사용자 상세 편집 모달 열기
            Alert.alert('준비중', '사용자 편집 기능은 준비중입니다.');
          }}
        >
          <MaterialIcons name="edit" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>편집</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteUser(item.uid)}
        >
          <MaterialIcons name="delete" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 관리자 권한 확인
  if (!user || user.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={48} color={pastelGreenColors[500]} />
          <Text style={styles.errorText}>관리자 권한이 필요합니다.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>사용자 관리</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialIcons name="filter-list" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* 검색 및 통계 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="사용자 이름으로 검색..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#666"
          />
        </View>
        
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>총 {totalCount}명</Text>
          {selectedUsers.length > 0 && (
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={() => setShowBulkActionModal(true)}
            >
              <Text style={styles.bulkActionText}>
                {selectedUsers.length}명 선택됨
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 사용자 목록 */}
      <FlatList
        data={users}
        renderItem={renderUserItem}
        keyExtractor={item => item.uid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreUsers}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="people" size={48} color="#ccc" />
            <Text style={styles.emptyText}>사용자가 없습니다.</Text>
          </View>
        }
        ListHeaderComponent={
          selectedUsers.length > 0 ? (
            <View style={styles.selectionHeader}>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={toggleAllSelection}
              >
                <Text style={styles.selectAllText}>
                  {selectedUsers.length === users.length ? '전체 해제' : '전체 선택'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* 필터 모달 */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>필터</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>역할</Text>
              <View style={styles.filterOptions}>
                {['all', 'admin', 'user'].map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.filterOption,
                      selectedRole === role && styles.filterOptionSelected
                    ]}
                    onPress={() => setSelectedRole(role as any)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      selectedRole === role && styles.filterOptionTextSelected
                    ]}>
                      {role === 'all' ? '전체' : role === 'admin' ? '관리자' : '사용자'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>상태</Text>
              <View style={styles.filterOptions}>
                {['all', 'active', 'inactive', 'suspended'].map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterOption,
                      selectedStatus === status && styles.filterOptionSelected
                    ]}
                    onPress={() => setSelectedStatus(status as any)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      selectedStatus === status && styles.filterOptionTextSelected
                    ]}>
                      {status === 'all' ? '전체' : 
                       status === 'active' ? '활성' : 
                       status === 'inactive' ? '비활성' : '정지'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>정렬</Text>
              <View style={styles.filterOptions}>
                {[
                  { key: 'createdAt', label: '가입일' },
                  { key: 'lastActiveAt', label: '마지막 활동' },
                  { key: 'totalExperience', label: '경험치' },
                  { key: 'userName', label: '이름' }
                ].map(sort => (
                  <TouchableOpacity
                    key={sort.key}
                    style={[
                      styles.filterOption,
                      sortBy === sort.key && styles.filterOptionSelected
                    ]}
                    onPress={() => setSortBy(sort.key as any)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      sortBy === sort.key && styles.filterOptionTextSelected
                    ]}>
                      {sort.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>순서</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    sortOrder === 'desc' && styles.filterOptionSelected
                  ]}
                  onPress={() => setSortOrder('desc')}
                >
                  <Text style={[
                    styles.filterOptionText,
                    sortOrder === 'desc' && styles.filterOptionTextSelected
                  ]}>
                    내림차순
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    sortOrder === 'asc' && styles.filterOptionSelected
                  ]}
                  onPress={() => setSortOrder('asc')}
                >
                  <Text style={[
                    styles.filterOptionText,
                    sortOrder === 'asc' && styles.filterOptionTextSelected
                  ]}>
                    오름차순
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 일괄 작업 모달 */}
      <Modal
        visible={showBulkActionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBulkActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>일괄 작업</Text>
              <TouchableOpacity onPress={() => setShowBulkActionModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.bulkActionDescription}>
              {selectedUsers.length}명의 사용자에 대해 일괄 작업을 수행합니다.
            </Text>
            
            <View style={styles.bulkActionButtons}>
              <TouchableOpacity
                style={[styles.bulkActionButton, styles.roleButton]}
                onPress={() => {
                  Alert.alert(
                    '역할 변경',
                    '선택된 사용자들의 역할을 변경하시겠습니까?',
                    [
                      { text: '취소', style: 'cancel' },
                      { text: '관리자로', onPress: () => handleBulkAction('role', 'admin') },
                      { text: '사용자로', onPress: () => handleBulkAction('role', 'user') },
                    ]
                  );
                }}
              >
                <Text style={styles.bulkActionButtonText}>역할 변경</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.bulkActionButton, styles.statusButton]}
                onPress={() => {
                  Alert.alert(
                    '상태 변경',
                    '선택된 사용자들의 상태를 변경하시겠습니까?',
                    [
                      { text: '취소', style: 'cancel' },
                      { text: '활성화', onPress: () => handleBulkAction('status', 'active') },
                      { text: '비활성화', onPress: () => handleBulkAction('status', 'inactive') },
                      { text: '정지', onPress: () => handleBulkAction('status', 'suspended') },
                    ]
                  );
                }}
              >
                <Text style={styles.bulkActionButtonText}>상태 변경</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pastelGreenColors[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  filterButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'column', // Changed to column for better layout
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pastelGreenColors[50],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: pastelGreenColors[800],
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statsText: {
    fontSize: 14,
    color: pastelGreenColors[600],
  },

  bulkActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userItem: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  realName: {
    fontSize: 14,
    color: pastelGreenColors[600],
    marginTop: 2,
  },
  userEmail: {
    fontSize: 14,
    color: pastelGreenColors[600],
    marginTop: 2,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadge: {
    backgroundColor: pastelGreenColors[600],
    borderWidth: 1,
    borderColor: pastelGreenColors[600],
  },
  levelBadge: {
    backgroundColor: pastelGreenColors[400],
    borderWidth: 1,
    borderColor: pastelGreenColors[400],
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: pastelGreenColors[600],
    marginTop: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: pastelGreenColors[500],
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    flex: 1,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: pastelGreenColors[100],
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: pastelGreenColors[500],
    borderRadius: 8,
  },
  selectAllText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: pastelGreenColors[600],
    marginTop: 12,
    textAlign: 'center',
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: pastelGreenColors[100],
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
  },
  filterOptionSelected: {
    backgroundColor: pastelGreenColors[500],
    borderColor: pastelGreenColors[600],
  },
  filterOptionText: {
    fontSize: 14,
    color: pastelGreenColors[700],
  },
  filterOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  bulkActionDescription: {
    fontSize: 14,
    color: pastelGreenColors[600],
    textAlign: 'center',
    marginBottom: 20,
  },
  bulkActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  bulkActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleButton: {
    backgroundColor: pastelGreenColors[500],
  },
  statusButton: {
    backgroundColor: pastelGreenColors[400],
  },
  bulkActionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: pastelGreenColors[400],
    marginTop: 12,
  },
}); 