import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';
import { logger } from '../utils/logger';

/**
 * 추천인 아이디 검증 함수
 */
export async function validateReferralCode(referralCode: string): Promise<{
  isValid: boolean;
  user?: {
    uid: string;
    userName: string;
    displayName: string;
  };
  message?: string;
}> {
  if (!referralCode || referralCode.trim() === '') {
    return {
      isValid: false,
      message: '추천인 아이디를 입력해주세요.'
    };
  }

  try {
    // users 컬렉션에서 userName으로 검색
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('profile.userName', '==', referralCode.trim()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        isValid: false,
        message: '존재하지 않는 사용자입니다.'
      };
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as User;

    return {
      isValid: true,
      user: {
        uid: userDoc.id,
        userName: userData.profile.userName,
        displayName: userData.profile.userName
      }
    };
  } catch (error) {
    console.error('추천인 검증 오류:', error);
    return {
      isValid: false,
      message: '추천인 검증 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 이메일/비밀번호로 회원가입
 * @param email 이메일
 * @param password 비밀번호
 * @param userName 사용자 이름
 * @param extraProfile 추가 프로필 정보
 * @returns 생성된 사용자 정보
 */
export const registerWithEmail = async (
  email: string,
  password: string,
  userName: string,
  extraProfile?: {
    realName?: string;
    gender?: string;
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    phoneNumber?: string;
    schoolId?: string;
    schoolName?: string;
    province?: string;
    city?: string;
    referral?: string;
    termsAgreed?: boolean;
    privacyAgreed?: boolean;
    locationAgreed?: boolean;
    marketingAgreed?: boolean;
    favorites?: {
      schools: string[];
      boards: string[];
    };
  }
): Promise<User> => {
  logger.debug('registerWithEmail 시작');
  
  try {
    // Firebase 인증으로 계정 생성
    logger.firebase('Authentication 계정 생성 시작');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    logger.firebase('Authentication 계정 생성 완료:', firebaseUser.uid);
    
    // 프로필 업데이트
    logger.debug('프로필 업데이트 시작');
    await updateProfile(firebaseUser, { displayName: userName });
    logger.debug('프로필 업데이트 완료');
    
    // Firestore에 사용자 정보 저장 (통일된 구조 - Timestamp 사용)
    
    // 기본 사용자 데이터 구조 (undefined 필드 제거, Timestamp 사용)
    let newUser: any = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      role: 'student',
      status: 'active', // 기본 상태를 'active'로 설정
      isVerified: false,
      
      // 프로필 정보
      profile: {
        userName: userName,
        realName: extraProfile?.realName || '',
        gender: extraProfile?.gender || '',
        birthYear: extraProfile?.birthYear || 0,
        birthMonth: extraProfile?.birthMonth || 0,
        birthDay: extraProfile?.birthDay || 0,
        phoneNumber: extraProfile?.phoneNumber || '',
        profileImageUrl: firebaseUser.photoURL || '',
        createdAt: serverTimestamp(), // Timestamp를 밀리초로 변환
        isAdmin: false
      },
      
      // 경험치/통계
      stats: {
        level: 1,
        totalExperience: 0,
        postCount: 0,
        commentCount: 0,
        likeCount: 0,
        streak: 0
      },
      
      // 약관 동의
      agreements: {
        terms: extraProfile?.termsAgreed || false,
        privacy: extraProfile?.privacyAgreed || false,
        location: extraProfile?.locationAgreed || false,
        marketing: extraProfile?.marketingAgreed || false
      },
      
      // 시스템 정보 (Timestamp 사용)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // 학교 정보가 있는 경우에만 추가 (추가 필드들도 저장)
    if (extraProfile?.schoolId) {
      newUser.school = {
        id: extraProfile.schoolId,
        name: extraProfile.schoolName || '',
        grade: null, // 나중에 사용할 수 있도록 null로 저장
        classNumber: null, // 나중에 사용할 수 있도록 null로 저장
        studentNumber: null, // 나중에 사용할 수 있도록 null로 저장
        isGraduate: null, // 나중에 사용할 수 있도록 null로 저장
      };
    }
    
    // 즐겨찾기 학교 정보 추가 (favorites 배열 사용)
    const favoriteSchoolIds = extraProfile?.favorites?.schools || [];
    
    // 선택한 메인 학교가 즐겨찾기에 없으면 추가
    if (extraProfile?.schoolId && !favoriteSchoolIds.includes(extraProfile.schoolId)) {
      favoriteSchoolIds.unshift(extraProfile.schoolId); // 메인 학교를 첫 번째로
    }
    
    if (favoriteSchoolIds.length > 0) {
      newUser.favorites = {
        schools: favoriteSchoolIds.slice(0, 5), // 최대 5개로 제한
        boards: extraProfile?.favorites?.boards || []
      };
    }
    
    // 지역 정보가 있는 경우에만 추가
    if (extraProfile?.province && extraProfile?.city) {
      newUser.regions = {
        sido: extraProfile.province,
        sigungu: extraProfile.city,
        address: ''
      };
    }
    
    // 추천인 정보가 있는 경우에만 추가
    if (extraProfile?.referral && extraProfile.referral.trim() !== '') {
      newUser.referrerId = extraProfile.referral;
    }
    
    logger.firebase('Firestore에 사용자 데이터 저장 시작');
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    logger.firebase('Firestore 사용자 데이터 저장 완료');
    
    // 저장된 사용자 데이터를 다시 읽어와서 정확한 데이터로 반환
    const savedUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (savedUserDoc.exists()) {
      const savedUserData = savedUserDoc.data() as User;
      savedUserData.uid = firebaseUser.uid;
      newUser = savedUserData;
      logger.debug('저장된 사용자 데이터 확인 완료');
    }
    
    // 선택한 학교가 있는 경우, 학교의 멤버 카운트와 즐겨찾기 카운트 증가
    if (extraProfile?.schoolId) {
      try {
        const schoolRef = doc(db, 'schools', extraProfile.schoolId);
        const schoolDoc = await getDoc(schoolRef);
        
        if (schoolDoc.exists()) {
          const schoolData = schoolDoc.data();
          const currentMemberCount = schoolData.memberCount || 0;
          const currentFavoriteCount = schoolData.favoriteCount || 0;
          
          await updateDoc(schoolRef, {
            memberCount: currentMemberCount + 1,
            favoriteCount: currentFavoriteCount + 1 // 즐겨찾기 카운트도 증가
          });
          
          logger.debug('학교 통계 업데이트 완료 (멤버+즐겨찾기)');
        }
      } catch (schoolError) {
        logger.error('학교 통계 업데이트 오류:', schoolError);
        // 학교 업데이트 실패해도 회원가입은 성공으로 처리
      }
    }
    
    // 추천 아이디가 있는 경우 추천 보상 처리
    if (extraProfile?.referral && extraProfile.referral.trim() !== '') {
      try {
        // 추천인 찾기
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('profile.userName', '==', extraProfile.referral));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const referrerDoc = querySnapshot.docs[0];
          const referrerId = referrerDoc.id;
          
          // 시스템 설정에서 추천인 경험치 값 가져오기
          const { getExperienceSettings } = await import('./experience');
          const expSettings = await getExperienceSettings();
          
          const referrerExp = expSettings.referral?.referrerXP || 30; // 추천인이 받는 경험치
          const refereeExp = expSettings.referral?.refereeXP || 20;   // 추천받은 사람이 받는 경험치
          
          // 추천인 경험치 업데이트 (레벨업 계산 포함)
          const { updateUserExperience } = await import('./experience');
          await updateUserExperience(referrerId, referrerExp);
          
          // 신규 사용자 경험치 업데이트 (레벨업 계산 포함)
          await updateUserExperience(firebaseUser.uid, refereeExp);

          // 알림 발송
          try {
            const { createReferralNotification, createReferralSuccessNotification } = await import('./notifications');
            
            // 1. 추천인에게 알림 발송
            await createReferralNotification(
              referrerId,
              userName,
              firebaseUser.uid,
              referrerExp // 추천인이 받은 경험치 정보 포함
            );

            // 2. 추천받은 사용자(신규 가입자)에게 성공 알림 발송
            const referrerData = referrerDoc.data();
            const referrerName = referrerData?.profile?.userName || '추천인';
            await createReferralSuccessNotification(
              firebaseUser.uid,
              referrerName,
              referrerId,
              refereeExp // 추천받은 사용자가 받은 경험치 정보 포함
            );
          } catch (notificationError) {
            logger.error('추천인 알림 발송 실패:', notificationError);
            // 알림 발송 실패는 회원가입 자체를 실패시키지 않음
          }
          
          logger.debug('추천 보상 처리 완료:', extraProfile.referral);
        }
      } catch (referralError) {
        logger.error('추천 보상 처리 오류:', referralError);
        // 추천 보상 실패해도 회원가입은 성공으로 처리
      }
    }
    
    logger.debug('registerWithEmail 전체 과정 완료');
    return newUser;
  } catch (error) {
    logger.error('registerWithEmail 오류 발생:', error);
    throw new Error('회원가입 중 오류가 발생했습니다.');
  }
};

/**
 * 이메일/비밀번호로 로그인
 * @param email 이메일
 * @param password 비밀번호
 * @returns 사용자 정보
 */
export const loginWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    // Firebase 인증으로 로그인
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Firestore에서 사용자 정보 가져오기
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      // 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const userData = userDoc.data() as User;
      // uid 필드를 명시적으로 설정
      userData.uid = firebaseUser.uid;
      
      return userData;
    } else {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
  } catch (error) {
    logger.error('로그인 오류:', error);
    throw new Error('로그인 중 오류가 발생했습니다.');
  }
};

/**
 * 비밀번호 재설정 이메일 발송
 * @param email 이메일
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    throw new Error('비밀번호 재설정 중 오류가 발생했습니다.');
  }
};

/**
 * 로그아웃
 */
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw new Error('로그아웃 중 오류가 발생했습니다.');
  }
};

/**
 * 현재 로그인된 사용자 정보 가져오기
 * @returns 사용자 정보 또는 null
 */
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      unsubscribe(); // 리스너 해제
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            // uid 필드를 명시적으로 설정
            userData.uid = firebaseUser.uid;
            resolve(userData);
          } else {
            resolve(null);
          }
        } catch (error) {
          logger.error('사용자 정보 가져오기 오류:', error);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}; 