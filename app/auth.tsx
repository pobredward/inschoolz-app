import React from 'react';
import { router } from 'expo-router';

export default function AuthScreen() {
  // /auth 경로로 접근 시 /login으로 리다이렉트
  React.useEffect(() => {
    router.replace('/login');
  }, []);

  return null; // 컴포넌트는 렌더링하지 않고 바로 리다이렉트
}
