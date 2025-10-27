# Expo Go 환경에서 Google 로그인 비활성화 가이드

## 📋 개요

Expo Go 환경에서는 네이티브 모듈인 `@react-native-google-signin/google-signin`이 제대로 작동하지 않기 때문에, Expo Go에서만 Google 로그인 버튼을 숨기도록 구현했습니다.

## ✅ 수정 내역

### 1. 로그인 화면 (`app/login.tsx`)

#### 변경 사항
- `expo-constants` import 추가
- **`../lib/google` 정적 import 제거** (중요!)
- `Constants.executionEnvironment`를 사용하여 Expo Go 환경 감지
- Google 로그인 버튼에 조건부 렌더링 적용
- **동적 import**를 사용하여 네이티브 모듈 지연 로딩

#### 코드 수정

```typescript
// 정적 import 제거 (Expo Go에서 에러 발생 원인)
// import { loginWithGoogle } from '../lib/google'; // ❌ 제거됨

// Import 추가
import Constants from 'expo-constants';

// 컴포넌트 내부에 환경 감지 로직 추가
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Google 로그인 함수에 동적 import 적용
const handleGoogleLogin = async () => {
  try {
    setLoading(true);
    
    // Expo Go 환경에서는 실행되지 않도록 추가 체크
    if (isExpoGo) {
      Alert.alert('알림', 'Google 로그인은 Expo Go에서 지원되지 않습니다.');
      return;
    }
    
    // 동적 import로 네이티브 모듈 로드 (필요할 때만 로드)
    const { loginWithGoogle } = await import('../lib/google');
    const user = await loginWithGoogle();
    setUser(user);
    
    Alert.alert('성공', 'Google 로그인이 완료되었습니다!', [
      { text: '확인', onPress: () => router.replace('/(tabs)') }
    ]);
  } catch (error: any) {
    console.error('Google 로그인 오류:', error);
    
    if (!error.message?.includes('취소')) {
      Alert.alert('Google 로그인 실패', error.message || 'Google 로그인 중 오류가 발생했습니다.');
    }
  } finally {
    setLoading(false);
  }
};

// Google 로그인 버튼을 조건부로 렌더링
{!isExpoGo && (
  <TouchableOpacity 
    style={[styles.googleButton, isLoading && styles.submitButtonDisabled]}
    onPress={handleGoogleLogin}
    disabled={isLoading}
  >
    <Ionicons name="logo-google" size={20} color="#fff" style={styles.googleIcon} />
    <Text style={styles.googleButtonText}>
      Google로 로그인
    </Text>
  </TouchableOpacity>
)}
```

## 🔍 환경 감지 방식

### `Constants.executionEnvironment`의 값

- **`'storeClient'`**: Expo Go 앱에서 실행 중 (개발 환경)
- **`'standalone'`**: 독립 실행형 앱 (프로덕션 빌드)
- **`'bare'`**: Bare workflow 환경

### 동작 방식

1. **Expo Go에서 실행 시**:
   - `isExpoGo = true`
   - Google 로그인 버튼이 **숨겨짐**
   - 카카오 로그인, Apple 로그인, 이메일 로그인만 표시됨

2. **프로덕션 빌드 (standalone)에서 실행 시**:
   - `isExpoGo = false`
   - Google 로그인 버튼이 **정상 표시됨**
   - 모든 로그인 옵션 사용 가능

## 📱 테스트 가이드

### Expo Go에서 테스트
```bash
cd inschoolz-app
npx expo start
```
- QR 코드를 스캔하여 Expo Go 앱에서 열기
- 로그인 화면에서 Google 로그인 버튼이 **보이지 않는지** 확인
- 카카오, Apple, 이메일 로그인은 정상 작동하는지 확인

### 개발 빌드에서 테스트
```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```
- 개발 빌드를 설치 후 실행
- 로그인 화면에서 Google 로그인 버튼이 **보이는지** 확인
- Google 로그인이 정상 작동하는지 확인

### 프로덕션 빌드에서 테스트
```bash
# iOS
eas build --profile production --platform ios

# Android
eas build --profile production --platform android
```
- 프로덕션 빌드에서 모든 로그인 옵션 정상 작동 확인

## 🎯 이점

1. **개발 편의성**: Expo Go에서 빠른 개발 및 테스트 가능
2. **오류 방지**: Expo Go에서 사용 불가능한 네이티브 모듈로 인한 크래시 방지
3. **사용자 경험**: 작동하지 않는 버튼을 숨김으로써 혼란 방지
4. **유연성**: 프로덕션 빌드에서는 모든 기능 정상 작동

## 🔧 기술적 세부사항

### 왜 Expo Go에서 Google 로그인이 작동하지 않는가?

Expo Go는 미리 빌드된 네이티브 런타임으로, 커스텀 네이티브 모듈을 포함할 수 없습니다. `@react-native-google-signin/google-signin`은 네이티브 코드가 필요하므로 Expo Go에서는 작동하지 않습니다.

### 왜 동적 import가 필요한가?

**문제**: 정적 import (`import { loginWithGoogle } from '../lib/google'`)는 파일이 로드될 때 즉시 실행됩니다. `google.ts` 파일의 첫 줄에 있는 `import { GoogleSignin } from '@react-native-google-signin/google-signin'`가 실행되면서 네이티브 모듈을 찾으려 시도하고, Expo Go에서는 이 모듈이 없어서 앱이 크래시됩니다.

**해결**: 동적 import (`await import('../lib/google')`)는 실제로 필요할 때만 모듈을 로드합니다. Expo Go에서는 버튼이 숨겨져 있어서 이 코드가 실행되지 않으므로 에러가 발생하지 않습니다.

### 대안

- **개발 빌드(Development Build)**: 커스텀 네이티브 모듈을 포함한 개발용 빌드
- **EAS Build**: Expo Application Services를 통한 클라우드 빌드

## 📚 참고 자료

- [Expo Constants Documentation](https://docs.expo.dev/versions/latest/sdk/constants/)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [React Native Google Sign-In](https://github.com/react-native-google-signin/google-signin)

## ⚠️ 주의사항

1. **정적 import 금지**: 네이티브 모듈을 사용하는 파일을 정적으로 import하면 Expo Go에서 즉시 크래시 발생
2. **동적 import 필수**: `await import()` 문법을 사용하여 필요할 때만 로드
3. **회원가입 화면**: 현재 Google 회원가입 버튼이 없으므로 별도 수정 불필요
4. **다른 네이티브 모듈**: 필요시 동일한 방식으로 Expo Go 감지 및 비활성화 가능
5. **환경 변수**: `__DEV__`와 `Constants.executionEnvironment`는 다른 목적으로 사용됨
   - `__DEV__`: 개발 모드 여부 (디버그 로그 등)
   - `Constants.executionEnvironment`: 실행 환경 타입 (Expo Go, standalone 등)

## 🚀 향후 개선 방안

1. **안내 메시지 추가**: Expo Go에서는 Google 로그인이 지원되지 않는다는 메시지 표시 (선택사항)
2. **개발 빌드 권장**: 팀 내부에서 개발 빌드 사용 권장
3. **자동화 테스트**: CI/CD 파이프라인에 환경별 테스트 추가

