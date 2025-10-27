# Google 소셜 로그인 설정 가이드

## 📋 개요

인스쿨즈 앱에 Google 소셜 로그인 기능이 추가되었습니다. iOS와 Android 모두에서 사용할 수 있습니다.

## ✅ 완료된 작업

### 1. 패키지 설치
```bash
npm install @react-native-google-signin/google-signin
```

### 2. Google Cloud Console 설정 확인

#### iOS Client ID
- **Client ID**: `702584515843-mt6584jc65q4e02qq6snip7qi12fpe2t.apps.googleusercontent.com`
- **Reversed Client ID**: `com.googleusercontent.apps.702584515843-mt6584jc65q4e02qq6snip7qi12fpe2t`
- **상태**: ✅ 활성화됨
- **생성일**: 2025.07.02

#### Web Client ID (Android용)
- **Client ID**: `702584515843-i4g6uf5nki2vvp14rk1gql61b2s8mear.apps.googleusercontent.com`
- **상태**: ✅ 활성화됨
- **생성일**: 2024.08.04

#### Android Key (자동 생성)
- **Client ID**: Firebase에서 자동 생성
- **SHA-1 지문**: Firebase Console에 등록됨

### 3. iOS 설정 (app.json)

```json
"CFBundleURLTypes": [
  {
    "CFBundleURLName": "google",
    "CFBundleURLSchemes": [
      "com.googleusercontent.apps.702584515843-mt6584jc65q4e02qq6snip7qi12fpe2t"
    ]
  }
]
```

### 4. Android 설정

#### google-services.json
- 이미 프로젝트에 포함되어 있음
- OAuth Client 설정 완료

#### build.gradle
```gradle
apply plugin: 'com.google.gms.google-services'
```
이미 적용되어 있음 ✅

### 5. 구현 파일

#### lib/google.ts
Google Sign-In 로직 구현:
- `initializeGoogleSignIn()`: Google SDK 초기화
- `loginWithGoogle()`: Google 로그인 처리
- `isGoogleSignedIn()`: 로그인 상태 확인
- `unlinkGoogle()`: 계정 연결 해제

#### app/login.tsx
UI에 Google 로그인 버튼 추가:
- Google 브랜드 컬러 (#4285F4) 사용
- Ionicons의 `logo-google` 아이콘 사용
- 카카오 로그인 버튼과 Apple 로그인 버튼 사이에 배치

## 🚀 사용 방법

### 사용자 관점

1. 로그인 화면에서 "Google로 로그인" 버튼 클릭
2. Google 계정 선택 화면 표시
3. 계정 선택 후 권한 승인
4. 자동으로 Firebase에 로그인되고 Firestore에 사용자 정보 저장

### 개발자 관점

```typescript
import { loginWithGoogle } from '../lib/google';

const handleGoogleLogin = async () => {
  try {
    const user = await loginWithGoogle();
    console.log('로그인 성공:', user);
  } catch (error) {
    console.error('로그인 실패:', error.message);
  }
};
```

## 🔧 빌드 및 테스트

### Development Build 필요
Google Sign-In은 네이티브 모듈이므로 **Development Build**가 필요합니다.

```bash
# iOS Development Build
npx eas build --platform ios --profile development

# Android Development Build
npx eas build --platform android --profile development
```

### Expo Go에서는 작동하지 않음
⚠️ Google Sign-In은 Expo Go에서 지원되지 않습니다. Development Build 또는 Production Build에서만 작동합니다.

### 테스트 방법

#### iOS 테스트
1. Development Build 설치
2. 로그인 화면에서 "Google로 로그인" 버튼 클릭
3. Safari에서 Google 로그인 페이지 열림
4. 계정 선택 및 권한 승인
5. 앱으로 자동 복귀 및 로그인 완료

#### Android 테스트
1. Development Build 설치
2. Google Play Services 설치 확인
3. 로그인 화면에서 "Google로 로그인" 버튼 클릭
4. Google 계정 선택 바텀시트 표시
5. 계정 선택 및 권한 승인
6. 즉시 로그인 완료

## 📱 플랫폼별 특징

### iOS
- **웹 기반 인증**: Safari를 통한 OAuth 인증
- **앱 전환**: Safari → 앱 자동 복귀
- **필수 설정**: CFBundleURLSchemes 설정 (✅ 완료)
- **Client ID**: iOS Client ID 사용

### Android
- **네이티브 인증**: Google Play Services 사용
- **바텀시트**: 앱 내에서 계정 선택
- **필수 설정**: google-services.json (✅ 완료)
- **Client ID**: Web Client ID 사용

## 🔐 보안 고려사항

### 1. Token 관리
- ID Token만 사용 (Access Token은 서버에서만 관리)
- Token은 Firebase에서 자동으로 갱신

### 2. 사용자 정보
- 프로필: 이름, 이메일, 프로필 사진
- Scope: `profile`, `email` (기본)
- 추가 정보는 사용자 동의 필요

### 3. Firebase 연동
- Google 인증 후 Firebase 자동 로그인
- Firestore에 사용자 정보 저장
- Firebase Auth의 사용자 관리 기능 활용

## 🐛 문제 해결

### "Google Play Services를 사용할 수 없습니다"
- Android 기기에 Google Play Services 설치 필요
- 에뮬레이터: Google Play가 포함된 이미지 사용

### "로그인이 취소되었습니다"
- 사용자가 로그인 과정을 취소한 경우
- 정상적인 동작이므로 에러로 처리하지 않음

### "이미 로그인이 진행 중입니다"
- 중복 클릭 방지를 위해 버튼 비활성화
- 로그인 중에는 `isLoading` 상태 활용

### iOS에서 "Invalid Client ID"
- app.json의 URL Scheme이 올바른지 확인
- Development Build 재빌드 필요

### Android에서 "DEVELOPER_ERROR"
- SHA-1 지문이 Firebase Console에 등록되어 있는지 확인
- google-services.json 파일이 최신인지 확인

## 📊 로그인 플로우

```
사용자 클릭
    ↓
Google Sign-In 초기화
    ↓
Google 로그인 화면
    ↓
계정 선택 및 권한 승인
    ↓
ID Token 획득
    ↓
Firebase 인증
    ↓
Firestore 사용자 정보 확인/생성
    ↓
로그인 완료
```

## 🎨 UI 디자인

### Google 로그인 버튼
- **배경색**: #4285F4 (Google 브랜드 컬러)
- **텍스트 색**: 흰색
- **아이콘**: Ionicons `logo-google`
- **크기**: 높이 48px, 패딩 12px
- **위치**: 카카오 로그인 버튼 아래

### 버튼 순서
1. 이메일 로그인
2. 구분선 ("또는")
3. 카카오 로그인 (노란색)
4. **Google 로그인 (파란색)** ← NEW
5. Apple 로그인 (검정색, iOS만)

## 📝 코드 구조

```
inschoolz-app/
├── lib/
│   └── google.ts          # Google 로그인 로직
├── app/
│   └── login.tsx          # 로그인 UI (Google 버튼 추가)
├── app.json               # iOS URL Scheme 설정
├── google-services.json   # Android Google Services 설정
└── GoogleService-Info.plist  # iOS Google Services 설정
```

## 🔄 다음 단계

### 프로덕션 배포 전 체크리스트
- [ ] iOS Development Build 테스트 완료
- [ ] Android Development Build 테스트 완료
- [ ] 프로덕션 SHA-1 지문을 Firebase Console에 등록
- [ ] App Store / Play Store 배포용 Production Build
- [ ] 프로덕션 환경에서 로그인 테스트

### 추가 고려사항
- [ ] Google 계정 연결 해제 기능 (프로필 설정)
- [ ] Google 로그인 통계 추적 (Analytics)
- [ ] 에러 로깅 및 모니터링

## 📚 참고 자료

- [Google Sign-In for React Native](https://react-native-google-signin.github.io/docs/)
- [Firebase Authentication - Google](https://firebase.google.com/docs/auth/android/google-signin)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)

## ✅ 체크리스트

- [x] @react-native-google-signin/google-signin 패키지 설치
- [x] lib/google.ts 파일 생성
- [x] app.json에 iOS URL Scheme 추가
- [x] login.tsx에 Google 로그인 버튼 추가
- [x] Android build.gradle 설정 확인
- [x] Google Cloud Console OAuth 클라이언트 확인
- [ ] iOS Development Build 테스트
- [ ] Android Development Build 테스트
- [ ] Production Build 배포

---

**작성일**: 2025-10-27  
**작성자**: AI Assistant  
**버전**: 1.0.0

