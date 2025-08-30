import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { getUserFavoriteSchools, setMainSchool } from '../../lib/schools';
import { School } from '../../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface SchoolSelectorProps {
  style?: any;
  onSchoolChange?: (school: School) => void;
}

export interface SchoolSelectorRef {
  refresh: () => void;
}

const { width } = Dimensions.get('window');

const SchoolSelector = forwardRef<SchoolSelectorRef, SchoolSelectorProps>(({ style, onSchoolChange }, ref) => {
  const { user, setUser } = useAuthStore();
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadFavoriteSchools();
    }
  }, [user?.uid]);

  // ref를 통해 외부에서 새로고침할 수 있도록 노출
  useImperativeHandle(ref, () => ({
    refresh: loadFavoriteSchools
  }), []);

  const loadFavoriteSchools = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const schools = await getUserFavoriteSchools(user.uid);
      setFavoriteSchools(schools);
    } catch (error) {
      console.error('즐겨찾기 학교 목록 로드 실패:', error);
      Alert.alert('오류', '즐겨찾기 학교 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchoolSelect = async (school: School) => {
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (user.school?.id === school.id) {
      Alert.alert('알림', '이미 선택된 학교입니다.');
      return;
    }

    try {
      setIsLoading(true);
      
      const result = await setMainSchool(user.uid, school.id);
      
      Alert.alert('성공', `${school.KOR_NAME}으로 메인 학교가 변경되었습니다.`);
      
      // 사용자 정보 새로고침
      if (result.success && result.updatedUser) {
        setUser(result.updatedUser);
      } else {
        // 사용자 정보를 다시 불러오기
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as any;
          setUser({ ...userData, uid: user.uid } as any);
        }
      }
      
      // 부모 컴포넌트에 변경 알림
      if (onSchoolChange) {
        onSchoolChange(school);
      }
      
    } catch (error) {
      console.error('학교 변경 실패:', error);
      Alert.alert('오류', '학교 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
      setIsModalVisible(false);
    }
  };

  const currentSchool = favoriteSchools.find(school => school.id === user?.school?.id);

  if (!user) {
    return null;
  }

  if (favoriteSchools.length === 0 && !isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={16} color="#9CA3AF" />
          <Text style={styles.emptyText}>즐겨찾기 학교가 없습니다</Text>
        </View>
        <Text style={styles.emptySubText}>마이페이지에서 학교를 추가해주세요</Text>
      </View>
    );
  }

  const renderSchoolItem = ({ item: school }: { item: School }) => (
    <TouchableOpacity
      style={styles.schoolItem}
      onPress={() => handleSchoolSelect(school)}
    >
      <View style={styles.schoolInfo}>
        <Ionicons name="school-outline" size={16} color="#374151" />
        <Text style={styles.schoolName}>{school.KOR_NAME}</Text>
      </View>
      <View style={styles.schoolActions}>
        {school.id === user?.school?.id && (
          <View style={styles.mainBadge}>
            <Text style={styles.mainBadgeText}>메인</Text>
          </View>
        )}
        <Ionicons name="star" size={12} color="#FCD34D" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setIsModalVisible(true)}
        disabled={isLoading}
      >
        <View style={styles.selectorContent}>
          <Ionicons name="school-outline" size={16} color="#374151" />
          <Text style={styles.selectedSchoolText}>
            {currentSchool ? currentSchool.KOR_NAME : '학교를 선택하세요'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>학교 선택</Text>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>로딩 중...</Text>
              </View>
            ) : (
              <FlatList
                data={favoriteSchools}
                renderItem={renderSchoolItem}
                keyExtractor={(item) => item.id}
                style={styles.schoolList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
});

SchoolSelector.displayName = 'SchoolSelector';

export default SchoolSelector;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedSchoolText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  emptyText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  emptySubText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    maxHeight: '70%',
    width: '100%',
    maxWidth: 400,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  schoolList: {
    paddingHorizontal: 20,
  },
  schoolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  schoolName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  schoolActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  mainBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
}); 