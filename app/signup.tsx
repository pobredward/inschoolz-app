import React, { useState } from 'react';
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
import { useAuthStore } from '../store/authStore';
import { registerWithEmail, checkUserNameAvailability, checkEmailExists } from '../lib/auth';
import { loginWithKakaoOptimized } from '../lib/kakao';
import { router } from 'expo-router';
import { ReferralSearch } from '../components/ReferralSearch';
import { generateNickname } from '../utils/nickname-generator';

export default function SignupScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
  // 이메일 폼 상태 (userName 제거)
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    referral: ''
  });
  
  // 추천인 검색 상태
  const [selectedReferralUser, setSelectedReferralUser] = useState<any>(null);
  
  // 자동 생성된 닉네임 상태
  const [generatedNickname, setGeneratedNickname] = useState<string>('');
  
  const { setUser, setLoading, isLoading, waitForAuthSync } = useAuthStore();

  // 카카오 로그인
  const handleKakaoLogin = async () => {
    try {
      setLoading(true);
      const user = await loginWithKakaoOptimized();
      setUser(user);
      
      // Firebase Auth 상태 동기화 대기 (최대 3초)
      const isSynced = await waitForAuthSync(3000);
      if (!isSynced) {
        console.warn('Auth 동기화 타임아웃, 그래도 진행합니다.');
      }
      
      Alert.alert('성공', '카카오 로그인이 완료되었습니다!', [
        { text: '확인', onPress: () => router.replace('/(tabs)/') }
      ]);
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      Alert.alert('카카오 로그인 실패', error.message || '카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 닉네임 자동 생성 및 중복 확인
  const generateAndCheckNickname = async (): Promise<string> => {
    let attempts = 0;
    let nickname: string;
    
    do {
      nickname = generateNickname('middle'); // 기본값으로 중학교 설정
      attempts++;
      
      const isAvailable = await checkUserNameAvailability(nickname);
      if (isAvailable) {
        return nickname;
      }
    } while (attempts < 10);
    
    // 10번 시도해도 실패하면 타임스탬프 추가
    return generateNickname('middle') + '_' + Date.now().toString().slice(-4);
  };



  // 이메일 회원가입
  const handleEmailSignup = async () => {
    if (!emailForm.email?.trim() || !emailForm.password?.trim() || !emailForm.passwordConfirm?.trim()) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (emailForm.password !== emailForm.passwordConfirm) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    if (emailForm.password.length < 6) {
      Alert.alert('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    try {
      setLoading(true);
      
      // 이메일 중복 확인
      const emailExistsResult = await checkEmailExists(emailForm.email);
      if (emailExistsResult) {
        Alert.alert('오류', '이미 가입된 이메일입니다. 로그인 화면에서 로그인 바랍니다.');
        return;
      }

      // 닉네임 자동 생성 및 중복 확인
      const userName = await generateAndCheckNickname();
      setGeneratedNickname(userName);

      const user = await registerWithEmail(
        emailForm.email, 
        emailForm.password, 
        userName,
        {
          referral: selectedReferralUser?.userName || emailForm.referral.trim()
        }
      );
      setUser(user);
      
      // Firebase Auth 상태 동기화 대기 (최대 3초)
      const isSynced = await waitForAuthSync(3000);
      if (!isSynced) {
        console.warn('Auth 동기화 타임아웃, 그래도 진행합니다.');
      }
      
      Alert.alert('성공', '회원가입이 완료되었습니다!', [
        { text: '확인', onPress: () => router.replace('/(tabs)/') }
      ]);
    } catch (error: any) {
      console.error('이메일 회원가입 오류:', error);
      Alert.alert('회원가입 실패', error.message || '회원가입 중 오류가 발생했습니다.');
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
            <Text style={styles.cardTitle}>회원가입</Text>
          </View>
          
          {/* 폼 */}
          <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>이메일</Text>
                  <TextInput
                    style={[styles.input, emailExists && styles.inputError]}
                    placeholder="name@example.com"
                    value={emailForm.email}
                    onChangeText={(text) => {
                      setEmailForm(prev => ({ ...prev, email: text }));
                      setEmailExists(false);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {emailExists && (
                    <Text style={styles.errorText}>이미 가입된 이메일입니다.</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>비밀번호</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="비밀번호를 입력하세요 (최소 6자)"
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

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>비밀번호 확인</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="비밀번호를 다시 입력하세요"
                      value={emailForm.passwordConfirm}
                      onChangeText={(text) => setEmailForm(prev => ({ ...prev, passwordConfirm: text }))}
                      secureTextEntry={!showPasswordConfirm}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    >
                      <Ionicons 
                        name={showPasswordConfirm ? "eye-off" : "eye"} 
                        size={20} 
                        color="#6B7280" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 추천인 아이디 */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>추천인 아이디 (선택사항)</Text>
                  <ReferralSearch
                    value={emailForm.referral}
                    onSelect={(user) => {
                      setSelectedReferralUser(user);
                      if (user) {
                        setEmailForm(prev => ({ ...prev, referral: user.userName }));
                      } else {
                        setEmailForm(prev => ({ ...prev, referral: '' }));
                      }
                    }}
                    placeholder="추천인 아이디를 검색하세요"
                    style={{ marginBottom: 8 }}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleEmailSignup}
                  disabled={isLoading}
                >
                  <Text style={styles.submitButtonText}>
                    {isLoading ? '가입 중...' : '회원가입'}
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
                    카카오로 간편가입
                  </Text>
                </TouchableOpacity>
          </View>
        </View>

        {/* 로그인 링크 */}
        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>
            이미 계정이 있으신가요?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.linkButton}>로그인하기</Text>
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
  inputError: {
    borderColor: '#EF4444',
  },
  inputSuccess: {
    borderColor: '#10B981',
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
  userNameContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  userNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  checkButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  checkButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
  successText: {
    fontSize: 12,
    color: '#10B981',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
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
