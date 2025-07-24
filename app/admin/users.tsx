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
  getEnhancedUsersList, 
  updateUserRole, 
  updateUserStatusEnhanced, 
  updateUserExperienceAdmin, 
  addUserWarning, 
  deleteUser, 
  bulkUpdateUsers,
} from '@/lib/users';
import { EnhancedAdminUserListParams, SuspensionSettings } from '@/types/admin';
import { User } from '@/types';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // 개선된 필터 상태 (Web과 동일)
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'userName' | 'realName' | 'email' | 'school'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastActiveAt' | 'totalExperience' | 'userName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 고급 필터 상태 (Web과 동일)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [levelRange, setLevelRange] = useState<{ min?: number; max?: number }>({});
  const [experienceRange, setExperienceRange] = useState<{ min?: number; max?: number }>({});
  const [regionFilter, setRegionFilter] = useState<{ sido?: string; sigungu?: string }>({});
  const [hasWarnings, setHasWarnings] = useState<boolean | undefined>(undefined);
  
  // 모달 상태들
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  
  // 선택된 사용자 및 폼 상태
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [warningForm, setWarningForm] = useState({ reason: '' });
  const [experienceForm, setExperienceForm] = useState({ totalExperience: 0, reason: '' });
  const [suspensionForm, setSuspensionForm] = useState<SuspensionSettings>({
    type: 'temporary',
    duration: 7,
    reason: '',
    autoRestore: true,
    notifyUser: true
  });

  // 사용자 목록 로드 (Web과 동일한 로직)
  const loadUsers = async (params: EnhancedAdminUserListParams = {}) => {
    setLoading(true);
    try {
      const response = await getEnhancedUsersList({
        page: currentPage,
        pageSize: 20,
        search: searchTerm,
        searchType,
        role: roleFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
        dateRange: (dateRange.from && dateRange.to) ? { from: dateRange.from, to: dateRange.to } : undefined,
        levelRange: (levelRange.min !== undefined && levelRange.max !== undefined) ? { min: levelRange.min, max: levelRange.max } : undefined,
        experienceRange: (experienceRange.min !== undefined && experienceRange.max !== undefined) ? { min: experienceRange.min, max: experienceRange.max } : undefined,
        regions: regionFilter.sido || regionFilter.sigungu ? regionFilter : undefined,
        hasWarnings,
        ...params
      });
      
      setUsers(response.users);
      setTotalCount(response.totalCount);
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('사용자 목록 로드 오류:', err);
      Alert.alert('오류', '사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentPage, searchTerm, searchType, roleFilter, statusFilter, sortBy, sortOrder, dateRange, levelRange, experienceRange, regionFilter, hasWarnings]);

  // 새로고침
  const onRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    loadUsers({ page: 1 });
  };

  // 더 많은 사용자 로드
  const loadMoreUsers = () => {
    if (hasMore && !loading) {
      loadUsers({ page: currentPage + 1 });
      setCurrentPage(currentPage + 1);
    }
  };

  // 검색 핸들러
  const handleSearch = () => {
    setCurrentPage(1);
    loadUsers({ page: 1 });
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

  // 사용자 역할 변경 (Web과 동일)
  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await updateUserRole(userId, newRole);
      Alert.alert('성공', '사용자 역할이 변경되었습니다.');
      loadUsers();
    } catch (error) {
      console.error('역할 변경 오류:', error);
      Alert.alert('오류', '역할 변경 중 오류가 발생했습니다.');
    }
  };

  // 사용자 상태 변경 (Web과 동일한 로직)
  const handleUpdateStatus = async (userId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    if (newStatus === 'suspended') {
      // 정지의 경우 상세 설정 모달 열기
      const user = users.find(u => u.uid === userId);
      if (user) {
        setSelectedUser(user);
        setShowSuspensionModal(true);
      }
    } else {
      try {
        await updateUserStatusEnhanced(userId, newStatus, undefined, user?.uid);
        Alert.alert('성공', '사용자 상태가 변경되었습니다.');
        loadUsers();
      } catch (error) {
        console.error('상태 변경 오류:', error);
        Alert.alert('오류', '상태 변경 중 오류가 발생했습니다.');
      }
    }
  };

  // 정지 처리 (Web과 동일)
  const handleSuspension = async () => {
    if (!selectedUser) return;
    
    // 입력 유효성 검사
    if (!suspensionForm.reason.trim()) {
      Alert.alert('입력 오류', '정지 사유를 입력해주세요.');
      return;
    }
    
    if (suspensionForm.type === 'temporary' && (!suspensionForm.duration || suspensionForm.duration < 1)) {
      Alert.alert('입력 오류', '정지 기간은 1일 이상이어야 합니다.');
      return;
    }
    
    try {
      const updatedSuspensionForm = {
        ...suspensionForm,
        reason: suspensionForm.reason.trim()
      };
      
      await updateUserStatusEnhanced(selectedUser.uid, 'suspended', updatedSuspensionForm, user?.uid);
      Alert.alert('성공', '사용자가 정지되었습니다.');
      setShowSuspensionModal(false);
      setSelectedUser(null);
      setSuspensionForm({
        type: 'temporary',
        duration: 7,
        reason: '',
        autoRestore: true,
        notifyUser: true
      });
      loadUsers();
    } catch (error) {
      console.error('사용자 정지 오류:', error);
      Alert.alert('오류', '사용자 정지 중 오류가 발생했습니다.');
    }
  };

  // 경고 추가 (Web과 동일)
  const handleAddWarning = async () => {
    if (!selectedUser) return;
    
    // 입력 유효성 검사
    if (!warningForm.reason.trim()) {
      Alert.alert('입력 오류', '경고 사유를 입력해주세요.');
      return;
    }
    
    try {
      await addUserWarning(selectedUser.uid, warningForm.reason.trim());
      Alert.alert('성공', '경고가 추가되었습니다.');
      setShowWarningModal(false);
      setSelectedUser(null);
      setWarningForm({ reason: '' });
      loadUsers();
    } catch (error) {
      console.error('경고 추가 오류:', error);
      Alert.alert('오류', '경고 추가 중 오류가 발생했습니다.');
    }
  };

  // 경험치 수정 (Web과 동일)
  const handleUpdateExperience = async () => {
    if (!selectedUser) return;
    
    // 입력 유효성 검사
    if (!experienceForm.reason.trim()) {
      Alert.alert('입력 오류', '수정 사유를 입력해주세요.');
      return;
    }
    
    if (experienceForm.totalExperience < 0) {
      Alert.alert('입력 오류', '경험치는 0 이상이어야 합니다.');
      return;
    }
    
    try {
      await updateUserExperienceAdmin(selectedUser.uid, experienceForm.totalExperience, experienceForm.reason.trim());
      Alert.alert('성공', '경험치가 수정되었습니다.');
      setShowExperienceModal(false);
      setSelectedUser(null);
      setExperienceForm({ totalExperience: 0, reason: '' });
      loadUsers();
    } catch (error) {
      console.error('경험치 수정 오류:', error);
      Alert.alert('오류', '경험치 수정 중 오류가 발생했습니다.');
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
              loadUsers();
            } catch (error) {
              console.error('사용자 삭제 오류:', error);
              Alert.alert('오류', '사용자 삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  // 일괄 작업 실행 (Web과 동일한 로직)
  const handleBulkAction = async (action: 'role' | 'status', value: string, settings?: SuspensionSettings) => {
    try {
      if (action === 'role') {
        await bulkUpdateUsers(selectedUsers, { role: value as 'admin' | 'user' });
      } else if (action === 'status') {
        if (value === 'suspended' && settings) {
          // 정지의 경우 설정 포함
          for (const userId of selectedUsers) {
            await updateUserStatusEnhanced(userId, 'suspended', settings, user?.uid);
          }
        } else {
          await bulkUpdateUsers(selectedUsers, { status: value as 'active' | 'inactive' | 'suspended' });
        }
      }
      
      Alert.alert('성공', '일괄 작업이 완료되었습니다.');
      setSelectedUsers([]);
      setShowBulkActionModal(false);
      loadUsers();
    } catch (error) {
      console.error('일괄 작업 오류:', error);
      Alert.alert('오류', '일괄 작업 중 오류가 발생했습니다.');
    }
  };

  // CSV 내보내기 (새로 추가)
  const exportToCSV = async () => {
    try {
      Alert.alert('정보', 'CSV 내보내기를 준비 중입니다...');
      
      // 현재 필터 조건으로 모든 사용자 가져오기
      const response = await getEnhancedUsersList({
        page: 1,
        pageSize: 10000, // 대량 데이터
        search: searchTerm,
        searchType,
        role: roleFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
        dateRange: (dateRange.from && dateRange.to) ? { from: dateRange.from, to: dateRange.to } : undefined,
        levelRange: (levelRange.min !== undefined && levelRange.max !== undefined) ? { min: levelRange.min, max: levelRange.max } : undefined,
        experienceRange: (experienceRange.min !== undefined && experienceRange.max !== undefined) ? { min: experienceRange.min, max: experienceRange.max } : undefined,
        regions: regionFilter.sido || regionFilter.sigungu ? regionFilter : undefined,
        hasWarnings,
      });

      // CSV 헤더
      const headers = [
        'ID',
        '사용자명',
        '실명',
        '이메일',
        '역할',
        '상태',
        '레벨',
        '경험치',
        '게시글 수',
        '댓글 수',
        '좋아요 수',
        '경고 수',
        '학교',
        '지역',
        '가입일'
      ];

      // CSV 데이터 생성
      const csvData = response.users.map(user => [
        user.uid,
        user.profile?.userName || '',
        user.profile?.realName || '',
        user.email || '',
        user.role === 'admin' ? '관리자' : '일반 사용자',
        user.status === 'active' ? '활성' : user.status === 'inactive' ? '비활성' : '정지',
        user.stats?.level || 1,
        user.stats?.totalExperience || 0,
        user.stats?.postCount || 0,
        user.stats?.commentCount || 0,
        user.stats?.likeCount || 0,
                 (user as any).warnings?.count || 0,
         user.school?.name || '',
         user.regions ? `${user.regions.sido || ''} ${user.regions.sigungu || ''}`.trim() : '',
         user.profile?.createdAt ? new Date((user.profile.createdAt as any).seconds * 1000).toLocaleDateString() : ''
      ]);

      // CSV 문자열 생성
      const csvContent = [headers, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      // 파일 저장
      const filename = `inschoolz_users_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // 파일 공유
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        Alert.alert('성공', `${response.users.length}명의 사용자 데이터가 내보내졌습니다.`);
      } else {
        Alert.alert('오류', '파일 공유를 지원하지 않는 기기입니다.');
      }
    } catch (error) {
      console.error('CSV 내보내기 오류:', error);
      Alert.alert('오류', 'CSV 내보내기 중 오류가 발생했습니다.');
    }
  };

  // 모든 필터 초기화
  const clearAllFilters = () => {
    setSearchTerm('');
    setSearchType('all');
    setRoleFilter('all');
    setStatusFilter('all');
    setDateRange({});
    setLevelRange({});
    setExperienceRange({});
    setRegionFilter({});
    setHasWarnings(undefined);
    setCurrentPage(1);
  };

  // 사용자 아이템 렌더링 (개선된 버전)
  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      <View style={styles.userItemHeader}>
        <TouchableOpacity
          style={[styles.checkbox, selectedUsers.includes(item.uid) && styles.checkboxSelected]}
          onPress={() => toggleUserSelection(item.uid)}
        >
          {selectedUsers.includes(item.uid) && (
            <MaterialIcons name="check" size={16} color="white" />
          )}
        </TouchableOpacity>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.profile?.userName || 'Unknown'}</Text>
          {item.profile?.realName && (
            <Text style={styles.realName}>({item.profile.realName})</Text>
          )}
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.school?.name && (
            <Text style={styles.schoolName}>{item.school.name}</Text>
          )}
          {item.regions && (
            <Text style={styles.regionName}>
              {`${item.regions.sido || ''} ${item.regions.sigungu || ''}`.trim()}
            </Text>
          )}
        </View>
        
        <View style={styles.userBadges}>
          <View style={[styles.badge, item.role === 'admin' ? styles.adminBadge : styles.userBadge]}>
            <Text style={styles.badgeText}>
              {item.role === 'admin' ? '관리자' : '일반 사용자'}
            </Text>
          </View>
          <View style={[styles.badge, 
            item.status === 'active' ? styles.activeBadge : 
            item.status === 'suspended' ? styles.suspendedBadge : styles.inactiveBadge
          ]}>
            <Text style={styles.badgeText}>
              {item.status === 'active' ? '활성' : 
               item.status === 'suspended' ? '정지' : '비활성'}
            </Text>
          </View>
          <View style={[styles.badge, styles.levelBadge]}>
            <Text style={styles.badgeText}>Lv.{item.stats?.level || 1}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.userStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.stats?.totalExperience || 0}</Text>
          <Text style={styles.statLabel}>경험치</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.stats?.postCount || 0}</Text>
          <Text style={styles.statLabel}>게시글</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.stats?.commentCount || 0}</Text>
          <Text style={styles.statLabel}>댓글</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.stats?.likeCount || 0}</Text>
          <Text style={styles.statLabel}>좋아요</Text>
        </View>
                 <View style={styles.statItem}>
           <Text style={[styles.statValue, ((item as any).warnings?.count || 0) > 0 && { color: pastelGreenColors[600] }]}>
             {(item as any).warnings?.count || 0}
           </Text>
           <Text style={styles.statLabel}>경고</Text>
         </View>
      </View>
      
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.warningButton]}
          onPress={() => {
            setSelectedUser(item);
            setShowWarningModal(true);
          }}
        >
          <MaterialIcons name="warning" size={16} color="white" />
          <Text style={styles.actionButtonText}>경고</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.experienceButton]}
          onPress={() => {
            setSelectedUser(item);
            setExperienceForm({ totalExperience: item.stats?.totalExperience || 0, reason: '' });
            setShowExperienceModal(true);
          }}
        >
          <MaterialIcons name="edit" size={16} color="white" />
          <Text style={styles.actionButtonText}>경험치</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.statusButton]}
          onPress={() => {
            Alert.alert(
              '상태 변경',
              `${item.profile?.userName}의 상태를 변경하시겠습니까?`,
              [
                { text: '취소', style: 'cancel' },
                { text: '활성화', onPress: () => handleUpdateStatus(item.uid, 'active') },
                { text: '비활성화', onPress: () => handleUpdateStatus(item.uid, 'inactive') },
                { text: '정지', onPress: () => handleUpdateStatus(item.uid, 'suspended') },
              ]
            );
          }}
        >
          <MaterialIcons name="toggle-on" size={16} color="white" />
          <Text style={styles.actionButtonText}>상태</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteUser(item.uid)}
        >
          <MaterialIcons name="delete" size={16} color="white" />
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
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>사용자 관리</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={exportToCSV}
          >
            <MaterialIcons name="download" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilterModal(true)}
          >
            <MaterialIcons name="filter-list" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 검색 및 통계 */}
      <View style={styles.searchContainer}>
                 <View style={styles.searchRow}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false}>
             <View style={styles.searchTypeSelector}>
               <TouchableOpacity
                 style={[styles.searchTypeButton, searchType === 'all' && styles.searchTypeButtonActive]}
                 onPress={() => setSearchType('all')}
               >
                 <Text style={[styles.searchTypeText, searchType === 'all' && styles.searchTypeTextActive]}>전체</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.searchTypeButton, searchType === 'userName' && styles.searchTypeButtonActive]}
                 onPress={() => setSearchType('userName')}
               >
                 <Text style={[styles.searchTypeText, searchType === 'userName' && styles.searchTypeTextActive]}>사용자명</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.searchTypeButton, searchType === 'realName' && styles.searchTypeButtonActive]}
                 onPress={() => setSearchType('realName')}
               >
                 <Text style={[styles.searchTypeText, searchType === 'realName' && styles.searchTypeTextActive]}>실명</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.searchTypeButton, searchType === 'email' && styles.searchTypeButtonActive]}
                 onPress={() => setSearchType('email')}
               >
                 <Text style={[styles.searchTypeText, searchType === 'email' && styles.searchTypeTextActive]}>이메일</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.searchTypeButton, searchType === 'school' && styles.searchTypeButtonActive]}
                 onPress={() => setSearchType('school')}
               >
                 <Text style={[styles.searchTypeText, searchType === 'school' && styles.searchTypeTextActive]}>학교명</Text>
               </TouchableOpacity>
             </View>
           </ScrollView>
         </View>
        
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder={
              searchType === 'all' ? '검색어 입력...' :
              searchType === 'userName' ? '사용자명으로 검색...' :
              searchType === 'realName' ? '실명으로 검색...' :
              searchType === 'email' ? '이메일로 검색...' :
              searchType === 'school' ? '학교명으로 검색...' :
              '검색어 입력...'
            }
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            placeholderTextColor="#666"
          />
          <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
            <MaterialIcons name="search" size={20} color="white" />
          </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={clearAllFilters}
              >
                <Text style={styles.clearFiltersText}>필터 초기화</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* 고급 필터 모달 */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>고급 필터</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* 역할 필터 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>역할</Text>
                <View style={styles.filterOptions}>
                  {[
                    { key: 'all', label: '전체' },
                    { key: 'admin', label: '관리자' },
                    { key: 'user', label: '일반 사용자' }
                  ].map(role => (
                    <TouchableOpacity
                      key={role.key}
                      style={[
                        styles.filterOption,
                        roleFilter === role.key && styles.filterOptionSelected
                      ]}
                      onPress={() => setRoleFilter(role.key as any)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        roleFilter === role.key && styles.filterOptionTextSelected
                      ]}>
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* 상태 필터 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>상태</Text>
                <View style={styles.filterOptions}>
                  {[
                    { key: 'all', label: '전체' },
                    { key: 'active', label: '활성' },
                    { key: 'inactive', label: '비활성' },
                    { key: 'suspended', label: '정지' }
                  ].map(status => (
                    <TouchableOpacity
                      key={status.key}
                      style={[
                        styles.filterOption,
                        statusFilter === status.key && styles.filterOptionSelected
                      ]}
                      onPress={() => setStatusFilter(status.key as any)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        statusFilter === status.key && styles.filterOptionTextSelected
                      ]}>
                        {status.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* 정렬 필터 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>정렬</Text>
                <View style={styles.filterOptions}>
                  {[
                    { key: 'createdAt', label: '가입일' },
                    { key: 'lastActiveAt', label: '마지막 활동' },
                    { key: 'totalExperience', label: '경험치' },
                    { key: 'userName', label: '사용자명' }
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
              
              {/* 정렬 순서 */}
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

              {/* 경고 여부 필터 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>경고 여부</Text>
                <View style={styles.filterOptions}>
                  {[
                    { key: undefined, label: '전체' },
                    { key: true, label: '경고 있음' },
                    { key: false, label: '경고 없음' }
                  ].map((warning, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.filterOption,
                        hasWarnings === warning.key && styles.filterOptionSelected
                      ]}
                      onPress={() => setHasWarnings(warning.key)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        hasWarnings === warning.key && styles.filterOptionTextSelected
                      ]}>
                        {warning.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 레벨 범위 필터 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>레벨 범위</Text>
                <View style={styles.rangeInputContainer}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="최소"
                    value={levelRange.min?.toString() || ''}
                    onChangeText={(text) => setLevelRange(prev => ({ ...prev, min: Number(text) || undefined }))}
                    keyboardType="numeric"
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="최대"
                    value={levelRange.max?.toString() || ''}
                    onChangeText={(text) => setLevelRange(prev => ({ ...prev, max: Number(text) || undefined }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* 경험치 범위 필터 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>경험치 범위</Text>
                <View style={styles.rangeInputContainer}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="최소"
                    value={experienceRange.min?.toString() || ''}
                    onChangeText={(text) => setExperienceRange(prev => ({ ...prev, min: Number(text) || undefined }))}
                    keyboardType="numeric"
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="최대"
                    value={experienceRange.max?.toString() || ''}
                    onChangeText={(text) => setExperienceRange(prev => ({ ...prev, max: Number(text) || undefined }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearAllFilters}
              >
                <Text style={styles.clearButtonText}>초기화</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.applyButtonText}>적용</Text>
              </TouchableOpacity>
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
          <View style={[styles.modalContainer, { minHeight: 250 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>일괄 작업</Text>
              <TouchableOpacity onPress={() => setShowBulkActionModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
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
                        { 
                          text: '정지', 
                          onPress: () => {
                            // 일괄 정지 시 기본 설정 사용
                            const defaultSuspensionSettings: SuspensionSettings = {
                              type: 'temporary',
                              duration: 7,
                              reason: '일괄 정지',
                              autoRestore: true,
                              notifyUser: true
                            };
                            handleBulkAction('status', 'suspended', defaultSuspensionSettings);
                          }
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.bulkActionButtonText}>상태 변경</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 정지 설정 모달 */}
      <Modal
        visible={showSuspensionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSuspensionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>사용자 정지</Text>
              <TouchableOpacity onPress={() => setShowSuspensionModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.suspensionUserInfo}>
                사용자 "{selectedUser?.profile?.userName}"을 정지합니다.
              </Text>
              
              {/* 정지 유형 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>정지 유형</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      suspensionForm.type === 'temporary' && styles.filterOptionSelected
                    ]}
                    onPress={() => setSuspensionForm({ ...suspensionForm, type: 'temporary' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      suspensionForm.type === 'temporary' && styles.filterOptionTextSelected
                    ]}>
                      임시 정지
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      suspensionForm.type === 'permanent' && styles.filterOptionSelected
                    ]}
                    onPress={() => setSuspensionForm({ ...suspensionForm, type: 'permanent' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      suspensionForm.type === 'permanent' && styles.filterOptionTextSelected
                    ]}>
                      영구 정지
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* 정지 기간 (임시 정지일 때만) */}
              {suspensionForm.type === 'temporary' && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}>정지 기간 (일)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={suspensionForm.duration?.toString() || ''}
                    onChangeText={(text) => setSuspensionForm({ ...suspensionForm, duration: Number(text) || 1 })}
                    keyboardType="numeric"
                    placeholder="정지 기간을 입력하세요"
                  />
                </View>
              )}
              
              {/* 정지 사유 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>정지 사유</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={suspensionForm.reason}
                  onChangeText={(text) => setSuspensionForm({ ...suspensionForm, reason: text })}
                  placeholder="정지 사유를 입력하세요..."
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              {/* 옵션들 */}
              <View style={styles.switchSection}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>자동 해제</Text>
                  <Switch
                    value={suspensionForm.autoRestore}
                    onValueChange={(value) => setSuspensionForm({ ...suspensionForm, autoRestore: value })}
                    trackColor={{ false: '#ccc', true: pastelGreenColors[400] }}
                    thumbColor={suspensionForm.autoRestore ? pastelGreenColors[600] : '#f4f3f4'}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>사용자에게 알림</Text>
                  <Switch
                    value={suspensionForm.notifyUser}
                    onValueChange={(value) => setSuspensionForm({ ...suspensionForm, notifyUser: value })}
                    trackColor={{ false: '#ccc', true: pastelGreenColors[400] }}
                    thumbColor={suspensionForm.notifyUser ? pastelGreenColors[600] : '#f4f3f4'}
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowSuspensionModal(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!suspensionForm.reason.trim() || 
                   (suspensionForm.type === 'temporary' && (!suspensionForm.duration || suspensionForm.duration < 1))
                  ) && styles.disabledButton
                ]}
                onPress={handleSuspension}
                disabled={
                  !suspensionForm.reason.trim() || 
                  (suspensionForm.type === 'temporary' && (!suspensionForm.duration || suspensionForm.duration < 1))
                }
              >
                <Text style={[
                  styles.confirmButtonText,
                  (!suspensionForm.reason.trim() || 
                   (suspensionForm.type === 'temporary' && (!suspensionForm.duration || suspensionForm.duration < 1))
                  ) && styles.disabledButtonText
                ]}>
                  정지
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 경고 추가 모달 */}
      <Modal
        visible={showWarningModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>경고 추가</Text>
              <TouchableOpacity onPress={() => setShowWarningModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.suspensionUserInfo}>
                사용자 "{selectedUser?.profile?.userName}"에게 경고를 추가합니다.
              </Text>
              
              {/* 경고 사유 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>경고 사유</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={warningForm.reason}
                  onChangeText={(text) => setWarningForm({ ...warningForm, reason: text })}
                  placeholder="경고 사유를 입력하세요..."
                  multiline
                  numberOfLines={4}
                />
              </View>
              

            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowWarningModal(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !warningForm.reason.trim() && styles.disabledButton
                ]}
                onPress={handleAddWarning}
                disabled={!warningForm.reason.trim()}
              >
                <Text style={[
                  styles.confirmButtonText,
                  !warningForm.reason.trim() && styles.disabledButtonText
                ]}>
                  경고 추가
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 경험치 수정 모달 */}
      <Modal
        visible={showExperienceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExperienceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>경험치 수정</Text>
              <TouchableOpacity onPress={() => setShowExperienceModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.suspensionUserInfo}>
                사용자 "{selectedUser?.profile?.userName}"의 경험치를 수정합니다.
              </Text>
              
              {/* 경험치 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>경험치</Text>
                <TextInput
                  style={styles.textInput}
                  value={experienceForm.totalExperience.toString()}
                  onChangeText={(text) => setExperienceForm({ ...experienceForm, totalExperience: Number(text) || 0 })}
                  keyboardType="numeric"
                  placeholder="경험치를 입력하세요"
                />
              </View>
              
              {/* 수정 사유 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>수정 사유</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={experienceForm.reason}
                  onChangeText={(text) => setExperienceForm({ ...experienceForm, reason: text })}
                  placeholder="경험치 수정 사유를 입력하세요..."
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowExperienceModal(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!experienceForm.reason.trim() || experienceForm.totalExperience < 0) && styles.disabledButton
                ]}
                onPress={handleUpdateExperience}
                disabled={!experienceForm.reason.trim() || experienceForm.totalExperience < 0}
              >
                <Text style={[
                  styles.confirmButtonText,
                  (!experienceForm.reason.trim() || experienceForm.totalExperience < 0) && styles.disabledButtonText
                ]}>
                  경험치 수정
                </Text>
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
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  searchContainer: {
    flexDirection: 'column', // Changed to column for better layout
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
     searchTypeSelector: {
     flexDirection: 'row',
     backgroundColor: pastelGreenColors[100],
     borderRadius: 8,
     overflow: 'hidden',
     paddingHorizontal: 4,
   },
     searchTypeButton: {
     paddingHorizontal: 10,
     paddingVertical: 8,
     marginHorizontal: 2,
     borderRadius: 6,
   },
  searchTypeButtonActive: {
    backgroundColor: pastelGreenColors[500],
    borderRadius: 8,
  },
  searchTypeText: {
    fontSize: 14,
    color: pastelGreenColors[700],
  },
  searchTypeTextActive: {
    color: 'white',
    fontWeight: 'bold',
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
  searchButton: {
    padding: 8,
    backgroundColor: pastelGreenColors[500],
    borderRadius: 8,
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
    backgroundColor: pastelGreenColors[100],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
  },
  checkboxSelected: {
    backgroundColor: pastelGreenColors[500],
    borderColor: pastelGreenColors[600],
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
  schoolName: {
    fontSize: 14,
    color: pastelGreenColors[600],
    marginTop: 2,
  },
  regionName: {
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
    backgroundColor: pastelGreenColors[100],
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
  },
  adminBadge: {
    backgroundColor: pastelGreenColors[600],
    borderColor: pastelGreenColors[600],
  },
  userBadge: {
    backgroundColor: pastelGreenColors[400],
    borderColor: pastelGreenColors[400],
  },
  activeBadge: {
    backgroundColor: pastelGreenColors[400],
    borderColor: pastelGreenColors[400],
  },
  inactiveBadge: {
    backgroundColor: pastelGreenColors[100],
    borderColor: pastelGreenColors[200],
  },
  suspendedBadge: {
    backgroundColor: pastelGreenColors[600],
    borderColor: pastelGreenColors[600],
  },
  levelBadge: {
    backgroundColor: pastelGreenColors[400],
    borderColor: pastelGreenColors[400],
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  warningCount: {
    color: pastelGreenColors[600],
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
  warningButton: {
    backgroundColor: pastelGreenColors[500],
    flex: 1,
  },
  experienceButton: {
    backgroundColor: pastelGreenColors[400],
    flex: 1,
  },
  statusButton: {
    backgroundColor: pastelGreenColors[400],
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
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: pastelGreenColors[400],
    borderRadius: 8,
  },
  clearFiltersText: {
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
  backButton: {
    padding: 8,
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
    maxHeight: '85%',
    minHeight: 300,
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  modalContent: {
    flex: 1,
    padding: 20,
    paddingTop: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: pastelGreenColors[200],
    backgroundColor: 'white',
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
  rangeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pastelGreenColors[50],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  rangeInput: {
    flex: 1,
    fontSize: 16,
    color: pastelGreenColors[800],
    paddingVertical: 0,
  },
  rangeSeparator: {
    marginHorizontal: 8,
    fontSize: 16,
    color: pastelGreenColors[600],
  },
  textInput: {
    backgroundColor: pastelGreenColors[50],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: pastelGreenColors[800],
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  switchSection: {
    marginTop: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: pastelGreenColors[700],
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
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: pastelGreenColors[200],
  },
  clearButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: pastelGreenColors[500],
  },
  applyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  suspensionUserInfo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    marginBottom: 15,
    textAlign: 'center' as 'center',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center' as 'center',
    backgroundColor: pastelGreenColors[200],
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center' as 'center',
    backgroundColor: pastelGreenColors[500],
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: pastelGreenColors[200],
    opacity: 0.6,
  },
  disabledButtonText: {
    color: pastelGreenColors[400],
  },
}); 