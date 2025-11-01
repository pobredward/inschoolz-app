import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';
import { loginWithEmail, loginWithApple, isAppleAuthenticationAvailable } from '../lib/auth';
import { loginWithKakaoOptimized } from '../lib/kakao';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [isAppleLoginAvailable, setIsAppleLoginAvailable] = useState(false);
  
  // 이메일 폼 상태
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: ''
  });
  
  const { setUser, setLoading, isLoading, waitForAuthSync } = useAuthStore();

  // Expo Go 환경 감지 (Expo Go에서는 Google 로그인 비활성화)
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  // Apple 로그인 가능 여부 확인
  useEffect(() => {
    const checkAppleAuth = async () => {
      const isAvailable = await isAppleAuthenticationAvailable();
      setIsAppleLoginAvailable(isAvailable);
    };
    
    checkAppleAuth();
  }, []);

  // 이메일 로그인
  const handleEmailLogin = async () => {
    if (!emailForm.email?.trim() || !emailForm.password?.trim()) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const user = await loginWithEmail(emailForm.email.trim(), emailForm.password);
      setUser(user);
      
      // ✅ iOS는 5초, Android는 3초 대기
      const timeoutMs = Platform.OS === 'ios' ? 5000 : 3000;
      const isSynced = await waitForAuthSync(timeoutMs);
      
      if (!isSynced) {
        console.warn(`Auth 동기화 타임아웃 (${timeoutMs}ms), 그래도 진행합니다.`);
      }
      
      // ✅ 즉시 라우팅
      router.replace('/(tabs)');
      
      setTimeout(() => {
        Alert.alert('성공', '로그인되었습니다!');
      }, 300);
    } catch (error) {
      console.error('이메일 로그인 오류:', error);
      Alert.alert('로그인 실패', error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카카오 로그인
  const handleKakaoLogin = async () => {
    try {
      setLoading(true);
      const user = await loginWithKakaoOptimized();
      setUser(user);
      
      // ✅ iOS는 5초, Android는 3초 대기 (iOS가 더 느림)
      const timeoutMs = Platform.OS === 'ios' ? 5000 : 3000;
      const isSynced = await waitForAuthSync(timeoutMs);
      
      if (!isSynced) {
        console.warn(`Auth 동기화 타임아웃 (${timeoutMs}ms), 그래도 진행합니다.`);
      } else {
        console.log('✅ Auth 동기화 완료, 안전하게 라우팅합니다.');
      }
      
      // ✅ Alert 후가 아닌 즉시 라우팅 (Alert는 참고용)
      router.replace('/(tabs)');
      
      // Alert는 나중에 표시 (라우팅 블로킹 안 함)
      setTimeout(() => {
        Alert.alert('성공', '카카오 로그인이 완료되었습니다!');
      }, 300);
    } catch (error) {
      console.error('카카오 로그인 오류:', error);
      
      // ✅ keyHash 에러 감지
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('keyHash') || errorMessage.includes('validation failed')) {
        Alert.alert(
          '카카오 로그인 설정 오류',
          '앱 키 해시가 등록되지 않았습니다.\n개발자에게 문의해주세요.\n\n임시로 다른 로그인 방법을 이용해주세요.',
          [{ text: '확인' }]
        );
      } else {
        Alert.alert('카카오 로그인 실패', errorMessage || '카카오 로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Apple 로그인
  const handleAppleLogin = async () => {
    try {
      setLoading(true);
      const user = await loginWithApple();
      setUser(user);
      
      // ✅ iOS는 5초 대기
      const timeoutMs = 5000;
      const isSynced = await waitForAuthSync(timeoutMs);
      
      if (!isSynced) {
        console.warn(`Auth 동기화 타임아웃 (${timeoutMs}ms), 그래도 진행합니다.`);
      }
      
      // ✅ 즉시 라우팅
      router.replace('/(tabs)');
      
      setTimeout(() => {
        Alert.alert('성공', 'Apple 로그인이 완료되었습니다!');
      }, 300);
    } catch (error) {
      console.error('Apple 로그인 오류:', error);
      
      // 사용자가 취소한 경우는 알림을 표시하지 않음
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('취소')) {
        Alert.alert('Apple 로그인 실패', errorMessage || 'Apple 로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google 로그인 (동적 import로 Expo Go 에러 방지)
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // Expo Go 환경에서는 실행되지 않도록 추가 체크
      if (isExpoGo) {
        Alert.alert('알림', 'Google 로그인은 Expo Go에서 지원되지 않습니다.');
        return;
      }
      
      // 동적 import로 네이티브 모듈 로드
      const { loginWithGoogle } = await import('../lib/google');
      const user = await loginWithGoogle();
      setUser(user);
      
      // ✅ iOS는 5초, Android는 3초 대기
      const timeoutMs = Platform.OS === 'ios' ? 5000 : 3000;
      const isSynced = await waitForAuthSync(timeoutMs);
      
      if (!isSynced) {
        console.warn(`Auth 동기화 타임아웃 (${timeoutMs}ms), 그래도 진행합니다.`);
      }
      
      // ✅ 즉시 라우팅
      router.replace('/(tabs)');
      
      setTimeout(() => {
        Alert.alert('성공', 'Google 로그인이 완료되었습니다!');
      }, 300);
    } catch (error) {
      console.error('Google 로그인 오류:', error);
      
      const errorMessage = error instanceof Error ? error.message : '';
      
      // ✅ DEVELOPER_ERROR 감지
      if (errorMessage.includes('DEVELOPER_ERROR')) {
        Alert.alert(
          'Google 로그인 설정 오류',
          'Google Sign-In이 올바르게 설정되지 않았습니다.\n\n' +
          '가능한 원인:\n' +
          '• SHA-1 인증서가 Firebase에 등록되지 않음\n' +
          '• OAuth 클라이언트 ID 불일치\n\n' +
          '임시로 다른 로그인 방법을 이용해주세요.',
          [{ text: '확인' }]
        );
        return;
      }
      
      // ✅ Google Play Services 오류 처리
      if (errorMessage.includes('Google Play Services')) {
        Alert.alert(
          'Google Play Services 필요',
          errorMessage,
          [
            { text: '카카오 로그인', onPress: () => handleKakaoLogin() },
            { text: '취소', style: 'cancel' }
          ]
        );
        return;
      }
      
      // 사용자가 취소한 경우는 알림을 표시하지 않음
      if (!errorMessage.includes('취소')) {
        Alert.alert('Google 로그인 실패', errorMessage || 'Google 로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>인</Text>
            </View>
          </View>
          <Text style={styles.title}>인스쿨즈</Text>
          <Text style={styles.subtitle}>학생들을 위한 스마트한 커뮤니티</Text>
        </View>

        {/* 메인 카드 */}
        <View style={styles.card}>
          {/* 헤더 */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>로그인</Text>
          </View>
          
          {/* 폼 */}
          <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>이메일</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    value={emailForm.email}
                    onChangeText={(text) => setEmailForm(prev => ({ ...prev, email: text }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>비밀번호</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="비밀번호를 입력하세요"
                      value={emailForm.password}
                      onChangeText={(text) => setEmailForm(prev => ({ ...prev, password: text }))}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons 
                        name={showPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color="#6B7280" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleEmailLogin}
                  disabled={isLoading}
                >
                  <Text style={styles.submitButtonText}>
                    {isLoading ? '로그인 중...' : '로그인'}
                  </Text>
                </TouchableOpacity>

                {/* 구분선 */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>또는</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* 카카오 로그인 버튼 */}
                <TouchableOpacity 
                  style={[styles.kakaoButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleKakaoLogin}
                  disabled={isLoading}
                >
                  <Ionicons name="chatbubble" size={20} color="#000" style={styles.kakaoIcon} />
                  <Text style={styles.kakaoButtonText}>
                    카카오로 로그인
                  </Text>
                </TouchableOpacity>

                {/* Google 로그인 버튼 (Expo Go가 아닐 때만 표시) */}
                {!isExpoGo && (
                  <TouchableOpacity 
                    style={[styles.googleButton, isLoading && styles.submitButtonDisabled]}
                    onPress={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="logo-google" size={20} color="#fff" style={styles.googleIcon} />
                    <Text style={styles.googleButtonText}>
                      Google로 로그인
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Apple 로그인 버튼 (iOS에서만 표시) */}
                {isAppleLoginAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={8}
                    style={styles.appleButton}
                    onPress={handleAppleLogin}
                  />
                )}
          </View>
        </View>

        {/* 회원가입 링크 */}
        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>
            아직 계정이 없으신가요?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={styles.linkButton}>회원가입하기</Text>
          </TouchableOpacity>
        </View>

        {/* 푸터 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            계속 진행하면{' '}
            <Text style={styles.footerLink}>서비스 약관</Text>과{' '}
            <Text style={styles.footerLink}>개인정보 처리방침</Text>에 동의하는 것으로 간주됩니다.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 48,
    height: 48,
    backgroundColor: '#059669',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 24,
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 16,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  methodSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    padding: 4,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  methodButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  methodTextActive: {
    color: '#059669',
  },
  form: {
    padding: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 48,
    fontSize: 16,
    backgroundColor: 'white',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: 18,
  },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoIcon: {
    marginRight: 8,
  },
  kakaoButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  googleIcon: {
    marginRight: 8,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    height: 48,
    marginTop: 12,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
  },
  linkButton: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#059669',
  },
});
