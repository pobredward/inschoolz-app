import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { collection, query, where, orderBy, getDocs, getFirestore } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface School {
  id: string;
  name: string;
  address: string;
  memberCount: number;
  favoriteCount: number;
}

export default function Step2School({ formData, updateForm, nextStep, prevStep }: {
  formData: any;
  updateForm: (data: Partial<any>) => void;
  nextStep: () => void;
  prevStep: () => void;
}) {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!queryText || queryText.length < 2) {
      setError('검색어는 2자 이상 입력하세요.');
      setResults([]);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const schoolsRef = collection(db, 'schools');
      const endText = queryText + '\uf8ff';
      const q = query(
        schoolsRef,
        orderBy('KOR_NAME'),
        where('KOR_NAME', '>=', queryText),
        where('KOR_NAME', '<=', endText)
      );
      const snap = await getDocs(q);
      const schools: School[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        // 중간 포함 검색도 지원
        if (!d.KOR_NAME.toLowerCase().includes(queryText.toLowerCase())) return;
        schools.push({
          id: docSnap.id,
          name: d.KOR_NAME,
          address: d.ADDRESS,
          memberCount: d.memberCount || 0,
          favoriteCount: d.favoriteCount || 0,
        });
      });
      setResults(schools);
      if (schools.length === 0) setError('검색 결과가 없습니다.');
    } catch (e) {
      setError('학교 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (school: School) => {
    // 웹과 동일한 구조로 학교 정보 저장 (추가 필드는 null로 저장)
    updateForm({ 
      school: {
        id: school.id,
        name: school.name,
        grade: null,
        classNumber: null,
        studentNumber: null,
        isGraduate: null,
      },
      schoolId: school.id, // 호환성을 위해 유지
      schoolName: school.name, // 호환성을 위해 유지
      schoolAddress: school.address, // 호환성을 위해 유지
      // favorites.schools 배열에 해당 학교 ID 추가
      favorites: {
        schools: [school.id],
        boards: []
      }
    });
    setError(null);
    nextStep();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={64}
    >
      <FlatList
        style={{ flex: 1, backgroundColor: '#f5f5f5' }}
        data={results}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.stepIndicator}>2 / 5</Text>
            <Text style={styles.title}>학교 선택</Text>
            <Text style={styles.subtitle}>학교명을 검색하여 선택해 주세요.</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>학교명</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="학교명을 입력하세요"
                  value={queryText}
                  onChangeText={setQueryText}
                  placeholderTextColor="#9ca3af"
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                  <Text style={styles.searchButtonText}>검색</Text>
                </TouchableOpacity>
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.loadingText}>검색 중...</Text>
                </View>
              )}
              {queryText.length >= 2 && (
                <View style={styles.noticeContainer}>
                  <Text style={styles.noticeTitle}>💡 검색 유의사항</Text>
                  <Text style={styles.noticeText}>학교의 시작 키워드를 입력해야 합니다.</Text>
                  <Text style={styles.noticeExample}>ex) 서울대모초등학교 검색 시 서울대모(O) 대모(X)</Text>
                </View>
              )}
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerContainer}>
            <View style={styles.topNavRow}>
              <TouchableOpacity style={styles.navButton} onPress={prevStep}>
                <Text style={styles.navButtonText}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.disabledButton]} disabled>
                <Text style={styles.disabledButtonText}>다음</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              <Text style={styles.schoolName}>{item.name}</Text>
              <Text style={styles.schoolAddress}>{item.address}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>가입 {item.memberCount}명</Text>
                <Text style={styles.infoText}>즐겨찾기 {item.favoriteCount}</Text>
              </View>
              <TouchableOpacity style={styles.selectButton} onPress={() => handleSelect(item)}>
                <Text style={styles.selectButtonText}>선택하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 24,
  },
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  stepIndicator: {
    fontSize: 15,
    color: '#64748b',
    alignSelf: 'flex-start',
    marginBottom: 4,
    marginLeft: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  formGroup: {
    width: '100%',
    marginBottom: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
    marginLeft: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#dc2626',
    marginBottom: 4,
    fontSize: 14,
    marginLeft: 2,
    alignSelf: 'flex-start',
  },
  cardContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  schoolAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
  },
  selectButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: 'bold',
  },
  topNavRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  navButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 48,
  },
  navButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#e5e7eb',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
  footerContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 48,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    marginLeft: 8,
  },
  noticeContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  noticeExample: {
    fontSize: 14,
    color: '#6b7280',
  },
}); 