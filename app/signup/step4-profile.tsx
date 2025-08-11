import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { ReferralSearch } from '../../components/ReferralSearch';
import { formatPhoneNumberForInput, extractPhoneNumbers, padBirthValue, filterNumericOnly } from '../../utils/formatters';
import { checkUserNameAvailability, checkReferralExists } from '../../lib/users';
// 기본 logger 함수
const logger = {
  debug: (message: string, ...args: any[]) => {
    if (__DEV__) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (__DEV__) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`❌ [ERROR] ${message}`, ...args);
  }
};

interface Step4ProfileProps {
  formData: any;
  updateForm: (data: Partial<any>) => void;
  onSubmit?: () => Promise<void>;
  prevStep: () => void;
  isSubmitting: boolean;
}

// 검증 상태 타입
type ValidationStatus = 'idle' | 'checking' | 'available' | 'unavailable';

interface ValidationState {
  status: ValidationStatus;
  message?: string;
}

export default function Step4Profile({ 
  formData, 
  updateForm, 
  onSubmit, 
  prevStep, 
  isSubmitting 
}: Step4ProfileProps) {
  const [error, setError] = useState<string | null>(null);
  
  // 사용자명 검증 상태
  const [userNameStatus, setUserNameStatus] = useState<ValidationState>({ status: 'idle' });
  
  // 추천인 검증 상태
  const [referralStatus, setReferralStatus] = useState<ValidationState>({ status: 'idle' });

  // 사용자명 중복 체크 함수
  const checkUserName = useCallback(async (userName: string) => {
    if (!userName || userName.trim() === '') {
      setUserNameStatus({ status: 'idle' });
      return;
    }

    setUserNameStatus({ status: 'checking' });

    try {
      const result = await checkUserNameAvailability(userName);
      if (result.isAvailable) {
        setUserNameStatus({ 
          status: 'available', 
          message: result.message 
        });
      } else {
        setUserNameStatus({ 
          status: 'unavailable', 
          message: result.message 
        });
      }
    } catch {
      setUserNameStatus({ 
        status: 'unavailable', 
        message: '검증 중 오류가 발생했습니다.' 
      });
    }
  }, []);

  // 추천인 검증 함수
  const checkReferral = useCallback(async (userName: string) => {
    if (!userName || userName.trim() === '') {
      setReferralStatus({ status: 'idle' });
      return;
    }

    setReferralStatus({ status: 'checking' });

    try {
      const result = await checkReferralExists(userName);
      if (result.exists) {
        setReferralStatus({ 
          status: 'available', 
          message: `${result.displayName}님을 추천합니다!` 
        });
      } else {
        setReferralStatus({ 
          status: 'unavailable', 
          message: '존재하지 않는 사용자입니다.' 
        });
      }
    } catch {
      setReferralStatus({ 
        status: 'unavailable', 
        message: '검증 중 오류가 발생했습니다.' 
      });
    }
  }, []);

  // 사용자명 입력 디바운싱
  useEffect(() => {
    const userNameValue = formData.userName;
    if (!userNameValue) {
      setUserNameStatus({ status: 'idle' });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkUserName(userNameValue);
    }, 300); // 500ms에서 300ms로 단축

    return () => clearTimeout(timeoutId);
  }, [formData.userName, checkUserName]);

  // 추천인 입력 디바운싱
  useEffect(() => {
    const referralValue = formData.referral;
    if (!referralValue) {
      setReferralStatus({ status: 'idle' });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkReferral(referralValue);
    }, 300); // 500ms에서 300ms로 단축

    return () => clearTimeout(timeoutId);
  }, [formData.referral, checkReferral]);

  const handleAgree = (key: string) => {
    updateForm({ [key]: !formData[key] });
  };

  const handleSubmit = async () => {
    logger.debug('Step4Profile handleSubmit 시작');

    // 필수 필드 검증 (생년월일, 성별, 전화번호는 선택사항으로 변경)
    if (!formData.userName || !formData.realName) {
      logger.warn('필수 필드 검증 실패');
      setError('사용자명과 실명은 필수 입력사항입니다.');
      return;
    }

    // 사용자명 중복 체크 확인
    if (userNameStatus.status === 'unavailable') {
      setError('사용자명 중복을 해결해주세요.');
      return;
    }

    if (userNameStatus.status === 'checking') {
      setError('사용자명 확인이 완료될 때까지 기다려주세요.');
      return;
    }

    // 추천인 검증 확인
    if (formData.referral && referralStatus.status === 'unavailable') {
      setError('추천인 아이디가 존재하지 않습니다.');
      return;
    }

    if (formData.referral && referralStatus.status === 'checking') {
      setError('추천인 아이디 확인이 완료될 때까지 기다려주세요.');
      return;
    }

    // 약관 동의 검증
    if (!formData.termsAgreed || !formData.privacyAgreed || !formData.locationAgreed) {
      logger.warn('약관 동의 검증 실패');
      setError('필수 약관에 모두 동의해야 합니다.');
      return;
    }

    logger.debug('모든 검증 통과');
    setError(null);
    
    // onSubmit 함수 호출
    try {
      if (onSubmit) {
        logger.debug('회원가입 함수 호출 시작');
        await onSubmit();
        logger.debug('회원가입 함수 완료');
      } else {
        logger.error('onSubmit 함수가 전달되지 않았습니다.');
        setError('회원가입 처리 중 오류가 발생했습니다.');
      }
    } catch (error) {
      logger.error('onSubmit 호출 오류:', error);
      setError('회원가입 처리 중 오류가 발생했습니다.');
    }
  };

  // 검증 상태에 따른 아이콘 반환
  const getValidationIcon = (status: ValidationStatus) => {
    switch (status) {
      case 'checking':
        return <ActivityIndicator size="small" color="#007AFF" />;
      case 'available':
        return <Ionicons name="checkmark-circle" size={20} color="#22C55E" />;
      case 'unavailable':
        return <Ionicons name="close-circle" size={20} color="#EF4444" />;
      default:
        return null;
    }
  };

  // 검증 상태에 따른 메시지 색상
  const getMessageColor = (status: ValidationStatus) => {
    switch (status) {
      case 'available':
        return '#22C55E';
      case 'unavailable':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={64}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.stepIndicator}>4 / 4</Text>
          <Text style={styles.title}>세부 정보 입력</Text>
          <Text style={styles.subtitle}>개인정보와 약관 동의를 입력해 주세요.</Text>
          
          {/* 개인정보 섹션 */}
          <Text style={styles.sectionTitle}>개인정보</Text>
          
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>아이디</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  userNameStatus.status === 'unavailable' && styles.inputError,
                  userNameStatus.status === 'available' && styles.inputSuccess
                ]}
                placeholder="영문자, 숫자 조합 5-20자"
                value={formData.userName || ''}
                onChangeText={(text) => updateForm({ userName: text })}
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
              <View style={styles.validationIcon}>
                {getValidationIcon(userNameStatus.status)}
              </View>
            </View>
            {userNameStatus.message && (
              <Text style={[styles.validationMessage, { color: getMessageColor(userNameStatus.status) }]}>
                {userNameStatus.message}
              </Text>
            )}
          </View>
          
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>실명</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.inputContainerRegular}>
              <TextInput
                style={styles.input}
                placeholder="실명을 입력하세요"
                value={formData.realName || ''}
                onChangeText={(text) => updateForm({ realName: text })}
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>성별 (선택사항)</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderButton, formData.gender === 'male' && styles.selectedGender]}
                onPress={() => updateForm({ gender: 'male' })}
                activeOpacity={0.8}
              >
                <Text style={formData.gender === 'male' ? styles.selectedGenderText : styles.genderText}>남</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, formData.gender === 'female' && styles.selectedGender]}
                onPress={() => updateForm({ gender: 'female' })}
                activeOpacity={0.8}
              >
                <Text style={formData.gender === 'female' ? styles.selectedGenderText : styles.genderText}>여</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>생년월일 (선택사항)</Text>
            <View style={styles.rowContainer}>
              <View style={styles.birthInputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="년도"
                  value={formData.birthYear || ''}
                  onChangeText={(v) => {
                    const numericValue = v.replace(/[^0-9]/g, ''); // 숫자만 허용
                    updateForm({ birthYear: numericValue });
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                  maxLength={4}
                />
              </View>
              <View style={styles.birthInputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="월"
                  value={formData.birthMonth || ''}
                  onChangeText={(v) => {
                    const numericValue = filterNumericOnly(v); // 숫자만 허용
                    const monthValue = parseInt(numericValue) || 0;
                    if (monthValue <= 12) { // 월은 1-12만 허용
                      updateForm({ birthMonth: numericValue });
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                  maxLength={2}
                />
              </View>
              <View style={styles.birthInputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="일"
                  value={formData.birthDay || ''}
                  onChangeText={(v) => {
                    const numericValue = filterNumericOnly(v); // 숫자만 허용
                    const dayValue = parseInt(numericValue) || 0;
                    if (dayValue <= 31) { // 일은 1-31만 허용
                      updateForm({ birthDay: numericValue });
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                  maxLength={2}
                />
              </View>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>휴대폰번호 (선택사항)</Text>
            <View style={styles.inputContainerRegular}>
              <TextInput
                style={styles.input}
                placeholder="010-1234-5678"
                value={formatPhoneNumberForInput(formData.phoneNumber || '')}
                onChangeText={(v) => {
                  const numericValue = extractPhoneNumbers(v); // 숫자만 추출
                  updateForm({ phoneNumber: numericValue });
                }}
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
                maxLength={13}
              />
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>추천인 아이디 (선택사항)</Text>
            <View style={[
              styles.inputContainer,
              referralStatus.status === 'unavailable' && styles.inputError,
              referralStatus.status === 'available' && styles.inputSuccess
            ]}>
              <TextInput
                style={styles.input}
                placeholder="추천인 아이디를 입력하세요"
                value={formData.referral || ''}
                onChangeText={(text) => updateForm({ referral: text })}
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
              <View style={styles.validationIcon}>
                {getValidationIcon(referralStatus.status)}
              </View>
            </View>
            {referralStatus.message && (
              <Text style={[styles.validationMessage, { color: getMessageColor(referralStatus.status) }]}>
                {referralStatus.message}
              </Text>
            )}
          </View>

          {/* 약관 동의 섹션 */}
          <View style={styles.separator} />
          <Text style={styles.sectionTitle}>약관 동의</Text>
          <Text style={styles.agreementNotice}>서비스 이용을 위해 필수 약관에 동의해 주세요.</Text>
          
          <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('termsAgreed')}>
            <View style={[styles.checkbox, formData.termsAgreed && styles.checked]} />
            <Text style={styles.checkboxLabel}>[필수] 서비스 이용약관</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('privacyAgreed')}>
            <View style={[styles.checkbox, formData.privacyAgreed && styles.checked]} />
            <Text style={styles.checkboxLabel}>[필수] 개인정보 수집 및 이용 동의</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('locationAgreed')}>
            <View style={[styles.checkbox, formData.locationAgreed && styles.checked]} />
            <Text style={styles.checkboxLabel}>[필수] 위치기반 서비스 이용약관</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('marketingAgreed')}>
            <View style={[styles.checkbox, formData.marketingAgreed && styles.checked]} />
            <Text style={styles.checkboxLabel}>[선택] 마케팅 정보 수신 동의</Text>
          </TouchableOpacity>
          
          {error && <Text style={styles.error}>{error}</Text>}
          
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.navButton} onPress={prevStep}>
              <Text style={styles.navButtonText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
              <Text style={styles.buttonText}>{isSubmitting ? '가입 처리 중...' : '가입하기'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 100,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
    color: '#374151',
  },
  separator: {
    width: '100%',
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  formGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#374151',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  inputSuccess: {
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  validationIcon: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validationMessage: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  genderButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  selectedGender: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  genderText: {
    fontSize: 16,
    color: '#374151',
  },
  selectedGenderText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  agreementNotice: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: '#fff',
  },
  checked: {
    backgroundColor: '#2563eb',
  },
  checkboxLabel: {
    fontSize: 16,
    flex: 1,
    color: '#374151',
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
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  required: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  inputContainerRegular: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  birthInputContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
}); 