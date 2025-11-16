import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { School } from '@/types';
import { searchSchools } from '@/lib/schools';
import { useAuthStore } from '@/store/authStore';
import {
  getUserFavoriteSchools, 
  toggleFavoriteSchool, 
  setMainSchool 
} from '../lib/schools';

interface FavoriteSchoolsManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

type TabType = 'manage' | 'search';

export default function FavoriteSchoolsManagementModal({ 
  visible, 
  onClose,
  onUpdate 
}: FavoriteSchoolsManagementModalProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('manage');
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [mainSchoolId, setMainSchoolId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [searching, setSearching] = useState(false);

  const loadFavoriteSchools = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const schools = await getUserFavoriteSchools(user.uid);
      setFavoriteSchools(schools);
      
      const mainSchool = user?.school?.id;
      if (mainSchool) {
        setMainSchoolId(mainSchool);
      } else if (schools.length > 0) {
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
    if (visible && user?.uid) {
      loadFavoriteSchools();
    }
  }, [visible, user?.uid]);

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
      
      if (onUpdate) {
        onUpdate();
      }
      
      Alert.alert('성공', `${school.KOR_NAME}이(가) 즐겨찾기에 추가되었습니다.`);
      setActiveTab('manage');
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
              
              if (onUpdate) {
                onUpdate();
              }
              
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
        const { updateUserSchool } = useAuthStore.getState();
        updateUserSchool(result.updatedUser.school);
        
        setMainSchoolId(schoolId);
        
        if (onUpdate) {
          onUpdate();
        }
        
        Alert.alert('성공', '메인 학교가 변경되었습니다.');
      }
    } catch (error) {
      console.error('메인 학교 설정 오류:', error);
      Alert.alert('오류', '메인 학교 설정 중 오류가 발생했습니다.');
    }
  };

  const handleClose = () => {
    setActiveTab('manage');
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  const renderManageTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>학교 정보를 불러오는 중...</Text>
        </View>
      );
    }

    if (favoriteSchools.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏫</Text>
          <Text style={styles.emptyTitle}>즐겨찾기 학교가 없습니다</Text>
          <Text style={styles.emptyDescription}>
            학교를 추가하여 해당 학교 커뮤니티에 참여하세요
          </Text>
          <TouchableOpacity 
            style={styles.emptyButton} 
            onPress={() => setActiveTab('search')}
          >
            <Text style={styles.emptyButtonText}>학교 추가하기</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        <View style={styles.schoolList}>
          {favoriteSchools.map((school) => (
            <TouchableOpacity 
              key={school.id} 
              style={styles.schoolItem}
              onPress={() => {
                router.push(`/(tabs)/community?tab=school/${school.id}`);
                handleClose();
              }}
              activeOpacity={0.7}
            >
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
              
              <View style={styles.schoolActions}>
                {mainSchoolId !== school.id && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleSetMainSchool(school.id);
                    }}
                  >
                    <Text style={styles.actionButtonText}>메인 설정</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRemoveSchool(school);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {favoriteSchools.length < 5 && (
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={() => setActiveTab('search')}
          >
            <Text style={styles.addMoreButtonText}>+ 학교 추가하기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const renderSearchTab = () => {
    return (
      <ScrollView style={styles.scrollView}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="학교명을 입력하세요"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searching && (
              <ActivityIndicator size="small" color="#2563eb" style={styles.searchLoading} />
            )}
          </View>
        </View>

        <View style={styles.searchResults}>
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
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* 헤더 */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.modalCancelText}>닫기</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>🏫 즐겨찾기 학교 관리</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 탭 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'manage' && styles.activeTab]}
            onPress={() => setActiveTab('manage')}
          >
            <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>
              📋 관리
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.activeTab]}
            onPress={() => setActiveTab('search')}
          >
            <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
              🔍 학교 추가
            </Text>
          </TouchableOpacity>
        </View>

        {/* 컨텐츠 */}
        {activeTab === 'manage' ? renderManageTab() : renderSearchTab()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
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
    paddingTop: 0,
  },
  schoolItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    marginBottom: 8,
  },
  schoolStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
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
  addMoreButton: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  addMoreButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  searchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    paddingHorizontal: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    marginBottom: 4,
  },
  searchResultNameDisabled: {
    color: '#9ca3af',
  },
  searchResultAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
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
});

