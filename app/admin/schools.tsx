import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { 
  adminGetAllSchools,
  adminSearchSchools,
  adminCreateSchool,
  adminUpdateSchool,
  adminDeleteSchool,
  School as FirebaseSchool,
} from '@/lib/schools';

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

// 컴포넌트에서 사용할 School 인터페이스 (디스플레이용)
interface DisplaySchool {
  id: string;
  name: string;
  address: string;
  district: string;
  type: '초등학교' | '중학교' | '고등학교' | '대학교';
  websiteUrl?: string;
  logoUrl?: string;
  memberCount?: number;
  favoriteCount?: number;
  createdAt?: number;
  updatedAt?: number;
}

interface SchoolFormData {
  KOR_NAME: string;
  ADDRESS: string;
  REGION: string;
  HOMEPAGE: string;
  memberCount: number;
  favoriteCount: number;
}

const initialFormData: SchoolFormData = {
  KOR_NAME: '',
  ADDRESS: '',
  REGION: '',
  HOMEPAGE: '',
  memberCount: 0,
  favoriteCount: 0,
};

// Firebase School을 DisplaySchool로 변환하는 함수
const convertToDisplaySchool = (firebaseSchool: FirebaseSchool): DisplaySchool => {
  const getSchoolType = (name: string): '초등학교' | '중학교' | '고등학교' | '대학교' => {
    if (name.includes('초등학교')) return '초등학교';
    if (name.includes('중학교')) return '중학교';
    if (name.includes('고등학교')) return '고등학교';
    return '대학교';
  };

  return {
    id: firebaseSchool.id,
    name: firebaseSchool.KOR_NAME,
    address: firebaseSchool.ADDRESS,
    district: firebaseSchool.REGION || '',
    type: getSchoolType(firebaseSchool.KOR_NAME),
    websiteUrl: firebaseSchool.HOMEPAGE,
    memberCount: firebaseSchool.memberCount || 0,
    favoriteCount: firebaseSchool.favoriteCount || 0,
  };
};

export default function AdminSchoolsScreen() {
  const { user } = useAuthStore();
  const [schools, setSchools] = useState<DisplaySchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingSchool, setEditingSchool] = useState<DisplaySchool | null>(null);
  const [formData, setFormData] = useState<SchoolFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      Alert.alert(
        '접근 권한 없음',
        '관리자만 접근할 수 있습니다.',
        [{ text: '확인', onPress: () => router.back() }]
      );
    }
  }, [user]);

  // 학교 목록 로드
  const loadSchools = async () => {
    try {
      setLoading(true);
      const firebaseSchools = await adminGetAllSchools();
      // Firebase School을 DisplaySchool로 변환
      const displaySchools = firebaseSchools.map(convertToDisplaySchool);
      // 즐겨찾기 수 기준 정렬 (이미 정렬되어 있지만 확실하게)
      const sortedSchools = displaySchools.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
      setSchools(sortedSchools);
    } catch (error) {
      console.error('학교 목록 로드 오류:', error);
      Alert.alert('오류', '학교 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 검색 실행
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadSchools();
      return;
    }

    try {
      setLoading(true);
      const firebaseSearchResults = await adminSearchSchools(searchTerm);
      const displaySearchResults = firebaseSearchResults.map(convertToDisplaySchool);
      const sortedResults = displaySearchResults.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
      setSchools(sortedResults);
    } catch (error) {
      console.error('학교 검색 오류:', error);
      Alert.alert('오류', '학교 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 학교 생성
  const handleCreateSchool = async () => {
    try {
      setIsSubmitting(true);
      
      // 실제 Firebase에 추가
      await adminCreateSchool(formData);
      
      Alert.alert('성공', '새 학교가 성공적으로 생성되었습니다.');
      setIsCreateModalVisible(false);
      setFormData(initialFormData);
      loadSchools(); // 목록 새로고침
    } catch (error) {
      console.error('학교 생성 오류:', error);
      Alert.alert('오류', '학교 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 학교 수정
  const handleUpdateSchool = async () => {
    if (!editingSchool) return;

    try {
      setIsSubmitting(true);
      
      // 실제 Firebase 업데이트
      await adminUpdateSchool(editingSchool.id, formData);
      
      Alert.alert('성공', '학교 정보가 성공적으로 수정되었습니다.');
      setIsEditModalVisible(false);
      setEditingSchool(null);
      setFormData(initialFormData);
      loadSchools(); // 목록 새로고침
    } catch (error) {
      console.error('학교 수정 오류:', error);
      Alert.alert('오류', '학교 정보 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 학교 삭제
  const handleDeleteSchool = (schoolId: string, schoolName: string) => {
    Alert.alert(
      '학교 삭제',
      `정말로 "${schoolName}" 학교를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminDeleteSchool(schoolId);
              Alert.alert('성공', '학교가 성공적으로 삭제되었습니다.');
              loadSchools(); // 목록 새로고침
            } catch (error) {
              console.error('학교 삭제 오류:', error);
              Alert.alert('오류', '학교 삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  // 수정 모달 열기
  const openEditModal = (school: DisplaySchool) => {
    setEditingSchool(school);
    setFormData({
      KOR_NAME: school.name,
      ADDRESS: school.address,
      REGION: school.district,
      HOMEPAGE: school.websiteUrl || '',
      memberCount: school.memberCount || 0,
      favoriteCount: school.favoriteCount || 0,
    });
    setIsEditModalVisible(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchools();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadSchools();
    }
  }, [user]);

  // 관리자가 아닌 경우
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
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={pastelGreenColors[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>학교 관리</Text>
          <TouchableOpacity 
            onPress={() => setIsCreateModalVisible(true)}
            style={styles.addButton}
          >
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          학교 정보를 관리하고 새로운 학교를 추가할 수 있습니다.
        </Text>
      </View>

      {/* 검색 영역 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color={pastelGreenColors[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="학교명 또는 주소로 검색..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <MaterialIcons name="clear" size={20} color={pastelGreenColors[400]} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.searchButtons}>
          <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>검색</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={loadSchools} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>전체</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 통계 카드 */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialIcons name="school" size={20} color={pastelGreenColors[600]} />
          <Text style={styles.statNumber}>{schools.length.toLocaleString()}</Text>
          <Text style={styles.statLabel}>전체 학교</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="people" size={20} color={pastelGreenColors[600]} />
          <Text style={styles.statNumber}>
            {schools.reduce((sum, school) => sum + (school.memberCount || 0), 0).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>총 멤버</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="favorite" size={20} color={pastelGreenColors[600]} />
          <Text style={styles.statNumber}>
            {schools.reduce((sum, school) => sum + (school.favoriteCount || 0), 0).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>총 즐겨찾기</Text>
        </View>
      </View>

      {/* 학교 목록 */}
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
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>학교 목록</Text>
          <Text style={styles.listSubtitle}>즐겨찾기 수 기준으로 정렬되어 있습니다.</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={pastelGreenColors[500]} />
              <Text style={styles.loadingText}>로딩 중...</Text>
            </View>
          ) : schools.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="school" size={48} color={pastelGreenColors[300]} />
              <Text style={styles.emptyText}>학교가 없습니다</Text>
            </View>
          ) : (
            schools.map((school) => (
              <View key={school.id} style={styles.schoolCard}>
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolName}>{school.name}</Text>
                  <Text style={styles.schoolType}>{school.type}</Text>
                  <Text style={styles.schoolAddress}>{school.address}</Text>
                  <View style={styles.schoolStats}>
                    <Text style={styles.statText}>멤버: {school.memberCount || 0}</Text>
                    <Text style={styles.statText}>즐겨찾기: {school.favoriteCount || 0}</Text>
                  </View>
                </View>
                <View style={styles.schoolActions}>
                  <TouchableOpacity 
                    onPress={() => openEditModal(school)}
                    style={styles.editButton}
                  >
                    <MaterialIcons name="edit" size={20} color={pastelGreenColors[600]} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleDeleteSchool(school.id, school.name)}
                    style={styles.deleteButton}
                  >
                    <MaterialIcons name="delete" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 생성 모달 */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>새 학교 추가</Text>
            <TouchableOpacity 
              onPress={handleCreateSchool}
              disabled={isSubmitting}
              style={[styles.modalSaveButton, isSubmitting && styles.modalSaveButtonDisabled]}
            >
              <Text style={styles.modalSaveText}>
                {isSubmitting ? '생성 중...' : '생성'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>학교명</Text>
              <TextInput
                style={styles.formInput}
                value={formData.KOR_NAME}
                onChangeText={(text) => setFormData(prev => ({ ...prev, KOR_NAME: text }))}
                placeholder="예: 서울고등학교"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>주소</Text>
              <TextInput
                style={styles.formInput}
                value={formData.ADDRESS}
                onChangeText={(text) => setFormData(prev => ({ ...prev, ADDRESS: text }))}
                placeholder="예: 서울특별시 강남구 테헤란로 123"
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>지역</Text>
              <TextInput
                style={styles.formInput}
                value={formData.REGION}
                onChangeText={(text) => setFormData(prev => ({ ...prev, REGION: text }))}
                placeholder="예: 서울특별시"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>웹사이트 URL</Text>
              <TextInput
                style={styles.formInput}
                value={formData.HOMEPAGE}
                onChangeText={(text) => setFormData(prev => ({ ...prev, HOMEPAGE: text }))}
                placeholder="예: https://school.go.kr"
                keyboardType="url"
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>멤버 수</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.memberCount.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, memberCount: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>즐겨찾기 수</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.favoriteCount.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, favoriteCount: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 수정 모달 */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>학교 정보 수정</Text>
            <TouchableOpacity 
              onPress={handleUpdateSchool}
              disabled={isSubmitting}
              style={[styles.modalSaveButton, isSubmitting && styles.modalSaveButtonDisabled]}
            >
              <Text style={styles.modalSaveText}>
                {isSubmitting ? '수정 중...' : '수정'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>학교명</Text>
              <TextInput
                style={styles.formInput}
                value={formData.KOR_NAME}
                onChangeText={(text) => setFormData(prev => ({ ...prev, KOR_NAME: text }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>주소</Text>
              <TextInput
                style={styles.formInput}
                value={formData.ADDRESS}
                onChangeText={(text) => setFormData(prev => ({ ...prev, ADDRESS: text }))}
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>지역</Text>
              <TextInput
                style={styles.formInput}
                value={formData.REGION}
                onChangeText={(text) => setFormData(prev => ({ ...prev, REGION: text }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>웹사이트 URL</Text>
              <TextInput
                style={styles.formInput}
                value={formData.HOMEPAGE}
                onChangeText={(text) => setFormData(prev => ({ ...prev, HOMEPAGE: text }))}
                keyboardType="url"
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>멤버 수</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.memberCount.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, memberCount: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>즐겨찾기 수</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.favoriteCount.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, favoriteCount: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: pastelGreenColors[500],
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  searchContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  searchButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  searchButton: {
    backgroundColor: pastelGreenColors[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '500',
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  clearButtonText: {
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statCard: {
    flex: 1,
    backgroundColor: pastelGreenColors[50],
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  schoolCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  schoolType: {
    fontSize: 12,
    color: pastelGreenColors[600],
    backgroundColor: pastelGreenColors[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  schoolAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  schoolStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  schoolActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: pastelGreenColors[50],
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalSaveButton: {
    backgroundColor: pastelGreenColors[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    color: 'white',
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formHalf: {
    flex: 1,
  },
}); 