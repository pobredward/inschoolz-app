import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { ReferralSearch } from '../../components/ReferralSearch';
import { logger } from '../../utils/logger';

interface Step4ProfileProps {
  formData: any;
  updateForm: (data: Partial<any>) => void;
  onSubmit?: () => Promise<void>;
  prevStep: () => void;
  isSubmitting: boolean;
}

export default function Step4Profile({ 
  formData, 
  updateForm, 
  onSubmit, 
  prevStep, 
  isSubmitting 
}: Step4ProfileProps) {
  const [error, setError] = useState<string | null>(null);

  const handleAgree = (key: string) => {
    updateForm({ [key]: !formData[key] });
  };

  const handleSubmit = async () => {
    logger.debug('Step4Profile handleSubmit 시작');

    // 필수 필드 검증
    if (!formData.userName || !formData.realName || !formData.gender || !formData.birthYear || !formData.birthMonth || !formData.birthDay || !formData.phoneNumber) {
      logger.warn('필수 필드 검증 실패');
      setError('모든 필수 필드를 입력하세요.');
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
            <Text style={styles.label}>아이디</Text>
            <TextInput
              style={styles.input}
              placeholder="영문, 숫자 조합 5-20자"
              value={formData.userName || ''}
              onChangeText={(text) => updateForm({ userName: text })}
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>실명</Text>
            <TextInput
              style={styles.input}
              placeholder="실명을 입력하세요"
              value={formData.realName || ''}
              onChangeText={(text) => updateForm({ realName: text })}
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>성별</Text>
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
            <Text style={styles.label}>생년월일</Text>
            <View style={styles.rowContainer}>
              <TextInput
                style={[styles.halfInput, styles.input]}
                placeholder="년도"
                value={formData.birthYear || ''}
                onChangeText={(v) => updateForm({ birthYear: v })}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
                maxLength={4}
              />
              <TextInput
                style={[styles.halfInput, styles.input]}
                placeholder="월"
                value={formData.birthMonth || ''}
                onChangeText={(v) => updateForm({ birthMonth: v })}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
                maxLength={2}
              />
              <TextInput
                style={[styles.halfInput, styles.input]}
                placeholder="일"
                value={formData.birthDay || ''}
                onChangeText={(v) => updateForm({ birthDay: v })}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
                maxLength={2}
              />
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>휴대폰번호</Text>
            <TextInput
              style={styles.input}
              placeholder="01012345678"
              value={formData.phoneNumber || ''}
              onChangeText={(v) => updateForm({ phoneNumber: v })}
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>추천인 아이디 (선택)</Text>
            <ReferralSearch
              value={formData.referral || ''}
              onSelect={(user) => {
                const referralValue = user ? user.userName : '';
                updateForm({ referral: referralValue });
              }}
              placeholder="추천인 아이디를 검색하세요"
            />
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
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: 'white',
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
}); 