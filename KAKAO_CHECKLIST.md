# 카카오 로그인 최종 체크리스트 📋

## 🎯 카카오 개발자 콘솔에서 반드시 확인해야 할 사항들

### 1. **플랫폼 등록 확인**
- [ ] **Android 플랫폼 등록됨** 
  - 패키지명: `com.onmindlab.inschoolz`
  - 키 해시: 디버그 + 릴리즈 키 해시 모두 등록
- [ ] **iOS 플랫폼 등록됨**
  - 번들 ID: `com.onmindlab.inschoolz`
  - 팀 ID: Apple Developer Team ID

### 2. **Redirect URI 설정**
- [ ] **앱용 커스텀 스킴 등록됨**:
  ```
  kakao380177b185226c4935a7f293190afc46://oauth
  ```
- [ ] **웹용 URI도 함께 등록되어 있음** (기존 웹 로그인 유지용)

### 3. **동의항목 설정**
- [ ] **프로필 정보 (닉네임/프로필 사진)**: 필수 동의
- [ ] **카카오계정 (이메일)**: 선택 동의
- [ ] **성별**: 선택 동의 (필요시)
- [ ] **연령대**: 선택 동의 (필요시)
- [ ] **생일**: 선택 동의 (필요시)

### 4. **앱 키 확인**
- [ ] **네이티브 앱 키 사용**: `380177b185226c4935a7f293190afc46`
- [ ] **JavaScript 키와 혼동하지 않음**: `7aa469d3bb62d3e03652579878c8e7b3` (웹 전용)

## 🔧 키 해시 생성 방법

### Android 디버그 키 해시
```bash
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64
```

### Android 릴리즈 키 해시 (EAS Build)
```bash
# EAS Build에서 자동 생성된 키스토어 사용
# 빌드 완료 후 콘솔에서 키 해시 확인 가능
```

## 📱 테스트 방법

### 1. **개발 환경 테스트**
```bash
npx expo run:android
# 또는
npx expo run:ios
```

### 2. **확인해야 할 로그**
```
✅ 카카오 SDK 초기화 완료
📱 카카오톡 앱으로 로그인 시도 (또는 카카오계정으로 로그인 시도)
✅ 카카오 로그인 성공
📝 카카오 사용자 정보 조회 완료: [닉네임]
🔥 Firebase 커스텀 토큰 생성 완료
🔥 Firebase 로그인 완료: [UID]
```

### 3. **테스트 시나리오**
- [ ] 카카오톡 앱이 설치된 기기에서 테스트
- [ ] 카카오톡 앱이 없는 기기에서 테스트 (웹뷰 로그인)
- [ ] 신규 사용자 가입 테스트
- [ ] 기존 사용자 로그인 테스트
- [ ] 로그아웃 테스트

## 🚨 문제 해결

### "앱 등록이 되지 않음" 오류
1. 카카오 개발자 콘솔에서 플랫폼 등록 확인
2. 패키지명/번들 ID 일치 여부 확인
3. 네이티브 앱 키 사용 여부 확인

### "키 해시 불일치" 오류 (Android)
1. 디버그 키 해시 등록 여부 확인
2. 릴리즈 키 해시 등록 여부 확인
3. 키 해시 생성 명령어 재실행

### "카카오톡 실행되지 않음" 오류
1. `LSApplicationQueriesSchemes`에 `kakaokompassauth` 포함 확인 (iOS)
2. `<package android:name="com.kakao.talk"/>` 등록 확인 (Android)
3. 앱 권한에서 카카오톡 연결 허용 확인

### 네트워크 관련 오류
1. 웹 서버 API (`https://inschoolz.com/api/auth/kakao/token`) 동작 확인
2. 카카오 API 호출 권한 확인
3. 방화벽/보안 설정 확인

## 🎉 완료 후 확인사항

- [ ] 개발 환경에서 카카오 로그인 성공
- [ ] TestFlight/내부 테스트에서 카카오 로그인 성공
- [ ] 프로덕션 환경에서 카카오 로그인 성공
- [ ] 웹과 앱 간 동일 계정으로 로그인 가능
- [ ] 사용자 정보 올바르게 동기화됨

## 📞 지원 및 문서

- [카카오 로그인 공식 문서](https://developers.kakao.com/docs/latest/ko/kakaologin/common)
- [@react-native-seoul/kakao-login GitHub](https://github.com/react-native-seoul/react-native-kakao-login)
- [Expo 커스텀 개발 클라이언트](https://docs.expo.dev/development/introduction/)
