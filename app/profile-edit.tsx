import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { updateUserProfile, updateProfileImage } from '../lib/users';
import { getAllRegions, getDistrictsByRegion } from '../lib/regions';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { formatPhoneNumberForInput, extractPhoneNumbers, padBirthValue, filterNumericOnly } from '../utils/formatters';

export default function ProfileEditScreen() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [formData, setFormData] = useState({
    userName: user?.profile?.userName || '',
    realName: user?.profile?.realName || '',
    birthYear: user?.profile?.birthYear?.toString() || '',
    birthMonth: user?.profile?.birthMonth?.toString() || '',
    birthDay: user?.profile?.birthDay?.toString() || '',
    gender: user?.profile?.gender || '',
    phoneNumber: user?.profile?.phoneNumber || '',
    profileImageUrl: user?.profile?.profileImageUrl || '',
    sido: user?.regions?.sido || '',
    sigungu: user?.regions?.sigungu || '',
    address: user?.regions?.address || '',
  });

  // 시/도 목록 불러오기
  useEffect(() => {
    const fetchProvinces = async () => {
      setRegionsLoading(true);
      try {
        const regions = await getAllRegions();
        setProvinces(regions);
      } catch (error) {
        console.error('시/도 목록 불러오기 오류:', error);
      } finally {
        setRegionsLoading(false);
      }
    };

    fetchProvinces();
  }, []);

  // 시/군/구 목록 불러오기
  useEffect(() => {
    const fetchCities = async () => {
      if (!formData.sido) {
        setCities([]);
        return;
      }

      setRegionsLoading(true);
      try {
        const districts = await getDistrictsByRegion(formData.sido);
        setCities(districts);
      } catch (error) {
        console.error('시/군/구 목록 불러오기 오류:', error);
      } finally {
        setRegionsLoading(false);
      }
    };

    fetchCities();
  }, [formData.sido]);

  useEffect(() => {
    // 사용자 정보가 있을 때 폼 데이터 업데이트
    if (user) {
      setFormData({
        userName: user.profile?.userName || '',
        realName: user.profile?.realName || '',
        birthYear: user.profile?.birthYear?.toString() || '',
        birthMonth: user.profile?.birthMonth?.toString() || '',
        birthDay: user.profile?.birthDay?.toString() || '',
        gender: user.profile?.gender || '',
        phoneNumber: user.profile?.phoneNumber || '',
        profileImageUrl: user.profile?.profileImageUrl || '',
        sido: user.regions?.sido || '',
        sigungu: user.regions?.sigungu || '',
        address: user.regions?.address || '',
      });
    }
  }, [user]);

  // 뒤로가기
  const handleGoBack = () => {
    router.back();
  };

  // 입력값 변경 핸들러
  const handleChange = (key: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [key]: value };
      
      // 시/도 변경 시 시/군/구 초기화
      if (key === 'sido') {
        newData.sigungu = '';
      }
      
      return newData;
    });
  };

  // 시/도 선택
  const handleProvinceSelect = (province: string) => {
    handleChange('sido', province);
    setShowProvinceModal(false);
  };

  // 시/군/구 선택
  const handleCitySelect = (city: string) => {
    handleChange('sigungu', city);
    setShowCityModal(false);
  };

  // 프로필 이미지 선택 및 크롭
  const handleSelectImage = async () => {
    // 권한 요청
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    // 이미지 선택 (크롭 기능 비활성화)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // expo-image-manipulator로 크롭할 것이므로 비활성화
      quality: 1.0, // 최고 품질로 선택
    });

    if (!result.canceled && result.assets[0] && user?.uid) {
      const selectedImageUri = result.assets[0].uri;
      
      try {
        setUploadingImage(true);
        
        // 이미지를 정사각형으로 크롭
        const croppedImage = await ImageManipulator.manipulateAsync(
          selectedImageUri,
          [
            {
              crop: {
                originX: 0,
                originY: 0,
                width: Math.min(result.assets[0].width, result.assets[0].height),
                height: Math.min(result.assets[0].width, result.assets[0].height),
              },
            },
            {
              resize: {
                width: 400, // 400x400 크기로 리사이즈
                height: 400,
              },
            },
          ],
          {
            compress: 0.8, // 압축률 80%
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        // 크롭된 이미지 업로드
        const uploadResult = await updateProfileImage(user.uid, croppedImage.uri);
        if (uploadResult.success && uploadResult.url) {
          setFormData(prev => ({ ...prev, profileImageUrl: uploadResult.url! }));
          Alert.alert('성공', '프로필 이미지가 업데이트되었습니다.');
        } else {
          Alert.alert('오류', uploadResult.error || '이미지 업로드에 실패했습니다.');
        }
      } catch (error) {
        console.error('이미지 크롭/업로드 오류:', error);
        Alert.alert('오류', '이미지 처리 중 오류가 발생했습니다.');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  // 프로필 저장
  const handleSave = async () => {
    if (!user?.uid) return;

    // 유효성 검사
    if (!formData.userName.trim()) {
      Alert.alert('오류', '사용자 이름은 필수입니다.');
      return;
    }

    setLoading(true);
    try {
      // 생년월일 숫자 변환
      const birthYear = formData.birthYear ? parseInt(formData.birthYear) : undefined;
      const birthMonth = formData.birthMonth ? parseInt(formData.birthMonth) : undefined;
      const birthDay = formData.birthDay ? parseInt(formData.birthDay) : undefined;

      // 프로필 업데이트
      await updateUserProfile(user.uid, {
        userName: formData.userName,
        realName: formData.realName || undefined,
        birthYear,
        birthMonth,
        birthDay,
        gender: formData.gender || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        sido: formData.sido || undefined,
        sigungu: formData.sigungu || undefined,
        address: formData.address || undefined,
      });

      // 로컬 상태 업데이트
      if (user) {
        setUser({
          ...user,
          profile: {
            ...user.profile,
            userName: formData.userName,
            realName: formData.realName,
            birthYear: birthYear || 0,
            birthMonth: birthMonth || 0,
            birthDay: birthDay || 0,
            gender: formData.gender,
            phoneNumber: formData.phoneNumber,
            profileImageUrl: formData.profileImageUrl,
          },
          regions: {
            sido: formData.sido,
            sigungu: formData.sigungu,
            address: formData.address,
          }
        });
      }

      Alert.alert('성공', '프로필이 성공적으로 업데이트되었습니다.');
      router.back();
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      Alert.alert('오류', '프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필 수정</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveButton}>
          {loading ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <Text style={styles.saveButtonText}>저장</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 프로필 이미지 */}
        <View style={styles.imageSection}>
          <TouchableOpacity onPress={handleSelectImage} style={styles.imageContainer}>
            {formData.profileImageUrl ? (
              <Image source={{ uri: formData.profileImageUrl }} style={styles.profileImage} />
            ) : (
              <View style={styles.defaultImage}>
                <Text style={styles.defaultImageText}>
                  {formData.userName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.imageOverlay}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={20} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.imageText}>프로필 사진 변경</Text>
          <Text style={styles.imageSubtext}>정사각형으로 자동 크롭됩니다</Text>
        </View>

        {/* 기본 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본 정보</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>사용자 이름 *</Text>
            <TextInput
              style={styles.input}
              value={formData.userName}
              onChangeText={(text) => handleChange('userName', text)}
              placeholder="사용자 이름을 입력하세요"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>실명</Text>
            <TextInput
              style={styles.input}
              value={formData.realName}
              onChangeText={(text) => handleChange('realName', text)}
              placeholder="실명을 입력하세요"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>성별</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[styles.genderButton, formData.gender === '남성' && styles.genderButtonActive]}
                onPress={() => handleChange('gender', '남성')}
              >
                <Text style={[styles.genderButtonText, formData.gender === '남성' && styles.genderButtonTextActive]}>
                  남성
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, formData.gender === '여성' && styles.genderButtonActive]}
                onPress={() => handleChange('gender', '여성')}
              >
                <Text style={[styles.genderButtonText, formData.gender === '여성' && styles.genderButtonTextActive]}>
                  여성
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>휴대폰 번호</Text>
            <TextInput
              style={styles.input}
              value={formatPhoneNumberForInput(formData.phoneNumber)}
              onChangeText={(text) => {
                const numericValue = extractPhoneNumbers(text); // 숫자만 추출
                handleChange('phoneNumber', numericValue);
              }}
              placeholder="010-1234-5678"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={13}
            />
          </View>

          {/* 생년월일 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>생년월일</Text>
            <View style={styles.birthContainer}>
              <TextInput
                style={[styles.input, styles.birthInput]}
                value={formData.birthYear}
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9]/g, ''); // 숫자만 허용
                  handleChange('birthYear', numericValue);
                }}
                placeholder="YYYY"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={4}
              />
              <TextInput
                style={[styles.input, styles.birthInput]}
                value={formData.birthMonth || ''}
                onChangeText={(text) => {
                  const numericValue = filterNumericOnly(text); // 숫자만 허용
                  const monthValue = parseInt(numericValue) || 0;
                  if (monthValue <= 12) { // 월은 1-12만 허용
                    handleChange('birthMonth', numericValue);
                  }
                }}
                placeholder="MM"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.birthInput]}
                value={formData.birthDay || ''}
                onChangeText={(text) => {
                  const numericValue = filterNumericOnly(text); // 숫자만 허용
                  const dayValue = parseInt(numericValue) || 0;
                  if (dayValue <= 31) { // 일은 1-31만 허용
                    handleChange('birthDay', numericValue);
                  }
                }}
                placeholder="DD"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          </View>
        </View>

        {/* 지역 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>지역 정보</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>시/도</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowProvinceModal(true)}
              disabled={regionsLoading}
            >
              <Text style={[styles.selectButtonText, formData.sido && styles.selectButtonTextActive]}>
                {formData.sido || '시/도 선택'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>시/군/구</Text>
            <TouchableOpacity
              style={[styles.selectButton, !formData.sido && styles.selectButtonDisabled]}
              onPress={() => setShowCityModal(true)}
              disabled={regionsLoading || !formData.sido}
            >
              <Text style={[styles.selectButtonText, formData.sigungu && styles.selectButtonTextActive]}>
                {formData.sigungu || '시/군/구 선택'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>상세주소</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => handleChange('address', text)}
              placeholder="상세주소를 입력하세요 (선택사항)"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
      </ScrollView>

      {/* 시/도 선택 모달 */}
      <Modal
        visible={showProvinceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>시/도 선택</Text>
            <TouchableOpacity onPress={() => setShowProvinceModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {provinces.map((province) => (
              <TouchableOpacity
                key={province}
                style={styles.modalItem}
                onPress={() => handleProvinceSelect(province)}
              >
                <Text style={styles.modalItemText}>{province}</Text>
                {formData.sido === province && (
                  <Ionicons name="checkmark" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* 시/군/구 선택 모달 */}
      <Modal
        visible={showCityModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>시/군/구 선택</Text>
            <TouchableOpacity onPress={() => setShowCityModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {cities.map((city) => (
              <TouchableOpacity
                key={city}
                style={styles.modalItem}
                onPress={() => handleCitySelect(city)}
              >
                <Text style={styles.modalItemText}>{city}</Text>
                {formData.sigungu === city && (
                  <Ionicons name="checkmark" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  defaultImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageText: {
    fontSize: 14,
    color: '#6B7280',
  },
  imageSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  genderButtonActive: {
    borderColor: '#10B981',
    backgroundColor: '#ecfdf5',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  genderButtonTextActive: {
    color: '#10B981',
    fontWeight: '500',
  },
  birthContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  birthInput: {
    flex: 1,
    textAlign: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  selectButtonDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  selectButtonTextActive: {
    color: '#111827',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemText: {
    fontSize: 16,
    color: '#111827',
  },
});