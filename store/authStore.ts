import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, Auth, signOut } from 'firebase/auth';
import { logoutFromKakao } from '../lib/kakao';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
// @ts-ignore - Firebase auth 타입 이슈
import { auth, db } from '../lib/firebase';
import { User } from '../types';
import { calculateCurrentLevelProgress, resetDailyActivityLimits } from '../lib/experience';
import { logger } from '../utils/logger';

// AuthStore 타입 정의
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  realtimeListener: (() => void) | null;
  unreadNotificationCount: number; // 읽지 않은 알림 개수 추가
}

// 인증 액션 타입 정의
interface AuthActions {
  initializeAuth: () => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => Promise<void>;
  updateUserProfile: (profileData: Partial<User['profile']>) => void;
  updateUserStats: (statsData: Partial<User['stats']>) => void;
  updateUserSchool: (schoolData: User['school']) => void;
  updateUserRegions: (regionsData: Partial<User['regions']>) => void;
  // 즐겨찾기 학교 기능은 향후 구현 예정
  incrementExperience: (amount: number) => void;
  updateGameStats: (gameType: string, stats: { totalScore: number }) => void;
  setupRealtimeUserListener: (userId: string) => () => void;
  updateUnreadNotificationCount: (count: number) => void; // 알림 개수 업데이트 함수 추가
  decrementUnreadNotificationCount: (amount?: number) => void; // 알림 개수 감소 함수 추가
}

// 초기 상태
const initialState: AuthState = {
  user: null,
  isLoading: true, // 시작 시 로딩 상태
  isAuthenticated: false,
  error: null,
  realtimeListener: null,
  unreadNotificationCount: 0, // 초기값 0
};

// AuthStore 생성
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 인증 초기화 (앱 시작 시 호출) - Firebase Auth 상태 감지 추가
      initializeAuth: () => {
        logger.auth('Auth 상태 감지 시작');
        set({ isLoading: true });
        
        // Firebase Auth 상태 변화 감지
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          logger.auth('Auth 상태 변화:', firebaseUser?.uid || 'null');
          
          if (firebaseUser) {
            try {
              // Firestore에서 사용자 정보 가져오기
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              
              if (userDoc.exists()) {
                // 일일 활동 제한 자동 리셋 실행
                await resetDailyActivityLimits(firebaseUser.uid);
                
                const userData = userDoc.data() as User;
                userData.uid = firebaseUser.uid;
                
                logger.auth('사용자 데이터 로드 완료:', userData.profile?.userName);
                
                set({
                  user: userData,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                });

                // 실시간 사용자 데이터 리스너 설정
                const { setupRealtimeUserListener } = get();
                setupRealtimeUserListener(firebaseUser.uid);
              } else {
                logger.warn('Firestore에서 사용자 문서를 찾을 수 없음');
                set({
                  user: null,
                  isAuthenticated: false,
                  isLoading: false,
                  error: '사용자 정보를 찾을 수 없습니다.',
                  realtimeListener: null,
                });
              }
            } catch (error) {
              logger.error('사용자 정보 로드 오류:', error);
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: '사용자 정보를 불러오는 중 오류가 발생했습니다.',
                realtimeListener: null,
              });
            }
          } else {
            logger.auth('로그인된 사용자가 없음');
            // 기존 실시간 리스너 정리
            const { realtimeListener } = get();
            if (realtimeListener) {
              realtimeListener();
            }
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              realtimeListener: null,
            });
          }
        });

        // 클린업 함수 반환 (필요 시 unsubscribe)
        return unsubscribe;
      },

      // 사용자 설정
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        });
      },

      // 로딩 상태 설정
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      // 에러 설정
      setError: (error) => {
        set({ error });
      },

      // 인증 정보 초기화 (Firebase signOut 포함)
      clearAuth: async () => {
        try {
          logger.auth('로그아웃 시작');
          
          // 실시간 리스너 정리
          const { realtimeListener } = get();
          if (realtimeListener) {
            realtimeListener();
          }
          
          // 카카오 로그아웃 (에러가 발생해도 진행)
          try {
            await logoutFromKakao();
          } catch (kakaoError) {
            logger.warn('카카오 로그아웃 실패 (무시하고 계속):', kakaoError);
          }
          
          await signOut(auth);
          logger.auth('로그아웃 완료');
          
          // 상태 초기화는 onAuthStateChanged에서 자동으로 처리됨
          // 하지만 즉시 상태 업데이트를 위해 여기서도 초기화
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            realtimeListener: null,
          });
        } catch (error) {
          logger.error('로그아웃 오류:', error);
          // 에러가 발생해도 로컬 상태는 초기화
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: '로그아웃 중 오류가 발생했습니다.',
            realtimeListener: null,
          });
          throw error;
        }
      },

      // 프로필 업데이트
      updateUserProfile: (profileData) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              profile: {
                ...user.profile,
                ...profileData,
              },
            },
          });
        }
      },

      // 통계 업데이트
      updateUserStats: (statsData) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              stats: {
                ...user.stats,
                ...statsData,
              },
            },
          });
        }
      },

      // 학교 정보 업데이트
      updateUserSchool: (schoolData) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              school: schoolData, // 기존 데이터와 병합하지 않고 완전히 교체
            },
          });
        }
      },

      // 지역 정보 업데이트
      updateUserRegions: (regionsData) => {
        const { user } = get();
        if (user && user.regions) {
          set({
            user: {
              ...user,
              regions: {
                ...user.regions,
                ...regionsData,
              },
            },
          });
        }
      },

      // 즐겨찾기 학교 기능은 향후 구현 예정

      // 경험치 증가 (완전히 새로운 로직)
      incrementExperience: (amount) => {
        const { user } = get();
        if (user) {
          const totalExperience = user.stats.totalExperience + amount;
          
          // 새로운 총 경험치 기준으로 레벨과 현재 경험치 계산
          const progress = calculateCurrentLevelProgress(totalExperience);
          
          set({
            user: {
              ...user,
              stats: {
                ...user.stats,
                totalExperience: totalExperience,
                level: progress.level,
                currentExp: progress.currentExp,
                currentLevelRequiredXp: progress.currentLevelRequiredXp,
              },
            },
          });
        }
      },

      // 게임 통계 업데이트
      updateGameStats: (gameType, stats) => {
        const { user } = get();
        if (user && user.gameStats) {
          set({
            user: {
              ...user,
              gameStats: {
                ...user.gameStats,
                [gameType]: stats,
              },
            },
          });
        }
      },

      // 실시간 사용자 데이터 리스너 설정 (중복 방지)
      setupRealtimeUserListener: (userId: string) => {
        // 기존 리스너가 있으면 제거
        const { realtimeListener } = get();
        if (realtimeListener) {
          realtimeListener();
        }
        
        logger.debug('실시간 사용자 데이터 리스너 설정:', userId);
        
        const userRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data() as User;
            userData.uid = userId;
            
            // 기존 사용자 정보와 병합하여 업데이트
            const { user: currentUser } = get();
            if (currentUser) {
              set({
                user: {
                  ...currentUser,
                  ...userData,
                  uid: userId, // uid 유지
                },
              });
            }
          }
        });
        
        // 리스너 저장
        set({ realtimeListener: unsubscribe });
        
        return unsubscribe;
      },

      // 읽지 않은 알림 개수 업데이트
      updateUnreadNotificationCount: (count: number) => {
        set({ unreadNotificationCount: Math.max(0, count) });
      },

      // 읽지 않은 알림 개수 감소
      decrementUnreadNotificationCount: (amount = 1) => {
        const { unreadNotificationCount } = get();
        set({ unreadNotificationCount: Math.max(0, unreadNotificationCount - amount) });
      },
    }),
    {
      name: 'auth-store', // AsyncStorage 키
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// 편의 함수들
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error); 