import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';
import { logger } from '../utils/logger';
import { generateUserSearchTokens } from '../utils/search-tokens';
import { Platform } from 'react-native';

/**
 * Google Sign-In 초기화
 * iOS와 Android 모두 지원
 */
export const initializeGoogleSignIn = () => {
  try {
    GoogleSignin.configure({
      // iOS Client ID (필수)
      iosClientId: '702584515843-mt6584jc65q4e02qq6snip7qi12fpe2t.apps.googleusercontent.com',
      // Web Client ID (Android에서 필요)
      webClientId: '702584515843-i4g6uf5nki2vvp14rk1gql61b2s8mear.apps.googleusercontent.com',
      // 오프라인 액세스 요청 (서버에서 토큰 갱신 가능)
      offlineAccess: false,
      // 사용자 프로필과 이메일 요청
      scopes: ['profile', 'email'],
    });
    
    logger.debug('Google Sign-In 초기화 완료', {
      platform: Platform.OS
    });
  } catch (error) {
    logger.error('Google Sign-In 초기화 실패:', error);
    throw error;
  }
};

/**
 * Google 사용자 정보를 Firestore User 형식으로 변환
 */
const convertGoogleUserToFirebaseUser = (
  googleUser: {
    user: {
      id: string;
      email: string | null;
      name: string | null;
      photo: string | null;
    };
  },
  uid: string
): Omit<User, 'createdAt' | 'updatedAt'> => {
  const userName = googleUser.user.name || `구글사용자${googleUser.user.id}`;
  const searchTokens = generateUserSearchTokens(userName);

  return {
    uid,
    email: googleUser.user.email || '',
    role: 'student',
    isVerified: true,
    fake: false, // 실제 사용자 표시
    searchTokens,
    profile: {
      userName,
      realName: '',
      gender: '',
      birthYear: 0,
      birthMonth: 0,
      birthDay: 0,
      phoneNumber: '',
      profileImageUrl: googleUser.user.photo || '',
      createdAt: Timestamp.now(),
      isAdmin: false
    },
    stats: {
      level: 1,
      currentExp: 0,
      totalExperience: 0,
      currentLevelRequiredXp: 10,
      postCount: 0,
      commentCount: 0,
      likeCount: 0,
      streak: 0
    },
    agreements: {
      terms: false,
      privacy: false,
      location: false,
      marketing: false
    }
  };
};

/**
 * Google로 로그인 (React Native 앱용)
 * iOS와 Android 모두 지원
 */
export const loginWithGoogle = async (): Promise<User> => {
  try {
    logger.debug('Google 로그인 시작');

    // 1. Google Sign-In 초기화
    initializeGoogleSignIn();

  // 2. Play Services 확인 (Android만)
  if (Platform.OS === 'android') {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      logger.debug('Google Play Services 사용 가능');
    } catch (playServicesError: any) {
      logger.error('Google Play Services 오류:', playServicesError);
      
      // ✅ 사용자 친화적인 에러 메시지 및 대안 제시
      const errorMessage = 
        'Google Play Services를 사용할 수 없습니다.\n\n' +
        '다른 로그인 방법을 이용해주세요:\n' +
        '• 카카오 로그인\n' +
        '• 이메일 로그인';
      
      throw new Error(errorMessage);
    }
  }

    // 3. Google 로그인 수행
    // 기존 로그인 상태 초기화 (계정 선택 가능하도록)
    try {
      await GoogleSignin.signOut();
    } catch (signOutError) {
      // 로그아웃 실패는 무시 (처음 로그인인 경우)
      logger.debug('기존 로그인 없음 (정상)');
    }
    
    const googleUser = await GoogleSignin.signIn();

    logger.debug('Google 로그인 성공:', {
      email: googleUser.data?.user.email,
      name: googleUser.data?.user.name,
    });

    // 4. Google ID Token 가져오기
    const { data } = googleUser;
    if (!data) {
      throw new Error('Google 사용자 정보를 가져올 수 없습니다.');
    }

    const tokens = await GoogleSignin.getTokens();
    const { idToken } = tokens;

    if (!idToken) {
      throw new Error('Google ID 토큰을 가져올 수 없습니다.');
    }

    logger.debug('Google ID Token 획득 완료');

    // 5. Firebase 인증 (Google Credential 사용)
    const googleCredential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, googleCredential);
    const firebaseUser = userCredential.user;

    logger.debug('Firebase 로그인 완료:', firebaseUser.uid);

    // 6. Firestore에서 사용자 정보 확인/생성
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    if (userDoc.exists()) {
      // 기존 사용자: 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const userData = userDoc.data() as User;
      userData.uid = firebaseUser.uid;
      logger.debug('기존 사용자 로그인 완료:', userData.profile?.userName);
      return userData;
    } else {
      // 신규 사용자: Firestore에 정보 저장
      logger.debug('신규 사용자 생성 시작');

      const newUser: User = {
        ...convertGoogleUserToFirebaseUser(data, firebaseUser.uid),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      logger.debug('신규 사용자 생성 완료:', newUser.profile?.userName);

      return newUser;
    }
  } catch (error: any) {
    logger.error('Google 로그인 오류:', error);

    // 사용자가 로그인을 취소한 경우
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Google 로그인이 취소되었습니다.');
    }
    // 로그인 진행 중 오류
    else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('이미 로그인이 진행 중입니다.');
    }
    // Play Services 사용 불가 (Android)
    else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services를 사용할 수 없습니다. Google Play를 업데이트해주세요.');
    }
    // 네트워크 오류
    else if (error.message?.includes('network') || error.message?.includes('Network')) {
      throw new Error('네트워크 연결을 확인해주세요.');
    }
    // Firebase 인증 오류
    else if (error.message?.includes('auth/')) {
      throw new Error('Firebase 인증 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
    // 기타 오류
    else {
      throw new Error(error.message || 'Google 로그인 중 오류가 발생했습니다.');
    }
  }
};

/**
 * 현재 Google 로그인 상태 확인
 */
export const isGoogleSignedIn = async (): Promise<boolean> => {
  try {
    return await GoogleSignin.isSignedIn();
  } catch (error) {
    logger.error('Google 로그인 상태 확인 오류:', error);
    return false;
  }
};

/**
 * Google 계정 연결 해제
 */
export const unlinkGoogle = async (): Promise<void> => {
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
    logger.debug('Google 계정 연결 해제 완료');
  } catch (error) {
    logger.error('Google 계정 연결 해제 오류:', error);
    throw error;
  }
};

