# Inschoolz Mobile App

Inschoolz의 React Native Expo 모바일 애플리케이션입니다.

## 🚀 기술 스택

- **React Native**: 0.79.5
- **Expo**: 53.0.16
- **TypeScript**: 5.8.3
- **Firebase**: 11.10.0
- **Zustand**: 상태 관리
- **Expo Router**: 네비게이션

## 📱 주요 기능

- **3계층 커뮤니티**: 학교, 지역, 전국 커뮤니티
- **경험치 시스템**: 활동 기반 레벨업
- **미니게임**: 반응속도, 타일 맞추기 등
- **실시간 랭킹**: 개인/학교별 순위
- **출석 체크**: 매일 출석 보상 시스템

## 🛠️ 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 Firebase 설정을 추가하세요:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 3. 개발 서버 실행
```bash
npm start
```

### 4. 플랫폼별 실행
```bash
# iOS
npm run ios

# Android
npm run android

# 웹 (개발용)
npm run web
```

## 📂 프로젝트 구조

```
inschoolz-app/
├── app/                    # Expo Router 페이지
│   ├── (tabs)/            # 탭 네비게이션
│   ├── auth.tsx           # 인증 페이지
│   ├── signup/            # 회원가입 단계
│   └── board/             # 게시판 관련 페이지
├── components/            # 재사용 가능한 컴포넌트
├── lib/                   # 비즈니스 로직 및 API
├── store/                 # 상태 관리 (Zustand)
├── types/                 # TypeScript 타입 정의
└── assets/                # 이미지, 폰트 등
```

## 🎨 디자인 시스템

- **컬러**: 파스텔 그린 계열
- **폰트**: 잼민이 스타일 (귀여운 손글씨)
- **UI**: 학생 친화적인 직관적 인터페이스

## 📋 주요 스크립트

- `npm start`: 개발 서버 시작
- `npm run android`: Android 앱 실행
- `npm run ios`: iOS 앱 실행
- `npm run web`: 웹 버전 실행 (개발용)
- `npm run lint`: 코드 린팅

## 🔧 빌드 및 배포

### EAS Build 설정
```bash
# EAS CLI 설치
npm install -g @expo/eas-cli

# 로그인
eas login

# 빌드 설정
eas build:configure

# 개발 빌드
eas build --platform android --profile development
eas build --platform ios --profile development

# 프로덕션 빌드
eas build --platform all --profile production
```

## 📱 지원 플랫폼

- **iOS**: 13.0+
- **Android**: API 21+ (Android 5.0+)
- **웹**: 개발 및 테스트 용도

## 🤝 기여하기

1. 이 저장소를 포크하세요
2. 새로운 기능 브랜치를 만드세요 (`git checkout -b feature/AmazingFeature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/AmazingFeature`)
5. Pull Request를 생성하세요

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🌟 주요 특징

- **오프라인 지원**: 네트워크 없이도 기본 기능 사용 가능
- **실시간 업데이트**: Firebase를 통한 실시간 데이터 동기화
- **푸시 알림**: 중요한 업데이트 및 알림 전송
- **다크 모드**: 사용자 선호도에 따른 테마 지원 (예정)

---

**Inschoolz** - 학생들을 위한 안전하고 재미있는 커뮤니티 플랫폼
# Git sync test
