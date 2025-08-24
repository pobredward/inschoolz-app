import { User } from '../types';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { signInWithCustomToken, updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';
import { logger } from '../utils/logger';
import { login, logout, unlink } from '@react-native-kakao/user';
import getProfile from '@react-native-kakao/user';

// 카카오 사용자 정보 인터페이스
export interface KakaoUserInfo {
  id: number;
  kakao_account: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
    phone_number?: string;
    birthday?: string;
    birthyear?: string;
    gender?: 'female' | 'male';
  };
}

// 카카오 로그인 응답 인터페이스 (최신 API 사용)
export interface KakaoAuthResponse {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  scopes?: string[];
}

/**
 * 카카오 액세스 토큰으로 사용자 정보 가져오기
 */
export const getKakaoUserInfo = async (accessToken: string): Promise<KakaoUserInfo> => {
  try {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('카카오 사용자 정보 조회 실패:', response.status, errorText);
      throw new Error(`카카오 사용자 정보 조회 실패: ${response.status}`);
    }

    const userData: KakaoUserInfo = await response.json();
    logger.debug('카카오 사용자 정보 조회 성공:', userData);
    return userData;
  } catch (error) {
    logger.error('카카오 사용자 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 카카오 액세스 토큰으로 서버에서 Firebase 커스텀 토큰 받기
 */
export const getFirebaseTokenFromKakao = async (accessToken: string): Promise<string> => {
  try {
    // 웹 서버의 API 엔드포인트 호출
    const response = await fetch('https://inschoolz.com/api/auth/kakao/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Firebase 토큰 생성 실패');
    }

    const data = await response.json();
    return data.customToken;
  } catch (error) {
    logger.error('Firebase 토큰 생성 실패:', error);
    throw error;
  }
};

/**
 * 카카오 사용자 정보를 Firebase User 형식으로 변환
 */
export const convertKakaoUserToFirebaseUser = (kakaoUser: KakaoUserInfo, uid: string): User => {
  const profile = kakaoUser.kakao_account.profile;
  const birthday = kakaoUser.kakao_account.birthday;
  const birthyear = kakaoUser.kakao_account.birthyear;

  return {
    uid,
    email: kakaoUser.kakao_account.email || '',
    role: 'student',
    status: 'active',
    isVerified: true,
    profile: {
      userName: profile?.nickname || `카카오사용자${kakaoUser.id}`,
      realName: '',
      gender: kakaoUser.kakao_account.gender === 'female' ? '여성' : 
              kakaoUser.kakao_account.gender === 'male' ? '남성' : '',
      birthYear: birthyear ? parseInt(birthyear) : 0,
      birthMonth: birthday ? parseInt(birthday.substring(0, 2)) : 0,
      birthDay: birthday ? parseInt(birthday.substring(2, 4)) : 0,
      phoneNumber: kakaoUser.kakao_account.phone_number || '',
      profileImageUrl: profile?.profile_image_url || '',
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
      terms: true,
      privacy: true,
      location: false,
      marketing: false
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
};

/**
 * 카카오 로그인 (앱용) - React Native Kakao
 */
export const loginWithKakao = async (): Promise<User> => {
  try {
    logger.debug('카카오 로그인 시작');

    // 1. 카카오 로그인 수행 (@react-native-kakao/user)
    const loginResult = await login();
    logger.debug('카카오 로그인 성공:', {
      hasAccessToken: !!loginResult.accessToken,
      accessTokenLength: loginResult.accessToken?.length || 0
    });

    // 2. 카카오 사용자 정보 가져오기 (getProfile 사용)
    const kakaoProfile = await getProfile();
    logger.debug('카카오 사용자 정보 조회 완료:', kakaoProfile.nickname);
    
    // 기존 인터페이스와 호환성을 위한 변환
    const kakaoUser: KakaoUserInfo = {
      id: kakaoProfile.id,
      kakao_account: {
        email: kakaoProfile.email,
        profile: {
          nickname: kakaoProfile.nickname,
          profile_image_url: kakaoProfile.profileImageUrl,
          thumbnail_image_url: kakaoProfile.thumbnailImageUrl,
        },
        phone_number: kakaoProfile.phoneNumber,
        birthday: kakaoProfile.birthday,
        birthyear: kakaoProfile.birthyear,
        gender: kakaoProfile.gender as 'female' | 'male',
      },
    };

    // 3. 서버에서 Firebase 커스텀 토큰 받기
    const customToken = await getFirebaseTokenFromKakao(loginResult.accessToken);
    logger.debug('Firebase 커스텀 토큰 생성 완료');

    // 4. Firebase 로그인
    const userCredential = await signInWithCustomToken(auth, customToken);
    const firebaseUser = userCredential.user;
    logger.debug('Firebase 로그인 완료:', firebaseUser.uid);

    // 5. Firebase Auth 프로필 업데이트
    try {
      await updateProfile(firebaseUser, {
        displayName: kakaoUser.kakao_account.profile?.nickname || `카카오사용자${kakaoUser.id}`,
        photoURL: kakaoUser.kakao_account.profile?.profile_image_url || null,
      });
      logger.debug('Firebase Auth 프로필 업데이트 성공');
    } catch (profileError) {
      logger.warn('Firebase Auth 프로필 업데이트 실패 (무시하고 계속):', profileError);
    }

    // 6. Firestore에서 사용자 정보 확인/생성
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    if (userDoc.exists()) {
      // 기존 사용자: 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const userData = userDoc.data() as User;
      userData.uid = firebaseUser.uid;
      logger.debug('기존 사용자 로그인 완료:', userData.profile?.userName);
      return userData;
    } else {
      // 신규 사용자: Firestore에 정보 저장
      const newUser = convertKakaoUserToFirebaseUser(kakaoUser, firebaseUser.uid);
      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      logger.debug('신규 사용자 생성 완료:', newUser.profile?.userName);
      return newUser;
    }
  } catch (error) {
    logger.error('카카오 로그인 실패:', error);
    throw error;
  }
};

/**
 * 카카오 로그아웃 - @react-native-kakao/user
 */
export const logoutFromKakao = async (): Promise<void> => {
  try {
    await logout();
    logger.debug('카카오 로그아웃 완료');
  } catch (error) {
    logger.error('카카오 로그아웃 오류:', error);
    // 로그아웃 실패해도 앱 로그아웃은 진행
  }
};

/**
 * 카카오 연동 해제 - @react-native-kakao/user
 */
export const unlinkKakao = async (): Promise<void> => {
  try {
    await unlink();
    logger.debug('카카오 연동 해제 완료');
  } catch (error) {
    logger.error('카카오 연동 해제 실패:', error);
    throw error;
  }
};

/**
 * 최적화된 카카오 로그인 - @react-native-kakao/user
 */
export const loginWithKakaoOptimized = async (): Promise<User> => {
  try {
    logger.debug('카카오 로그인 시작');

    // 1. 카카오 로그인 수행 (@react-native-kakao/user - 자동으로 최적 방식 선택)
    const loginResult = await login();
    logger.debug('카카오 로그인 성공:', {
      hasAccessToken: !!loginResult.accessToken,
      accessTokenLength: loginResult.accessToken?.length || 0
    });

    // 2. 카카오 사용자 정보 가져오기 (getProfile 사용)
    const kakaoProfile = await getProfile();
    logger.debug('카카오 사용자 정보 조회 완료:', kakaoProfile.nickname);
    
    // 기존 인터페이스와 호환성을 위한 변환
    const kakaoUser: KakaoUserInfo = {
      id: kakaoProfile.id,
      kakao_account: {
        email: kakaoProfile.email,
        profile: {
          nickname: kakaoProfile.nickname,
          profile_image_url: kakaoProfile.profileImageUrl,
          thumbnail_image_url: kakaoProfile.thumbnailImageUrl,
        },
        phone_number: kakaoProfile.phoneNumber,
        birthday: kakaoProfile.birthday,
        birthyear: kakaoProfile.birthyear,
        gender: kakaoProfile.gender as 'female' | 'male',
      },
    };

    // 3. 서버에서 Firebase 커스텀 토큰 받기
    const customToken = await getFirebaseTokenFromKakao(loginResult.accessToken);
    logger.debug('Firebase 커스텀 토큰 생성 완료');

    // 4. Firebase 로그인
    const userCredential = await signInWithCustomToken(auth, customToken);
    const firebaseUser = userCredential.user;
    logger.debug('Firebase 로그인 완료:', firebaseUser.uid);

    // 5. Firebase Auth 프로필 업데이트
    try {
      await updateProfile(firebaseUser, {
        displayName: kakaoUser.kakao_account.profile?.nickname || `카카오사용자${kakaoUser.id}`,
        photoURL: kakaoUser.kakao_account.profile?.profile_image_url || null,
      });
      logger.debug('Firebase Auth 프로필 업데이트 성공');
    } catch (profileError) {
      logger.warn('Firebase Auth 프로필 업데이트 실패 (무시하고 계속):', profileError);
    }

    // 6. Firestore에서 사용자 정보 확인/생성
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    if (userDoc.exists()) {
      // 기존 사용자: 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const userData = userDoc.data() as User;
      userData.uid = firebaseUser.uid;
      logger.debug('기존 사용자 로그인 완료:', userData.profile?.userName);
      return userData;
    } else {
      // 신규 사용자: Firestore에 정보 저장
      const newUser = convertKakaoUserToFirebaseUser(kakaoUser, firebaseUser.uid);
      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      logger.debug('신규 사용자 생성 완료:', newUser.profile?.userName);
      return newUser;
    }
  } catch (error) {
    logger.error('카카오 로그인 실패:', error);
    throw error;
  }
};
