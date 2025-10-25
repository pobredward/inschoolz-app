import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { School } from '../types';

interface SchoolSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function SchoolSetupModal({ visible, onClose, onComplete }: SchoolSetupModalProps) {
  const { user, setUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 검색 기능
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('알림', '학교명을 입력해주세요.');
      return;
    }

    try {
      setIsSearching(true);
      setHasSearched(true);
      
      // Firestore에서 학교 검색 (KOR_NAME 필드로 검색)
      const schoolsRef = collection(db, 'schools');
      const q = query(
        schoolsRef,
        where('KOR_NAME', '>=', searchQuery.trim()),
        where('KOR_NAME', '<=', searchQuery.trim() + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      
      const results: School[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().KOR_NAME || doc.data().name || '',
        address: doc.data().address || doc.data().ADDRESS || '',
        schoolType: doc.data().schoolType || doc.data().SCHOOL_TYPE || '학교',
        establishment: doc.data().establishment || doc.data().ESTABLISHMENT || ''
      }));
      
      setSearchResults(results);
      
      if (results.length === 0) {
        Alert.alert('알림', '검색 결과가 없습니다. 다른 검색어를 시도해보세요.');
      }
    } catch (error) {
      console.error('학교 검색 실패:', error);
      Alert.alert('오류', '학교 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 학교 선택
  const handleSelectSchool = async (school: School) => {
    if (!user?.uid) {
      Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      setIsAdding(true);

      // 검색 토큰 재생성 (학교명이 변경되므로)
      const { generateUserSearchTokens } = await import('../utils/search-tokens');
      const newSearchTokens = generateUserSearchTokens(
        user.profile?.userName,
        user.profile?.realName,
        school.name
      );

      // Firestore 업데이트
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'school.id': school.id,
        'school.name': school.name,
        'school.address': school.address,
        'school.schoolType': school.schoolType,
        searchTokens: newSearchTokens,
        updatedAt: new Date()
      });

      // 로컬 상태 업데이트
      setUser({
        ...user,
        school: {
          id: school.id,
          name: school.name,
          address: school.address,
          schoolType: school.schoolType,
        },
        searchTokens: newSearchTokens
      });

      Alert.alert('완료', '학교 정보가 저장되었습니다.');
      onComplete();
      onClose();
    } catch (error) {
      console.error('학교 정보 저장 실패:', error);
      Alert.alert('오류', '학교 정보 저장에 실패했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name="school" size={24} color="#10B981" />
              <Text style={styles.title}>학교 설정</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            학교 커뮤니티를 이용하기 위해 학교를 검색하고 선택해주세요.
          </Text>

          <View style={styles.content}>
            {/* 검색 섹션 */}
            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="학교명을 입력하세요"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity 
                  style={styles.searchButton} 
                  onPress={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="search" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* 검색 결과 */}
            <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
              {hasSearched && (
                <View style={styles.resultsSection}>
                  <Text style={styles.resultsTitle}>
                    검색 결과 ({searchResults.length}개)
                  </Text>
                  
                  {searchResults.length > 0 ? (
                    <View style={styles.resultsList}>
                      {searchResults.map((school) => (
                        <TouchableOpacity
                          key={school.id}
                          style={styles.schoolItem}
                          onPress={() => handleSelectSchool(school)}
                          disabled={isAdding}
                        >
                          <View style={styles.schoolInfo}>
                            <Text style={styles.schoolName}>{school.name}</Text>
                            <Text style={styles.schoolAddress}>{school.address}</Text>
                            <View style={styles.schoolTags}>
                              <View style={styles.tag}>
                                <Text style={styles.tagText}>{school.schoolType}</Text>
                              </View>
                              {school.establishment && (
                                <Text style={styles.establishment}>{school.establishment}</Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.selectButton}>
                            {isAdding ? (
                              <ActivityIndicator size="small" color="#10B981" />
                            ) : (
                              <Text style={styles.selectButtonText}>선택</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noResults}>
                      <Ionicons name="search" size={48} color="#ccc" />
                      <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
                      <Text style={styles.noResultsSubtext}>다른 검색어를 시도해보세요</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  searchSection: {
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: '#10B981',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
    paddingTop: 8,
  },
  resultsSection: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  resultsList: {
    gap: 12,
  },
  schoolItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  schoolAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  schoolTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  establishment: {
    fontSize: 12,
    color: '#999',
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginTop: 12,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
});
