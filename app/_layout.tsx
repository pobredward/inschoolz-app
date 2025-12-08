import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useEffect, useRef, useCallback } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { initializeKakaoSDK } from '@react-native-kakao/core';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
} from '../lib/push-notifications';
import {
  handleForegroundNotification,
  handleNotificationResponse,
  updateNotificationBadge,
} from '../lib/notification-handlers';
import { QuestProvider } from '../providers/QuestProvider';

// 스플래시 스크린이 자동으로 숨겨지지 않도록 설정
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    // 잼민이체 스타일 (귀여운 손글씨) - 기존 SpaceMono를 재활용하되 스타일 적용
    JamminStyle: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // ✅ Zustand selector를 명시적으로 사용하여 리렌더링 보장
  const currentUser = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading); // ✅ 명시적으로 추가
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // ✅ CRITICAL: segments 변경 추적 (디버깅용)
  useEffect(() => {
    console.log('🔄 segments 변경:', segments, '→ segments[0]:', segments[0]);
  }, [segments]);

  useEffect(() => {
    // 카카오 SDK 초기화 (안전한 초기화)
    const initializeKakao = async () => {
      try {
        // 카카오 SDK가 사용 가능한지 먼저 확인
        if (typeof initializeKakaoSDK !== 'function') {
          console.warn('⚠️ 카카오 SDK를 사용할 수 없습니다. (Development Build 필요)');
          return;
        }

        const kakaoAppKey = Constants.expoConfig?.extra?.kakaoAppKey || '380177b185226c4935a7f293190afc46';
        if (kakaoAppKey) {
          // @react-native-kakao/core로 명시적 초기화
          await initializeKakaoSDK(kakaoAppKey);
          console.log('✅ 카카오 SDK 초기화 완료 (앱 키:', kakaoAppKey?.substring(0, 8) + '...)');
        } else {
          console.warn('⚠️ 카카오 앱 키가 설정되지 않았습니다.');
        }
      } catch (error) {
        console.error('❌ 카카오 SDK 초기화 실패:', error);
        // 카카오 SDK 초기화 실패해도 앱이 크래시되지 않도록 처리
        console.warn('⚠️ 카카오 로그인 기능을 사용할 수 없습니다.');
      }
    };

    // 푸시 알림 및 뱃지 초기화
    const setupNotifications = async () => {
      try {
        // 앱이 백그라운드에서 알림으로 열렸는지 확인
        const lastResponse = await getLastNotificationResponse();
        if (lastResponse) {
          console.log('앱이 알림으로 열림:', lastResponse.notification.request.content);
          handleNotificationResponse(lastResponse);
        }

        // 읽지 않은 알림 개수로 뱃지 업데이트
        await updateNotificationBadge();
      } catch (error) {
        console.error('❌ 알림 설정 실패:', error);
      }
    };

    // 앱 시작 시 카카오 SDK 및 인증 상태 초기화
    initializeKakao();
    
    // Firebase 초기화에 타임아웃 설정하여 스플래시 화면 블로킹 방지
    const initAuth = useAuthStore.getState().initializeAuth();
    
    // 5초 후에도 로딩이 끝나지 않으면 강제로 진행
    setTimeout(() => {
      const { isLoading } = useAuthStore.getState();
      if (isLoading) {
        console.warn('⚠️ Auth 초기화 타임아웃 - 강제 진행');
        useAuthStore.getState().setLoading(false);
      }
    }, 5000);
    
    setupNotifications();
  }, []); // 의존성 제거 - 이 함수들은 앱 시작 시 한 번만 실행되어야 함

  // 사용자 로그인 후 푸시 알림 초기화 (무한 루프 방지)
  useEffect(() => {
    if (currentUser?.uid) {
      useAuthStore.getState().initializePushNotifications().catch(error => {
        console.error('푸시 알림 초기화 실패:', error);
      });
    }
  }, [currentUser?.uid]); // uid만 의존성으로 설정하여 무한 루프 방지

  // 알림 수신 핸들러 설정
  useEffect(() => {
    // 앱이 포그라운드에 있을 때 알림 수신
    notificationListener.current = addNotificationReceivedListener(handleForegroundNotification);

    // 사용자가 알림을 탭했을 때
    responseListener.current = addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // 카카오 로그인 진행 상태 구독
  const isKakaoLoginInProgress = useAuthStore((state) => state.isKakaoLoginInProgress);

  // ✅ Auth Guard: 인증 상태에 따른 네비게이션 제어
  useEffect(() => {
    if (authLoading || !loaded) {
      // 로딩 중이거나 폰트 로드 중이면 아무것도 하지 않음
      return;
    }

    const inAuthGroup = segments[0] === '(tabs)';
    const inLoginScreen = segments[0] === 'login' || segments[0] === 'signup';
    const currentSegment = segments[0];

    // ✅ CRITICAL: 카카오 로그인 진행 중에는 Auth Guard 완전 비활성화
    if (isKakaoLoginInProgress) {
      console.log('🔒 카카오 로그인 진행 중 - Auth Guard 비활성화');
      return;
    }

    // ✅ 핵심: Zustand store에서 직접 최신 상태 가져오기
    const latestState = useAuthStore.getState();
    const latestIsAuthenticated = latestState.isAuthenticated;
    const latestUser = latestState.user;
    const latestIsLoading = latestState.isLoading;

    console.log('🔒 Auth Guard:', {
      isAuthenticatedFromHook: isAuthenticated,
      isAuthenticatedFromStore: latestIsAuthenticated,
      authLoading,
      latestIsLoading,
      currentSegment,
      inAuthGroup,
      inLoginScreen,
      hasUser: !!latestUser
    });

    // ✅ CRITICAL: 로그인 처리 중이면 Auth Guard 스킵 (카카오톡 앱 전환 대응)
    if (latestIsLoading) {
      console.log('⏳ 로그인 처리 중 - Auth Guard 스킵');
      return;
    }

    // ✅ 짧은 딜레이만 (100ms) - React 리렌더링 사이클 1회 보장
    const navigationTimeout = setTimeout(() => {
      // ✅ 최신 상태를 다시 확인
      const finalState = useAuthStore.getState();
      
      // ✅ CRITICAL: 다시 한번 로딩 중 체크 (카카오톡 앱에서 돌아올 때)
      if (finalState.isLoading) {
        console.log('⏳ 로그인 처리 중 - Auth Guard 스킵 (재확인)');
        return;
      }
      
      // ✅ 인증된 사용자가 로그인 화면에 있으면 홈으로 이동
      if (finalState.isAuthenticated && finalState.user && inLoginScreen) {
        console.log('✅ 인증됨 → /(tabs)로 리다이렉트');
        router.replace('/(tabs)');
        return;
      }
      
      // 인증되지 않았고, (tabs) 그룹에 있으면 로그인 화면으로
      if (!finalState.isAuthenticated && !finalState.user && inAuthGroup) {
        console.log('⚠️ 인증 안됨 → /login으로 리다이렉트');
        router.replace('/login');
        return;
      }
    }, 100); // 500ms → 100ms로 단축

    return () => clearTimeout(navigationTimeout);
  }, [isAuthenticated, authLoading, loaded, segments[0], currentUser, isLoading, isKakaoLoginInProgress]); // ✅ isKakaoLoginInProgress 추가

  const onLayoutRootView = useCallback(async () => {
    if (loaded) {
      // 폰트 로딩이 완료되면 스플래시 스크린을 숨김
      await SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    // 폰트 로딩 중에는 null을 반환하여 스플래시 스크린이 계속 표시되도록 함
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <ThemeProvider value={DefaultTheme}>
        <QuestProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="dark" />
        </QuestProvider>
      </ThemeProvider>
    </View>
  );
}
