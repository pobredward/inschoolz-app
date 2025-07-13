import Constants from 'expo-constants';

const isDevelopment = __DEV__;

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`❌ [ERROR] ${message}`, ...args);
  },
  
  // Firebase 인증 관련 로그
  auth: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`🔐 [AUTH] ${message}`, ...args);
    }
  },
  
  // Firebase 관련 로그
  firebase: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`🔥 [FIREBASE] ${message}`, ...args);
    }
  },
  
  // API 호출 관련 로그
  api: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`🌐 [API] ${message}`, ...args);
    }
  },
  
  // 사용자 액션 관련 로그
  user: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`👤 [USER] ${message}`, ...args);
    }
  }
};

// 성능 측정을 위한 타이머 유틸리티
export const performanceLogger = {
  start: (label: string) => {
    if (isDevelopment) {
      console.time(`⏱️ [PERF] ${label}`);
    }
  },
  
  end: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(`⏱️ [PERF] ${label}`);
    }
  }
}; 