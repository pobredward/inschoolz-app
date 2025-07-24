import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { checkEmailAvailability } from '../../lib/users';

const schema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword'],
});

// 검증 상태 타입
type ValidationStatus = 'idle' | 'checking' | 'available' | 'unavailable';

interface ValidationState {
  status: ValidationStatus;
  message?: string;
}

export default function Step1BasicInfo({ formData, updateForm, nextStep }: {
  formData: any;
  updateForm: (data: Partial<any>) => void;
  nextStep: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
  // 이메일 검증 상태
  const [emailStatus, setEmailStatus] = useState<ValidationState>({ status: 'idle' });

  // 이메일 중복 체크 함수
  const checkEmail = useCallback(async (email: string) => {
    if (!email || email.trim() === '') {
      setEmailStatus({ status: 'idle' });
      return;
    }

    setEmailStatus({ status: 'checking' });

    try {
      const result = await checkEmailAvailability(email);
      if (result.isAvailable) {
        setEmailStatus({ 
          status: 'available', 
          message: result.message 
        });
      } else {
        setEmailStatus({ 
          status: 'unavailable', 
          message: result.message 
        });
      }
    } catch {
      setEmailStatus({ 
        status: 'unavailable', 
        message: '검증 중 오류가 발생했습니다.' 
      });
    }
  }, []);

  // 이메일 입력 디바운싱
  useEffect(() => {
    const emailValue = formData.email;
    if (!emailValue) {
      setEmailStatus({ status: 'idle' });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkEmail(emailValue);
    }, 300); // 500ms에서 300ms로 단축

    return () => clearTimeout(timeoutId);
  }, [formData.email, checkEmail]);

  const handleNext = () => {
    // 이메일 중복 체크 확인
    if (emailStatus.status === 'unavailable') {
      setError('이메일 중복을 해결해주세요.');
      return;
    }

    const result = schema.safeParse(formData);
    if (!result.success) {
      const errors: { [key: string]: string } = {};
      result.error.errors.forEach(e => {
        if (e.path[0]) errors[e.path[0]] = e.message;
      });
      setFieldError(errors);
      setError(result.error.errors[0]?.message || '입력값을 확인하세요.');
      return;
    }
    setFieldError({});
    setError(null);
    nextStep();
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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={64}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.stepIndicator}>1 / 4</Text>
          <Text style={styles.title}>기본 정보 입력</Text>
          <Text style={styles.subtitle}>이메일과 비밀번호를 입력해 주세요.</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>이메일</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  emailStatus.status === 'unavailable' && styles.inputError,
                  emailStatus.status === 'available' && styles.inputSuccess
                ]}
                placeholder="이메일을 입력하세요"
                value={formData.email || ''}
                onChangeText={(text) => updateForm({ email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9ca3af"
              />
              <View style={styles.validationIcon}>
                {getValidationIcon(emailStatus.status)}
              </View>
            </View>
            {emailStatus.message && (
              <Text style={[styles.validationMessage, { color: getMessageColor(emailStatus.status) }]}>
                {emailStatus.message}
              </Text>
            )}
            {fieldError.email && <Text style={styles.error}>{fieldError.email}</Text>}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>비밀번호</Text>
            {/* iOS strong password 제안을 우회하기 위한 더미 필드 */}
            <TextInput
              style={{ position: 'absolute', left: -9999, opacity: 0, height: 0 }}
              autoComplete="username"
              value=""
              editable={false}
            />
            <TextInput
              style={{ position: 'absolute', left: -9999, opacity: 0, height: 0 }}
              secureTextEntry
              autoComplete="current-password"
              value=""
              editable={false}
            />
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="비밀번호를 입력하세요 (8자 이상)"
                value={formData.password || ''}
                onChangeText={(text) => updateForm({ password: text })}
                secureTextEntry={!showPassword}
                placeholderTextColor="#9ca3af"
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                keyboardType="default"
                importantForAutofill="no"
                textContentType="oneTimeCode"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
            {fieldError.password && <Text style={styles.error}>{fieldError.password}</Text>}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>비밀번호 확인</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="비밀번호를 다시 입력하세요"
                value={formData.confirmPassword || ''}
                onChangeText={(text) => updateForm({ confirmPassword: text })}
                secureTextEntry={!showPasswordConfirm}
                placeholderTextColor="#9ca3af"
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                keyboardType="default"
                importantForAutofill="no"
                textContentType="oneTimeCode"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
              >
                <Ionicons
                  name={showPasswordConfirm ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
            {fieldError.confirmPassword && <Text style={styles.error}>{fieldError.confirmPassword}</Text>}
          </View>
          
          {error && <Text style={styles.error}>{error}</Text>}
          
          <View style={styles.topNavRow}>
            <TouchableOpacity style={[styles.navButton, styles.disabledButton]} disabled>
              <Text style={styles.disabledButtonText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>다음</Text>
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
    paddingBottom: 24,
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
  inputContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 4,
  },
  validationMessage: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
    alignSelf: 'flex-start',
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    width: '100%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    paddingRight: 50,
    fontSize: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 4,
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
  disabledButton: {
    backgroundColor: '#e5e7eb',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#9ca3af',
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
    marginBottom: 4,
    fontSize: 14,
    marginLeft: 2,
    alignSelf: 'flex-start',
  },
}); 