import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';


interface Region {
  id: string;
  name: string;
  sigungu: string[];
}

interface RegionSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function RegionSetupModal({ visible, onClose, onComplete }: RegionSetupModalProps) {
  const { user, setUser } = useAuthStore();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [showSidoDropdown, setShowSidoDropdown] = useState(false);
  const [showSigunguDropdown, setShowSigunguDropdown] = useState(false);

  // 지역 데이터 로드
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const regionsCol = collection(db, 'regions');
        const regionSnapshot = await getDocs(regionsCol);
        const regionData = regionSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          sigungu: doc.data().sigungu || []
        }));
        setRegions(regionData);
      } catch (error) {
        console.error('지역 데이터 로드 실패:', error);
        Alert.alert('오류', '지역 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoadingRegions(false);
      }
    };

    if (visible) {
      loadRegions();
    }
  }, [visible]);

  // 시도 선택 시 시군구 업데이트
  useEffect(() => {
    if (selectedSido) {
      const selectedRegion = regions.find(region => region.name === selectedSido);
      if (selectedRegion) {
        setSigunguList(selectedRegion.sigungu);
      } else {
        setSigunguList([]);
      }
      setSelectedSigungu(''); // 시군구 선택 초기화
    }
  }, [selectedSido, regions]);

  const handleSubmit = async () => {
    if (!selectedSido || !selectedSigungu) {
      Alert.alert('알림', '시/도와 시/군/구를 모두 선택해주세요.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      setIsLoading(true);

      // Firestore 업데이트
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'regions.sido': selectedSido,
        'regions.sigungu': selectedSigungu,
        updatedAt: new Date()
      });

      // 로컬 상태 업데이트
      setUser({
        ...user,
        regions: {
          sido: selectedSido,
          sigungu: selectedSigungu
        }
      });

      Alert.alert('완료', '지역 정보가 저장되었습니다.');
      onComplete();
      onClose();
    } catch (error) {
      console.error('지역 정보 저장 실패:', error);
      Alert.alert('오류', '지역 정보 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name="location" size={24} color="#10B981" />
              <Text style={styles.title}>지역 설정</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            지역 커뮤니티를 이용하기 위해 거주 지역을 설정해주세요.
          </Text>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 시/도 선택 */}
            <View style={styles.section}>
              <Text style={styles.label}>시/도</Text>
              <TouchableOpacity 
                style={[styles.dropdownButton, isLoadingRegions && styles.disabledDropdown]}
                onPress={() => !isLoadingRegions && setShowSidoDropdown(true)}
                disabled={isLoadingRegions}
              >
                <Text style={[styles.dropdownText, !selectedSido && styles.placeholderText]}>
                  {isLoadingRegions ? "지역 정보 로딩 중..." : 
                   selectedSido || "시/도를 선택하세요"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 시/군/구 선택 */}
            <View style={styles.section}>
              <Text style={styles.label}>시/군/구</Text>
              <TouchableOpacity 
                style={[styles.dropdownButton, !selectedSido && styles.disabledDropdown]}
                onPress={() => selectedSido && setShowSigunguDropdown(true)}
                disabled={!selectedSido}
              >
                <Text style={[styles.dropdownText, !selectedSigungu && styles.placeholderText]}>
                  {!selectedSido ? "먼저 시/도를 선택하세요" : 
                   selectedSigungu || "시/군/구를 선택하세요"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.buttons}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.submitButton, (!selectedSido || !selectedSigungu) && styles.disabledButton]} 
              onPress={handleSubmit}
              disabled={!selectedSido || !selectedSigungu || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>완료</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 시/도 선택 모달 */}
        <Modal
          visible={showSidoDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSidoDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowSidoDropdown(false)}
          >
            <View style={styles.dropdownContainer}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>시/도 선택</Text>
                <TouchableOpacity onPress={() => setShowSidoDropdown(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.dropdownList}>
                {regions.map((region) => (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.dropdownItem,
                      selectedSido === region.name && styles.selectedDropdownItem
                    ]}
                    onPress={() => {
                      setSelectedSido(region.name);
                      setSelectedSigungu(''); // 시군구 초기화
                      setShowSidoDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      selectedSido === region.name && styles.selectedDropdownItemText
                    ]}>
                      {region.name}
                    </Text>
                    {selectedSido === region.name && (
                      <Ionicons name="checkmark" size={20} color="#10B981" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 시/군/구 선택 모달 */}
        <Modal
          visible={showSigunguDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSigunguDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowSigunguDropdown(false)}
          >
            <View style={styles.dropdownContainer}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>시/군/구 선택</Text>
                <TouchableOpacity onPress={() => setShowSigunguDropdown(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.dropdownList}>
                {sigunguList.map((sigungu) => (
                  <TouchableOpacity
                    key={sigungu}
                    style={[
                      styles.dropdownItem,
                      selectedSigungu === sigungu && styles.selectedDropdownItem
                    ]}
                    onPress={() => {
                      setSelectedSigungu(sigungu);
                      setShowSigunguDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      selectedSigungu === sigungu && styles.selectedDropdownItemText
                    ]}>
                      {sigungu}
                    </Text>
                    {selectedSigungu === sigungu && (
                      <Ionicons name="checkmark" size={20} color="#10B981" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    height: 50,
  },
  disabledDropdown: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  dropdownText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxHeight: '60%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  selectedDropdownItem: {
    backgroundColor: '#f0f9f5',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  selectedDropdownItemText: {
    color: '#10B981',
    fontWeight: '500',
  },
  buttons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});
