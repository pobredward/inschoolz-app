# 인스쿨즈 앱 - 카카오 로그인 설정 가이드

## ⚠️ 중요: 네이티브 앱 키 사용

**앱에서는 네이티브 앱 키를 사용해야 합니다:**
- ❌ JavaScript 키: `7aa469d3bb62d3e03652579878c8e7b3` (웹 전용)
- ✅ **네이티브 앱 키**: `380177b185226c4935a7f293190afc46` (앱 전용)

## 1. 카카오 개발자 콘솔 플랫폼 설정

### 1-1. Android 플랫폼 추가
1. [카카오 개발자 콘솔](https://developers.kakao.com/)에 접속
2. **내 애플리케이션** → **인스쿨즈** 앱 선택
3. **앱 설정** → **플랫폼** → **Android 플랫폼 등록**
4. 다음 정보 입력:
   ```
   패키지명: com.onmindlab.inschoolz
   마켓 URL: https://play.google.com/store/apps/details?id=com.onmindlab.inschoolz
   키 해시: (아래 단계에서 생성)
   ```

### 1-2. Android 키 해시 생성
개발 및 릴리즈용 키 해시를 생성해야 합니다:

```bash
# 개발용 키 해시 (debug keystore)
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64

# 릴리즈용 키 해시 (upload keystore)
keytool -exportcert -alias upload -keystore ./upload-keystore.jks -storepass [비밀번호] -keypass [비밀번호] | openssl sha1 -binary | openssl base64
```

### 1-3. iOS 플랫폼 추가
1. **앱 설정** → **플랫폼** → **iOS 플랫폼 등록**
2. 다음 정보 입력:
   ```
   번들 ID: com.onmindlab.inschoolz
   앱스토어 ID: (출시 후 추가)
   팀 ID: (Apple Developer Team ID)
   ```

## 2. 카카오 로그인 설정

### 2-1. Redirect URI 추가
1. **제품 설정** → **카카오 로그인** → **Redirect URI**
2. 다음 URI 추가:
   ```
   # 앱용 커스텀 스킴
   kakao380177b185226c4935a7f293190afc46://oauth
   
   # 웹용 (기존)
   http://localhost:3000/api/auth/callback/kakao
   https://inschoolz.com/api/auth/callback/kakao
   ```

### 2-2. 동의항목 설정
앱에서 사용할 사용자 정보 동의항목을 설정합니다:
- **프로필 정보 (닉네임/프로필 사진)**: 필수 동의
- **카카오계정 (이메일)**: 선택 동의 
- **성별**: 선택 동의
- **연령대**: 선택 동의
- **생일**: 선택 동의

## 3. 앱 빌드 설정

### 3-1. Android 설정
현재 `app.json`에 다음 설정이 추가되어 있습니다:

```json
{
  "android": {
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [
          {
            "scheme": "kakao380177b185226c4935a7f293190afc46"
          }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

### 3-2. iOS 설정
현재 `app.json`에 다음 설정이 추가되어 있습니다:

```json
{
  "ios": {
    "infoPlist": {
      "CFBundleURLTypes": [
        {
          "CFBundleURLName": "kakao",
          "CFBundleURLSchemes": ["kakao380177b185226c4935a7f293190afc46"]
        }
      ],
      "LSApplicationQueriesSchemes": ["kakaokompassauth", "kakaolink"]
    }
  }
}
```

## 4. 개발 및 테스트

### 4-1. 개발 환경에서 테스트
1. 개발 빌드 생성:
   ```bash
   npx expo run:android
   # 또는
   npx expo run:ios
   ```

2. 앱에서 카카오 로그인 버튼 클릭
3. 카카오톡 또는 카카오계정 로그인
4. 권한 동의 후 앱으로 자동 복귀 확인

### 4-2. 로그 확인
앱 콘솔에서 다음과 같은 로그를 확인할 수 있습니다:

```
✅ 카카오 SDK 초기화 완료
📝 카카오 로그인 시작
✅ 카카오 로그인 성공
📝 카카오 사용자 정보 조회 완료: [닉네임]
📝 Firebase 커스텀 토큰 생성 완료
📝 Firebase 로그인 완료: [UID]
```

## 5. 릴리즈 빌드

### 5-1. EAS Build 설정
```bash
# 프로덕션 빌드
eas build --platform android --profile production
eas build --platform ios --profile production
```

### 5-2. 카카오 개발자 콘솔 최종 확인
릴리즈 전에 다음 사항을 확인:
- [ ] 릴리즈 키 해시가 올바르게 등록되었는지
- [ ] 프로덕션 번들 ID가 올바르게 설정되었는지
- [ ] 동의항목이 앱 정책에 맞게 설정되었는지

## 6. 문제 해결

### 6-1. "앱 등록이 되지 않음" 오류
- 카카오 개발자 콘솔에서 해당 플랫폼이 올바르게 등록되었는지 확인
- 패키지명/번들 ID가 일치하는지 확인

### 6-2. "키 해시 불일치" 오류 (Android)
- 개발용과 릴리즈용 키 해시가 모두 등록되었는지 확인
- 키 해시 생성 명령어를 정확히 실행했는지 확인

### 6-3. "카카오톡 실행되지 않음" 오류
- `LSApplicationQueriesSchemes`에 `kakaokompassauth`가 포함되었는지 확인 (iOS)
- 앱 권한에서 카카오톡 연결이 허용되어 있는지 확인

### 6-4. 네트워크 오류
- 웹 서버 API (`https://inschoolz.com/api/auth/kakao/token`)가 정상 작동하는지 확인
- 방화벽에서 카카오 API 도메인이 차단되지 않았는지 확인

## 7. 보안 고려사항

1. **앱 키 보안**
   - JavaScript 키는 클라이언트에 노출되므로 도메인/패키지 제한 설정 필수
   - Admin 키는 절대 앱에 포함하지 않음

2. **사용자 정보 보호**
   - 최소한의 권한만 요청
   - 사용자 동의를 받은 정보만 수집

3. **데이터 전송 보안**
   - HTTPS를 통한 보안 통신
   - 액세스 토큰의 안전한 전송

## 8. 참고 자료

- [카카오 로그인 React Native 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/react-native)
- [@react-native-seoul/kakao-login 문서](https://github.com/react-native-seoul/react-native-kakao-login)
- [Expo 커스텀 네이티브 코드 가이드](https://docs.expo.dev/workflow/customizing/)
