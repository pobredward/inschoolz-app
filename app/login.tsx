import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { loginWithEmail, authenticateWithPhoneNumber, loginWithKakao } from '../lib/auth';
import { router } from 'expo-router';
// import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha'; // 임시 비활성화
import { PhoneAuthProvider } from 'firebase/auth';
import { auth, firebaseConfig, recaptchaSiteKeys } from '../lib/firebase';

export default function LoginScreen() {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  
  // 이메일 폼 상태
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: ''
  });
  
  // 휴대폰 폼 상태
  const [phoneForm, setPhoneForm] = useState({
    phoneNumber: '',
    verificationCode: ''
  });
  
  // 휴대폰 인증 관련 상태
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  const { setUser, setLoading, isLoading } = useAuthStore();
  // const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null); // 임시 비활성화

  // 휴대폰 번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 카운트다운 타이머
  const startCountdown = () => {
    setCountdown(180); // 3분
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

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
      
      Alert.alert('성공', '로그인되었습니다!', [
        { text: '확인', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      console.error('이메일 로그인 오류:', error);
      Alert.alert('로그인 실패', error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 휴대폰 인증번호 발송
  const sendPhoneVerification = async () => {
    if (!phoneForm.phoneNumber?.trim()) {
      Alert.alert('오류', '휴대폰 번호를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const phoneNumber = `+82${phoneForm.phoneNumber.replace(/[^\d]/g, '').substring(1)}`;
      
      const phoneProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneProvider.verifyPhoneNumber(
        phoneNumber,
        null! // 임시 비활성화
      );
      
      setVerificationId(verificationId);
      setIsCodeSent(true);
      startCountdown();
      
      Alert.alert('성공', '인증번호가 발송되었습니다.');
    } catch (error: any) {
      console.error('인증번호 발송 오류:', error);
      Alert.alert('오류', error.message || '인증번호 발송 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 휴대폰 로그인
  const handlePhoneLogin = async () => {
    if (!phoneForm.verificationCode?.trim()) {
      Alert.alert('오류', '인증번호를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const user = await authenticateWithPhoneNumber(verificationId, phoneForm.verificationCode.trim());
      setUser(user);
      
      Alert.alert('성공', '로그인되었습니다!', [
        { text: '확인', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      console.error('휴대폰 로그인 오류:', error);
      Alert.alert('로그인 실패', error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카카오 로그인
  const handleKakaoLogin = async () => {
    try {
      setLoading(true);
      const user = await loginWithKakao();
      setUser(user);
      
      Alert.alert('성공', '카카오 로그인이 완료되었습니다!', [
        { text: '확인', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      Alert.alert('카카오 로그인 실패', error.message || '카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
          
          {/* 인증 방법 선택 */}
          <View style={styles.methodSelector}>
            <TouchableOpacity
              style={[styles.methodButton, authMethod === 'email' && styles.methodButtonActive]}
              onPress={() => {
                setAuthMethod('email');
                setIsCodeSent(false);
              }}
            >
              <Ionicons name="mail" size={16} color={authMethod === 'email' ? '#059669' : '#6B7280'} />
              <Text style={[styles.methodText, authMethod === 'email' && styles.methodTextActive]}>
                이메일
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodButton, authMethod === 'phone' && styles.methodButtonActive]}
              onPress={() => {
                setAuthMethod('phone');
                setIsCodeSent(false);
              }}
            >
              <Ionicons name="call" size={16} color={authMethod === 'phone' ? '#059669' : '#6B7280'} />
              <Text style={[styles.methodText, authMethod === 'phone' && styles.methodTextActive]}>
                휴대폰
              </Text>
            </TouchableOpacity>
          </View>

          {/* 폼 */}
          <View style={styles.form}>
            {authMethod === 'email' ? (
              <>
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
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>휴대폰 번호</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="010-1234-5678"
                    value={phoneForm.phoneNumber}
                    onChangeText={(text) => setPhoneForm(prev => ({ 
                      ...prev, 
                      phoneNumber: formatPhoneNumber(text)
                    }))}
                    keyboardType="phone-pad"
                    maxLength={13}
                  />
                </View>

                {!isCodeSent ? (
                  <TouchableOpacity 
                    style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                    onPress={sendPhoneVerification}
                    disabled={isLoading}
                  >
                    <Text style={styles.submitButtonText}>
                      {isLoading ? '발송 중...' : '인증번호 발송'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <View style={styles.labelContainer}>
                        <Text style={styles.label}>인증번호</Text>
                        {countdown > 0 && (
                          <Text style={styles.countdownText}>{formatTime(countdown)}</Text>
                        )}
                      </View>
                      <TextInput
                        style={[styles.input, styles.codeInput]}
                        placeholder="6자리 인증번호"
                        value={phoneForm.verificationCode}
                        onChangeText={(text) => setPhoneForm(prev => ({ 
                          ...prev, 
                          verificationCode: text.replace(/[^\d]/g, '').slice(0, 6)
                        }))}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>

                    <TouchableOpacity 
                      style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                      onPress={handlePhoneLogin}
                      disabled={isLoading}
                    >
                      <Text style={styles.submitButtonText}>
                        {isLoading ? '로그인 중...' : '로그인'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </View>

        {/* 카카오 로그인 */}
        <View style={styles.socialContainer}>
          <Text style={styles.dividerText}>또는</Text>
          <TouchableOpacity 
            style={styles.kakaoButton}
            onPress={handleKakaoLogin}
            disabled={isLoading}
          >
            <View style={styles.kakaoButtonContent}>
              <Text style={styles.kakaoButtonText}>카카오로 로그인</Text>
            </View>
          </TouchableOpacity>
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

      {/* 임시 비활성화: RecaptchaV2
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        androidHardwareAccelerationDisabled={true}
        attemptInvisibleVerification={false}
        title="reCAPTCHA 인증"
        cancelLabel="취소"
      />
      */}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
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
  socialContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  dividerText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  kakaoButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kakaoButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
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
