import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../store/authStore';
import { getUserFavoriteSchools, setMainSchool } from '../../../lib/schools';
import { School } from '../../../types';

interface SchoolSelectorProps {
  onSchoolChange?: (school: School) => void;
  style?: any;
}

export default function SchoolSelector({ onSchoolChange, style }: SchoolSelectorProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadFavoriteSchools();
    }
  }, [user?.uid]);

  const loadFavoriteSchools = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      console.log('즐겨찾기 학교 로딩 시작...');
      const schools = await getUserFavoriteSchools(user.uid);
      console.log('로드된 즐겨찾기 학교:', schools);
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
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    if (user.school?.id === school.id) {
      Alert.alert('알림', '이미 선택된 학교입니다.');
      setIsDropdownOpen(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const result = await setMainSchool(user.uid, school.id);
      
      if (result.success && result.updatedUser) {
        // authStore 업데이트 - 학교 정보만 업데이트
        const { updateUserSchool } = useAuthStore.getState();
        updateUserSchool(result.updatedUser.school);
        
        console.log('학교 변경 완료:', result.updatedUser.school);
        
        Alert.alert('성공', `${school.KOR_NAME}으로 메인 학교가 변경되었습니다.`);
        
        // 부모 컴포넌트에 변경 알림
        if (onSchoolChange) {
          onSchoolChange(school);
        }
      }

      setIsDropdownOpen(false);
      
    } catch (error) {
      console.error('학교 변경 실패:', error);
      Alert.alert('오류', '학교 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSchool = () => {
    setIsDropdownOpen(false);
    router.push('/favorite-schools');
  };

  const toggleDropdown = () => {
    if (favoriteSchools.length === 0) {
      // 즐겨찾기 학교가 없으면 바로 추가 페이지로 이동
      handleAddSchool();
    } else {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  const currentSchool = favoriteSchools.find(school => school.id === user?.school?.id);

  if (!user) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* 메인 선택기 */}
      <TouchableOpacity
        style={[
          styles.selector,
          isDropdownOpen && styles.selectorOpen,
          favoriteSchools.length === 0 && styles.selectorEmpty
        ]}
        onPress={toggleDropdown}
        disabled={isLoading}
      >
        <View style={styles.selectorLeft}>
          <Ionicons 
            name="school-outline" 
            size={20} 
            color={favoriteSchools.length === 0 ? "#9CA3AF" : "#374151"} 
          />
          <Text style={[
            styles.selectorText,
            favoriteSchools.length === 0 && styles.selectorTextEmpty
          ]} numberOfLines={1}>
            {favoriteSchools.length === 0 
              ? '즐겨찾기 학교가 없습니다' 
              : (currentSchool ? currentSchool.KOR_NAME : '학교 선택')
            }
          </Text>
          {currentSchool && (
            <View style={styles.mainBadge}>
              <Text style={styles.mainBadgeText}>메인</Text>
            </View>
          )}
        </View>
        <View style={styles.selectorRight}>
          {favoriteSchools.length === 0 ? (
            <View style={styles.addIconContainer}>
              <Ionicons name="add" size={16} color="#10B981" />
              <Text style={styles.addText}>추가</Text>
            </View>
          ) : (
            <Ionicons 
              name={isDropdownOpen ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#9CA3AF" 
            />
          )}
        </View>
      </TouchableOpacity>

      {/* 드롭다운 메뉴 */}
      {isDropdownOpen && favoriteSchools.length > 0 && (
        <View style={styles.dropdown}>
          {favoriteSchools.map((school) => (
            <TouchableOpacity
              key={school.id}
              style={[
                styles.schoolItem,
                school.id === user?.school?.id && styles.selectedSchoolItem
              ]}
              onPress={() => handleSchoolSelect(school)}
            >
              <View style={styles.schoolInfo}>
                <Ionicons name="school-outline" size={18} color="#374151" />
                <Text style={styles.schoolName} numberOfLines={1}>
                  {school.KOR_NAME}
                </Text>
              </View>
              <View style={styles.schoolBadges}>
                {school.id === user?.school?.id && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>메인</Text>
                  </View>
                )}
                <Ionicons name="star" size={14} color="#FCD34D" />
              </View>
            </TouchableOpacity>
          ))}
          
          {/* 학교 관리 링크 */}
          <TouchableOpacity
            style={styles.manageItem}
            onPress={handleAddSchool}
          >
            <View style={styles.manageItemContent}>
              <Ionicons name="add-circle-outline" size={18} color="#10B981" />
              <Text style={styles.manageItemText}>즐겨찾기 학교 관리</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 44,
  },
  selectorOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: 'transparent',
  },
  selectorEmpty: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  selectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  selectorTextEmpty: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  addIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '600',
  },
  mainBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  mainBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  schoolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedSchoolItem: {
    backgroundColor: '#F0FDF4',
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  schoolName: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  schoolBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  manageItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageItemText: {
    fontSize: 14,
    color: '#10B981',
    marginLeft: 8,
    fontWeight: '600',
  },
}); 