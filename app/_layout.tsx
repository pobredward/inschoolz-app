import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { initializeKakaoSDK } from '@react-native-kakao/core';
import Constants from 'expo-constants';

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    // 잼민이체 스타일 (귀여운 손글씨) - 기존 SpaceMono를 재활용하되 스타일 적용
    JamminStyle: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    // 카카오 SDK 초기화
    const initializeKakao = async () => {
      try {
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
      }
    };

    // 앱 시작 시 카카오 SDK 및 인증 상태 초기화
    initializeKakao();
    initializeAuth();
  }, [initializeAuth]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
