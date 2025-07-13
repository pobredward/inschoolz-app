import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { School } from '@/types';
import { searchSchools } from '@/lib/schools';
import { useAuthStore } from '@/store/authStore';
import {
  getUserFavoriteSchools, 
  toggleFavoriteSchool, 
  setMainSchool 
} from '../../lib/schools';

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

// 커스텀 헤더 컴포넌트
function CustomHeader({ title, onBack, onAdd }: { 
  title: string; 
  onBack: () => void; 
  onAdd?: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      {onAdd ? (
        <TouchableOpacity onPress={onAdd} style={styles.headerButton}>
          <Ionicons name="add" size={24} color={pastelGreenColors[600]} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerButton} />
      )}
    </View>
  );
}

export default function FavoriteSchoolsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [mainSchoolId, setMainSchoolId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [searching, setSearching] = useState(false);

  const loadFavoriteSchools = async () => {
    if (!user?.uid) return;

    try {
      const schools = await getUserFavoriteSchools(user.uid);
      setFavoriteSchools(schools);
      
      // 사용자의 메인 학교 ID 가져오기
      const mainSchool = user?.school?.id;
      if (mainSchool) {
        setMainSchoolId(mainSchool);
      } else if (schools.length > 0) {
        // 메인 학교가 설정되지 않은 경우 첫 번째 학교를 기본으로
        setMainSchoolId(schools[0].id);
      }
    } catch (error) {
      console.error('즐겨찾기 학교 로드 오류:', error);
      Alert.alert('오류', '즐겨찾기 학교를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavoriteSchools();
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavoriteSchools();
    setRefreshing(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const results = await searchSchools(query);
      setSearchResults(results);
    } catch (error) {
      console.error('학교 검색 오류:', error);
      Alert.alert('오류', '학교 검색 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddSchool = async (school: School) => {
    if (!user?.uid) return;

    if (favoriteSchools.length >= 5) {
      Alert.alert('제한', '즐겨찾기 학교는 최대 5개까지만 등록할 수 있습니다.');
      return;
    }

    try {
      await toggleFavoriteSchool(user.uid, school.id);
      await loadFavoriteSchools();
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('성공', `${school.KOR_NAME}이(가) 즐겨찾기에 추가되었습니다.`);
    } catch (error) {
      console.error('학교 추가 오류:', error);
      Alert.alert('오류', '학교 추가 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveSchool = async (school: School) => {
    if (!user?.uid) return;

    Alert.alert(
      '학교 삭제',
      `${school.KOR_NAME}을(를) 즐겨찾기에서 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await toggleFavoriteSchool(user.uid, school.id);
              await loadFavoriteSchools();
              Alert.alert('성공', `${school.KOR_NAME}이(가) 즐겨찾기에서 삭제되었습니다.`);
            } catch (error) {
              console.error('학교 삭제 오류:', error);
              Alert.alert('오류', '학교 삭제 중 오류가 발생했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleSetMainSchool = async (schoolId: string) => {
    if (!user?.uid) return;

    try {
      const result = await setMainSchool(user.uid, schoolId);
      
      if (result.success && result.updatedUser) {
        // authStore 업데이트 - 학교 정보만 업데이트
        const { updateUserSchool } = useAuthStore.getState();
        updateUserSchool(result.updatedUser.school);
        
        console.log('메인 학교 변경 완료:', result.updatedUser.school);
        
        setMainSchoolId(schoolId);
        Alert.alert('성공', '메인 학교가 변경되었습니다.');
      }
    } catch (error) {
      console.error('메인 학교 설정 오류:', error);
      Alert.alert('오류', '메인 학교 설정 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <CustomHeader title="즐겨찾기 학교" onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={pastelGreenColors[500]} />
          <Text style={styles.loadingText}>학교 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader 
        title="즐겨찾기 학교" 
        onBack={() => router.back()} 
        onAdd={() => setShowAddModal(true)}
      />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {favoriteSchools.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏫</Text>
            <Text style={styles.emptyTitle}>즐겨찾기 학교가 없습니다</Text>
            <Text style={styles.emptyDescription}>
              학교를 추가하여 해당 학교 커뮤니티에 참여하세요
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton} 
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyButtonText}>학교 추가하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.schoolList}>
            <Text style={styles.sectionTitle}>
              즐겨찾기 학교 ({favoriteSchools.length}/5)
            </Text>
            <Text style={styles.sectionDescription}>
              메인 학교는 커뮤니티와 랭킹에서 기본으로 표시됩니다
            </Text>
            
            {favoriteSchools.map((school, index) => (
              <View key={school.id} style={styles.schoolItem}>
                <View style={styles.schoolInfo}>
                  <View style={styles.schoolHeader}>
                    <Text style={styles.schoolName}>{school.KOR_NAME}</Text>
                    {mainSchoolId === school.id && (
                      <View style={styles.mainBadge}>
                        <Text style={styles.mainBadgeText}>메인</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.schoolAddress}>{school.ADDRESS}</Text>
                </View>
                
                <View style={styles.schoolActions}>
                  {mainSchoolId !== school.id && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSetMainSchool(school.id)}
                    >
                      <Text style={styles.actionButtonText}>메인 설정</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleRemoveSchool(school)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 학교 추가 모달 */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>학교 추가</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="학교명을 입력하세요"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching && (
                <ActivityIndicator size="small" color="#2563eb" style={styles.searchLoading} />
              )}
            </View>
          </View>

          <ScrollView style={styles.searchResults}>
            {searchResults.map((school) => {
              const isAlreadyAdded = favoriteSchools.some(fav => fav.id === school.id);
              
              return (
                <TouchableOpacity
                  key={school.id}
                  style={[
                    styles.searchResultItem,
                    isAlreadyAdded && styles.searchResultItemDisabled
                  ]}
                  onPress={() => !isAlreadyAdded && handleAddSchool(school)}
                  disabled={isAlreadyAdded}
                >
                  <View style={styles.searchResultInfo}>
                    <Text style={[
                      styles.searchResultName,
                      isAlreadyAdded && styles.searchResultNameDisabled
                    ]}>
                      {school.KOR_NAME}
                    </Text>
                    <Text style={styles.searchResultAddress}>{school.ADDRESS}</Text>
                    <View style={styles.schoolStats}>
                      <View style={styles.statItem}>
                        <Ionicons name="people-outline" size={14} color="#666" />
                        <Text style={styles.statText}>멤버 {school.memberCount || 0}명</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="heart-outline" size={14} color="#666" />
                        <Text style={styles.statText}>즐겨찾기 {school.favoriteCount || 0}명</Text>
                      </View>
                    </View>
                  </View>
                  {isAlreadyAdded ? (
                    <View style={styles.addedBadge}>
                      <Text style={styles.addedBadgeText}>추가됨</Text>
                    </View>
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color="#2563eb" />
                  )}
                </TouchableOpacity>
              );
            })}
            
            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
                <Text style={styles.noResultsDescription}>
                  다른 검색어로 시도해보세요
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  schoolList: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  schoolItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schoolInfo: {
    flex: 1,
    marginRight: 12,
  },
  schoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  mainBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  schoolAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  schoolActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#ef4444',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchLoading: {
    marginLeft: 8,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchResultItemDisabled: {
    opacity: 0.5,
  },
  searchResultInfo: {
    flex: 1,
    marginRight: 12,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  searchResultNameDisabled: {
    color: '#9ca3af',
  },
  searchResultAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  schoolStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  addedBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addedBadgeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noResultsDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
