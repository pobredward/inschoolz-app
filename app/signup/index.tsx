import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { registerWithEmail } from '../../lib/auth';
import { checkEmailAvailability, checkUserNameAvailability } from '../../lib/users';
import { useAuthStore } from '../../store/authStore';
// 기본 logger 함수
const logger = {
  debug: (message: string, ...args: any[]) => {
    if (__DEV__) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (__DEV__) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
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

import Step1BasicInfo from './step1-basic-info';
import Step2School from './step2-school';
import Step3Region from './step3-region';
import Step4Profile from './step4-profile';

export default function SignupContainer() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUser } = useAuthStore();
  const [formData, setFormData] = useState({
    // 1단계: 이메일, 비밀번호
    email: '',
    password: '',
    confirmPassword: '',
    
    // 2단계: 학교 정보
    school: {
      id: '',
      name: '',
      grade: null,
      classNumber: null,
      studentNumber: null,
      isGraduate: null,
    },
    
    // 3단계: 지역 정보
    regions: {
      sido: '',
      sigungu: '',
      address: '',
    },
    
    // 4단계: 세부 정보
    userName: '',
    realName: '',
    gender: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    phoneNumber: '',
    referral: '',
    
    // 4단계: 약관 동의
    termsAgreed: false,
    privacyAgreed: false,
    locationAgreed: false,
    marketingAgreed: false,
    
    // 즐겨찾기 정보
    favorites: {
      schools: [],
      boards: []
    },
  });

  const updateForm = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    logger.debug('SignupContainer handleSubmit 시작');
    
    try {
      setIsSubmitting(true);
      
      // 필수 필드 검증
      if (!formData.email || !formData.password) {
        logger.warn('이메일/비밀번호 검증 실패');
        Alert.alert('오류', '이메일과 비밀번호는 필수 입력 항목입니다.');
        return;
      }

      if (!formData.termsAgreed || !formData.privacyAgreed || !formData.locationAgreed) {
        logger.warn('약관 동의 검증 실패');
        Alert.alert('오류', '필수 약관에 모두 동의해주세요.');
        return;
      }

      // 최종 userName 중복 체크 (보안 강화)
      if (formData.userName) {
        try {
          const userNameCheck = await checkUserNameAvailability(formData.userName);
          if (!userNameCheck.isAvailable) {
            Alert.alert('사용자명 오류', userNameCheck.message);
            return;
          }
        } catch (error) {
          Alert.alert('사용자명 확인 오류', '사용자명 확인 중 오류가 발생했습니다.');
          return;
        }
      }

      // 최종 이메일 중복 체크 (보안 강화)
      if (formData.email) {
        try {
          const emailCheck = await checkEmailAvailability(formData.email);
          if (!emailCheck.isAvailable) {
            Alert.alert('이메일 오류', emailCheck.message);
            return;
          }
        } catch (error) {
          Alert.alert('이메일 확인 오류', '이메일 확인 중 오류가 발생했습니다.');
          return;
        }
      }

      logger.debug('SignupContainer 검증 통과, registerWithEmail 호출 시작');
      
      // Firebase에 회원가입 요청 (웹과 동일한 구조로 수정)
      const newUser = await registerWithEmail(
        formData.email,
        formData.password,
        formData.userName,
        {
          realName: formData.realName,
          gender: formData.gender,
          birthYear: Number(formData.birthYear),
          birthMonth: Number(formData.birthMonth),
          birthDay: Number(formData.birthDay),
          phoneNumber: formData.phoneNumber,
          schoolId: formData.school?.id,
          schoolName: formData.school?.name,
          province: formData.regions?.sido,
          city: formData.regions?.sigungu,
          referral: formData.referral,
          termsAgreed: formData.termsAgreed,
          privacyAgreed: formData.privacyAgreed,
          locationAgreed: formData.locationAgreed,
          marketingAgreed: formData.marketingAgreed,
          favorites: formData.favorites, // favorites 정보도 전달
        }
      );
      
      logger.debug('registerWithEmail 완료');
      
      // 사용자 정보를 AuthStore에 설정 (자동 로그인)
      if (newUser) {
        logger.debug('사용자 정보를 AuthStore에 설정');
        setUser(newUser);
      }
      
      Alert.alert(
        '회원가입 성공',
        '회원가입이 완료되었습니다. 환영합니다!',
        [
          {
            text: '확인',
            onPress: () => {
              logger.info('메인 페이지로 이동');
              // 약간의 지연 후 이동 (AuthStore 상태 업데이트 대기)
              setTimeout(() => {
                router.replace('/');
              }, 500);
            }
          }
        ]
      );
    } catch (error) {
      logger.error('회원가입 오류:', error);
      Alert.alert('오류', error instanceof Error ? error.message : '회원가입 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1BasicInfo
            formData={formData}
            updateForm={updateForm}
            nextStep={nextStep}
          />
        );
      case 2:
        return (
          <Step2School
            formData={formData}
            updateForm={updateForm}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 3:
        return (
          <Step3Region
            formData={formData}
            updateForm={updateForm}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 4:
        return (
          <Step4Profile
            formData={formData}
            updateForm={updateForm}
            onSubmit={handleSubmit}
            prevStep={prevStep}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>회원가입</Text>
        
        <View style={styles.headerRight} />
      </View>
      
      {/* 컨텐츠 */}
      <View style={styles.content}>
        {renderCurrentStep()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  headerRight: {
    width: 40, // backButton과 같은 너비로 중앙 정렬
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
}); 