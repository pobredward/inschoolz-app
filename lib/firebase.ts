import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

// React Native용 persistence - Firebase v11에서 지원하는 방식
let getReactNativePersistence: any;
try {
  const authModule = require('firebase/auth');
  getReactNativePersistence = authModule.getReactNativePersistence;
} catch (error) {
  logger.warn('Firebase React Native persistence를 가져올 수 없습니다:', error);
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Firebase 앱 초기화
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// React Native용 Auth 초기화 (AsyncStorage 사용)
let auth: any;
try {
  if (getReactNativePersistence) {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    logger.debug('Firebase Auth 초기화 완료 (with persistence)');
  } else {
    auth = initializeAuth(app);
    logger.debug('Firebase Auth 초기화 완료 (without persistence)');
  }
} catch (error) {
  // 이미 초기화된 경우
  auth = getAuth(app);
  logger.debug('Firebase Auth 기존 인스턴스 사용');
}

const db = getFirestore(app);
const storage = getStorage(app);

// 이미지 업로드 함수
export const uploadImage = async (imageUri: string): Promise<string> => {
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`;
    const storageRef = ref(storage, `images/${fileName}`);
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    logger.error('이미지 업로드 실패:', error);
    throw error;
  }
};

export { auth, db, storage }; 