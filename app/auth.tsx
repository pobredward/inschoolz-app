import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { loginWithEmail } from '../lib/auth';
import { router } from 'expo-router';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { setUser, setLoading, isLoading, error } = useAuthStore();

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    try {
      setLoading(true);
      const user = await loginWithEmail(email, password);
      setUser(user);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSignup = () => {
    router.replace('/signup');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>인스쿨즈</Text>
      <Text style={styles.subtitle}>학교 커뮤니티에 오신 것을 환영합니다</Text>
      <View style={styles.form}>
        {isLogin ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="비밀번호"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#9ca3af"
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                keyboardType="default"
                importantForAutofill="no"
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
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleAuth}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? '처리 중...' : '로그인'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleStartSignup}>
            <Text style={styles.buttonText}>단계별 회원가입 시작</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.switchText}>
            {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </Text>
        </TouchableOpacity>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    alignItems: 'center',
    padding: 8,
  },
  switchText: {
    color: '#2563eb',
    fontSize: 14,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
}); 