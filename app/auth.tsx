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
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { loginWithEmail, registerWithEmail, authenticateWithPhoneNumber, checkUserNameAvailability, checkPhoneNumberExists, checkEmailExists } from '../lib/auth';
import { router } from 'expo-router';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider } from 'firebase/auth';
import { auth, firebaseConfig, recaptchaSiteKeys } from '../lib/firebase';


export default function SimpleAuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
  // 이메일 폼 상태
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    userName: ''
  });
  
  // 휴대폰 폼 상태
  const [phoneForm, setPhoneForm] = useState({
    phoneNumber: '',
    verificationCode: '',
    userName: '',
  });
  
  // 휴대폰 인증 관련 상태
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  // 중복 확인 상태
  const [emailUserNameStatus, setEmailUserNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [phoneUserNameStatus, setPhoneUserNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [emailExists, setEmailExists] = useState<boolean>(false);
  const [phoneNumberExists, setPhoneNumberExists] = useState<boolean>(false);
  
  const { setUser, setLoading, isLoading } = useAuthStore();
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  // 휴대폰 번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 이메일 닉네임 중복 확인
  const checkEmailUserName = async () => {
    const userName = emailForm.userName?.trim();
    
    if (!userName || userName.length < 2) {
      Alert.alert('오류', '닉네임은 최소 2자 이상이어야 합니다.');
      return;
    }

    try {
      setEmailUserNameStatus('checking');
      const isAvailable = await checkUserNameAvailability(userName);
      setEmailUserNameStatus(isAvailable ? 'available' : 'taken');
      
      if (isAvailable) {
        Alert.alert('성공', '사용 가능한 닉네임입니다.');
      } else {
        Alert.alert('오류', '이미 사용 중인 닉네임입니다.');
      }
    } catch {
      setEmailUserNameStatus('idle');
      Alert.alert('오류', '중복 확인 중 오류가 발생했습니다.');
    }
  };

  // 휴대폰 닉네임 중복 확인
  const checkPhoneUserName = async () => {
    const userName = phoneForm.userName?.trim();
    
    if (!userName || userName.length < 2) {
      Alert.alert('오류', '닉네임은 최소 2자 이상이어야 합니다.');
      return;
    }

    try {
      setPhoneUserNameStatus('checking');
      const isAvailable = await checkUserNameAvailability(userName);
      setPhoneUserNameStatus(isAvailable ? 'available' : 'taken');
      
      if (isAvailable) {
        Alert.alert('성공', '사용 가능한 닉네임입니다.');
      } else {
        Alert.alert('오류', '이미 사용 중인 닉네임입니다.');
      }
    } catch {
      setPhoneUserNameStatus('idle');
      Alert.alert('오류', '중복 확인 중 오류가 발생했습니다.');
    }
  };

  // 인증번호 발송
  const sendVerificationCode = async () => {
    try {
      const phoneNumber = '+82' + phoneForm.phoneNumber.replace(/[^\d]/g, '').slice(1);
      
      setLoading(true);
      
      // 회원가입 시 휴대폰 번호 중복 확인
      if (!isLogin) {
        const phoneExists = await checkPhoneNumberExists(phoneForm.phoneNumber);
        if (phoneExists) {
          setPhoneNumberExists(true);
          setLoading(false);
          Alert.alert('오류', '이미 가입된 번호입니다. 로그인 화면에서 로그인 바랍니다.');
          return;
        }
      }
      
      const phoneProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneProvider.verifyPhoneNumber(
        phoneNumber,
        recaptchaVerifier.current!
      );
      
      setVerificationId(verificationId);
      setIsCodeSent(true);
      
      // 5분 카운트다운 시작
      setCountdown(300);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCodeSent(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      Alert.alert('성공', '인증번호가 발송되었습니다.');
    } catch (error) {
      console.error('인증번호 발송 실패:', error);
      Alert.alert('오류', '인증번호 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 이메일 인증
  const handleEmailAuth = async () => {
    if (!emailForm.email || !emailForm.password) {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (!isLogin) {
      // 회원가입 시 추가 검증
      if (!emailForm.userName || emailForm.userName.trim().length < 2) {
        Alert.alert('오류', '닉네임을 2자 이상 입력해주세요.');
        return;
      }

      if (emailUserNameStatus !== 'available') {
        Alert.alert('오류', '닉네임 중복 확인을 해주세요.');
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
    }

    try {
      setLoading(true);
      
      if (isLogin) {
        const user = await loginWithEmail(emailForm.email, emailForm.password);
        setUser(user);
      } else {
        // 회원가입 시 이메일 중복 확인
        const emailExistsResult = await checkEmailExists(emailForm.email);
        if (emailExistsResult) {
          setEmailExists(true);
          Alert.alert('오류', '이미 가입된 이메일입니다. 로그인 화면에서 로그인 바랍니다.');
          return;
        }

        // 최종 userName 중복 확인 (동시 가입 방지)
        const isUserNameAvailable = await checkUserNameAvailability(emailForm.userName);
        if (!isUserNameAvailable) {
          Alert.alert('오류', '죄송합니다. 해당 닉네임이 방금 다른 사용자에 의해 사용되었습니다.');
          setEmailUserNameStatus('taken');
          return;
        }

        const user = await registerWithEmail(emailForm.email, emailForm.password, emailForm.userName.trim());
        setUser(user);
      }
      
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 휴대폰 인증
  const handlePhoneAuth = async () => {
    if (!isLogin && (!phoneForm.userName || phoneForm.userName.trim().length < 2)) {
      Alert.alert('오류', '닉네임을 2자 이상 입력해주세요.');
      return;
    }

    if (!isLogin && phoneUserNameStatus !== 'available') {
      Alert.alert('오류', '닉네임 중복 확인을 해주세요.');
      return;
    }

    if (!phoneForm.verificationCode || phoneForm.verificationCode.length !== 6) {
      Alert.alert('오류', '6자리 인증번호를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      // 새로운 인증 함수 사용 (로그인/회원가입 모두 처리)
      const user = await authenticateWithPhoneNumber(
        verificationId, 
        phoneForm.verificationCode,
        isLogin ? undefined : phoneForm.userName.trim()
      );
      
      // AuthStore에 사용자 정보 저장
      setUser(user);
      
      if (isLogin) {
        Alert.alert('성공', '로그인되었습니다.');
      } else {
        Alert.alert('성공', '회원가입이 완료되었습니다.');
      }
      
      router.replace('/(tabs)');
    } catch (error) {
      console.error('휴대폰 인증 실패:', error);
      Alert.alert('오류', error instanceof Error ? error.message : '인증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.gradientBackground}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaVerifier}
            firebaseConfig={firebaseConfig}
            // reCAPTCHA Enterprise 호환성 설정
            attemptInvisibleVerification={true}
            language="ko"
          />
          
          {/* 로고 및 헤더 */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>인</Text>
            </View>
            <Text style={styles.title}>인스쿨즈</Text>
            <Text style={styles.subtitle}>학생들을 위한 스마트한 커뮤니티</Text>
          </View>

          {/* 메인 카드 */}
          <View style={styles.card}>
            {/* 로그인/회원가입 토글 */}
            <View style={styles.authToggle}>
              <TouchableOpacity
                style={[styles.authToggleButton, isLogin && styles.authToggleButtonActive]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.authToggleText, isLogin && styles.authToggleTextActive]}>
                  로그인
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authToggleButton, !isLogin && styles.authToggleButtonActive]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.authToggleText, !isLogin && styles.authToggleTextActive]}>
                  회원가입
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* 인증 방법 선택 */}
            <View style={styles.methodSelector}>
              <TouchableOpacity
                style={[styles.methodButton, authMethod === 'email' && styles.methodButtonActive]}
                onPress={() => setAuthMethod('email')}
              >
                <Ionicons 
                  name="mail" 
                  size={20} 
                  color={authMethod === 'email' ? '#059669' : '#9ca3af'} 
                />
                <Text style={[styles.methodText, authMethod === 'email' && styles.methodTextActive]}>
                  이메일
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodButton, authMethod === 'phone' && styles.methodButtonActive]}
                onPress={() => setAuthMethod('phone')}
              >
                <Ionicons 
                  name="call" 
                  size={20} 
                  color={authMethod === 'phone' ? '#059669' : '#9ca3af'} 
                />
                <Text style={[styles.methodText, authMethod === 'phone' && styles.methodTextActive]}>
                  휴대폰
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* 폼 */}
            <View style={styles.form}>
              {authMethod === 'email' ? (
                // 이메일 폼
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="이메일"
                      value={emailForm.email}
                      onChangeText={(text) => {
                        setEmailForm(prev => ({ ...prev, email: text }));
                        setEmailExists(false); // 입력 시 중복 상태 초기화
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  
                  {/* 이메일 중복 에러 메시지 */}
                  {emailExists && (
                    <Text style={styles.errorText}>
                      이미 가입된 이메일입니다. 로그인 화면에서 로그인 바랍니다.
                    </Text>
                  )}
                  
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="비밀번호"
                      value={emailForm.password}
                      onChangeText={(text) => setEmailForm(prev => ({ ...prev, password: text }))}
                      secureTextEntry={!showPassword}
                      placeholderTextColor="#9ca3af"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#9ca3af"
                      />
                    </TouchableOpacity>
                  </View>
                  
                  {!isLogin && (
                    <>
                      <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder="비밀번호 확인"
                          value={emailForm.passwordConfirm}
                          onChangeText={(text) => setEmailForm(prev => ({ ...prev, passwordConfirm: text }))}
                          secureTextEntry={!showPasswordConfirm}
                          placeholderTextColor="#9ca3af"
                        />
                        <TouchableOpacity
                          onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
                          style={styles.eyeButton}
                        >
                          <Ionicons
                            name={showPasswordConfirm ? 'eye-off' : 'eye'}
                            size={20}
                            color="#9ca3af"
                          />
                        </TouchableOpacity>
                      </View>

                      {/* 닉네임 입력 및 중복 확인 */}
                      <View style={styles.userNameContainer}>
                        <View style={[styles.inputContainer, { flex: 1 }]}>
                          <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="닉네임 (2자 이상)"
                            value={emailForm.userName}
                            onChangeText={(text) => {
                              setEmailForm(prev => ({ ...prev, userName: text }));
                              setEmailUserNameStatus('idle'); // 입력 시 상태 초기화
                            }}
                            autoCapitalize="none"
                            placeholderTextColor="#9ca3af"
                          />
                          {emailUserNameStatus === 'available' && (
                            <Ionicons name="checkmark-circle" size={20} color="#059669" style={{ marginLeft: 8 }} />
                          )}
                          {emailUserNameStatus === 'taken' && (
                            <Ionicons name="close-circle" size={20} color="#dc2626" style={{ marginLeft: 8 }} />
                          )}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.checkButton,
                            (emailUserNameStatus === 'checking' || !emailForm.userName?.trim() || emailForm.userName.trim().length < 2) && styles.checkButtonDisabled
                          ]}
                          onPress={checkEmailUserName}
                          disabled={emailUserNameStatus === 'checking' || !emailForm.userName?.trim() || emailForm.userName.trim().length < 2}
                        >
                          <Text style={styles.checkButtonText}>
                            {emailUserNameStatus === 'checking' ? '확인중' : '중복확인'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* 닉네임 상태 메시지 */}
                      {emailUserNameStatus === 'available' && (
                        <Text style={styles.successText}>사용 가능한 닉네임입니다.</Text>
                      )}
                      {emailUserNameStatus === 'taken' && (
                        <Text style={styles.errorText}>이미 사용 중인 닉네임입니다.</Text>
                      )}
                    </>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.submitButton} 
                    onPress={handleEmailAuth}
                    disabled={isLoading}
                  >
                    <Text style={styles.submitButtonText}>
                      {isLoading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                // 휴대폰 폼
                <>
                  {/* 휴대폰 번호 입력 */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="010-1234-5678"
                      value={phoneForm.phoneNumber}
                      onChangeText={(text) => {
                        const formatted = formatPhoneNumber(text);
                        setPhoneForm(prev => ({ ...prev, phoneNumber: formatted }));
                        setPhoneNumberExists(false); // 입력 시 중복 상태 초기화
                      }}
                      keyboardType="phone-pad"
                      maxLength={13}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  
                  {/* 휴대폰 번호 중복 에러 메시지 */}
                  {phoneNumberExists && (
                    <Text style={styles.errorText}>
                      이미 가입된 번호입니다. 로그인 화면에서 로그인 바랍니다.
                    </Text>
                  )}

                  {/* 회원가입 시 닉네임 입력 및 중복 확인 */}
                  {!isLogin && (
                    <>
                      <View style={styles.userNameContainer}>
                        <View style={[styles.inputContainer, { flex: 1 }]}>
                          <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="닉네임 (2자 이상)"
                            value={phoneForm.userName}
                            onChangeText={(text) => {
                              setPhoneForm(prev => ({ ...prev, userName: text }));
                              setPhoneUserNameStatus('idle'); // 입력 시 상태 초기화
                            }}
                            autoCapitalize="none"
                            placeholderTextColor="#9ca3af"
                          />
                          {phoneUserNameStatus === 'available' && (
                            <Ionicons name="checkmark-circle" size={20} color="#059669" style={{ marginLeft: 8 }} />
                          )}
                          {phoneUserNameStatus === 'taken' && (
                            <Ionicons name="close-circle" size={20} color="#dc2626" style={{ marginLeft: 8 }} />
                          )}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.checkButton,
                            (phoneUserNameStatus === 'checking' || !phoneForm.userName?.trim() || phoneForm.userName.trim().length < 2) && styles.checkButtonDisabled
                          ]}
                          onPress={checkPhoneUserName}
                          disabled={phoneUserNameStatus === 'checking' || !phoneForm.userName?.trim() || phoneForm.userName.trim().length < 2}
                        >
                          <Text style={styles.checkButtonText}>
                            {phoneUserNameStatus === 'checking' ? '확인중' : '중복확인'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* 닉네임 상태 메시지 */}
                      {phoneUserNameStatus === 'available' && (
                        <Text style={styles.successText}>사용 가능한 닉네임입니다.</Text>
                      )}
                      {phoneUserNameStatus === 'taken' && (
                        <Text style={styles.errorText}>이미 사용 중인 닉네임입니다.</Text>
                      )}
                    </>
                  )}

                  {/* 인증번호 발송 버튼 */}
                  {!isCodeSent && (
                    <TouchableOpacity
                      style={[
                        styles.codeButton, 
                        (isLoading || phoneForm.phoneNumber.length < 13) && styles.codeButtonDisabled
                      ]}
                      onPress={sendVerificationCode}
                      disabled={isLoading || phoneForm.phoneNumber.length < 13}
                    >
                      <Text style={styles.codeButtonText}>
                        {isLoading ? '발송 중...' : '인증번호 발송'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* 카운트다운 표시 */}
                  {isCodeSent && countdown > 0 && (
                    <Text style={styles.countdownText}>
                      인증번호 재발송까지: {formatTime(countdown)}
                    </Text>
                  )}

                  {isCodeSent && (
                    <View style={styles.inputContainer}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="6자리 인증번호"
                        value={phoneForm.verificationCode}
                        onChangeText={(text) => {
                          const numbers = text.replace(/[^\d]/g, '').slice(0, 6);
                          setPhoneForm(prev => ({ ...prev, verificationCode: numbers }));
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={[styles.submitButton, (!isCodeSent) && styles.submitButtonDisabled]} 
                    onPress={handlePhoneAuth}
                    disabled={isLoading || !isCodeSent}
                  >
                    <Text style={styles.submitButtonText}>
                      {isLoading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: '#059669',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  authToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  authToggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  authToggleButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  authToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  authToggleTextActive: {
    color: '#374151',
  },
  methodSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    gap: 8,
  },
  methodButtonActive: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  methodText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9ca3af',
  },
  methodTextActive: {
    color: '#059669',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#374151',
  },
  eyeButton: {
    padding: 8,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  checkButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  checkButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  checkButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  codeButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  codeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  codeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  successText: {
    color: '#059669',
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  countdownText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
});