import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function Step5Terms({ formData, updateForm, onSubmit, prevStep, isSubmitting }: {
  formData: any;
  updateForm: (data: Partial<any>) => void;
  onSubmit: () => void;
  prevStep: () => void;
  isSubmitting: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleAgree = (key: string) => {
    updateForm({ [key]: !formData[key] });
  };

  const handleSubmit = () => {
    if (!formData.termsAgreed || !formData.privacyAgreed || !formData.locationAgreed) {
      setError('필수 약관에 모두 동의해야 합니다.');
      return;
    }
    setError(null);
    onSubmit();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepIndicator}>5 / 5</Text>
      <Text style={styles.title}>약관 동의</Text>
      <Text style={styles.subtitle}>서비스 이용을 위해 약관에 동의해 주세요.</Text>
      <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('termsAgreed')}>
        <View style={[styles.checkbox, formData.termsAgreed && styles.checked]} />
        <Text style={styles.label}>[필수] 이용약관 동의</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('privacyAgreed')}>
        <View style={[styles.checkbox, formData.privacyAgreed && styles.checked]} />
        <Text style={styles.label}>[필수] 개인정보 처리방침 동의</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('locationAgreed')}>
        <View style={[styles.checkbox, formData.locationAgreed && styles.checked]} />
        <Text style={styles.label}>[필수] 위치기반 서비스 동의</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('marketingAgreed')}>
        <View style={[styles.checkbox, formData.marketingAgreed && styles.checked]} />
        <Text style={styles.label}>[선택] 마케팅 정보 수신 동의</Text>
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
  );
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
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
  label: {
    fontSize: 16,
    flex: 1,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
}); 