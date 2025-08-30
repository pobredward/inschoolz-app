# 인스쿨즈 푸시 알림 시스템 가이드

## 📱 구현된 기능

### 1. 푸시 알림 기본 설정
- **Expo Notifications 설정** (`lib/push-notifications.ts`)
- **Android 알림 채널 설정**
- **iOS 백그라운드 알림 설정**
- **푸시 토큰 관리**

### 2. 알림 타입별 처리
- **게시글 댓글 알림** (`post_comment`)
- **댓글 답글 알림** (`comment_reply`)
- **추천인 등록 알림** (`referral`)
- **시스템 공지 알림** (`system`)
- **신고/제재 알림** (`warning`, `suspension`)

### 3. 자동 네비게이션
- 알림 탭 시 해당 화면으로 자동 이동
- 게시글, 프로필, 알림 페이지 등 적절한 라우팅

## 🛠 주요 구성 요소

### 파일 구조
```
lib/
├── push-notifications.ts          # 푸시 알림 핵심 로직
├── push-notification-sender.ts    # 서버측 알림 발송
├── notification-handlers.ts       # 알림 수신/처리 핸들러
└── notifications.ts               # 기존 알림 로직 (푸시 연동)

store/
└── authStore.ts                   # 푸시 토큰 관리 추가

app/
├── _layout.tsx                    # 푸시 알림 초기화
└── notifications.tsx              # 알림 화면 (뱃지 연동)

types/
└── index.ts                       # 푸시 토큰 타입 정의
```

## 📋 사용 방법

### 1. 사용자 로그인 시 자동 처리
```typescript
// _layout.tsx에서 자동으로 처리됨
// 1. 푸시 권한 요청
// 2. 토큰 생성 및 Firebase 저장
// 3. 알림 핸들러 등록
```

### 2. 알림 생성 시 푸시 발송
```typescript
import { createNotification } from '../lib/notifications';

// 기존 알림 생성 함수 호출 시 자동으로 푸시 알림도 발송됨
await createNotification({
  userId: 'user123',
  type: 'post_comment',
  title: '새 댓글',
  message: '회원님의 게시글에 댓글이 달렸습니다.',
  data: {
    postId: 'post123',
    commentId: 'comment456'
  }
});
```

### 3. 서버에서 직접 푸시 발송
```typescript
import { sendPushNotificationToUser } from '../lib/push-notification-sender';

await sendPushNotificationToUser(
  'user123',
  'system',
  '시스템 공지',
  '새로운 업데이트가 있습니다.',
  { version: '1.2.0' }
);
```

### 4. 테스트 알림 발송
```typescript
import { sendTestNotification } from '../lib/notification-handlers';

// 개발/테스트용
await sendTestNotification();
```

## 🔧 설정 옵션

### Android 알림 채널
```typescript
// 기본 채널
- default: 일반 알림
- comments: 댓글/답글 알림  
- system: 시스템 알림
- referral: 추천인 알림
```

### iOS 백그라운드 모드
```json
// app.json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["remote-notification"]
  }
}
```

## 📊 알림 흐름

### 1. 알림 생성 → 푸시 발송
```
사용자 액션 → createNotification() → Firebase 저장 → 푸시 발송
```

### 2. 푸시 수신 → 처리
```
푸시 수신 → handleNotificationResponse() → 읽음 처리 → 네비게이션
```

### 3. 뱃지 관리
```
앱 시작 → 읽지않은 개수 조회 → 뱃지 업데이트
알림 읽음 → 개수 감소 → 뱃지 업데이트
```

## 🚀 고급 기능

### 1. 알림 설정 (향후 구현)
```typescript
// 사용자별 알림 설정
const settings = {
  post_comment: true,
  comment_reply: true,
  system: true,
  quietHours: {
    enabled: true,
    startTime: '22:00',
    endTime: '08:00'
  }
};
```

### 2. 배치 발송
```typescript
// 여러 사용자에게 동시 발송
await sendPushNotificationToMultipleUsers(
  ['user1', 'user2', 'user3'],
  'system',
  '공지사항',
  '서버 점검 안내'
);
```

### 3. Cloud Functions 연동
```javascript
// Firebase Cloud Functions에서 사용 예시
const { sendNotificationWithChecks } = require('./push-notification-sender');

exports.onCommentCreated = functions.firestore
  .document('comments/{commentId}')
  .onCreate(async (snap, context) => {
    const comment = snap.data();
    // 게시글 작성자에게 알림 발송
    await sendNotificationWithChecks(
      comment.postAuthorId,
      'post_comment',
      '새 댓글',
      `${comment.authorName}님이 댓글을 남겼습니다.`
    );
  });
```

## 📱 테스트 방법

### 1. 개발 환경
```bash
# Expo 개발 서버 실행
npm start

# 물리적 기기에서 테스트 (에뮬레이터는 푸시 알림 제한)
```

### 2. 푸시 토큰 확인
```typescript
// 콘솔에서 토큰 확인
console.log('푸시 토큰:', token);
```

### 3. 테스트 알림
```typescript
// 앱 내에서 테스트 알림 발송
import { sendTestNotification } from '../lib/notification-handlers';
await sendTestNotification();
```

## 🔒 보안 고려사항

### 1. 토큰 보안
- 토큰은 사용자별로 안전하게 저장
- 로그아웃 시 토큰 자동 제거
- 만료된 토큰 자동 갱신

### 2. 권한 관리
- 알림 권한이 없는 사용자 처리
- 사용자별 알림 설정 존중

### 3. 데이터 검증
- 푸시 데이터 유효성 검사
- 악의적인 데이터 필터링

## 🐛 트러블슈팅

### 1. 푸시 알림이 오지 않는 경우
- 기기 알림 권한 확인
- 푸시 토큰 등록 상태 확인
- 네트워크 연결 상태 확인

### 2. 앱이 알림으로 열리지 않는 경우
- 딥링크 설정 확인
- 네비게이션 라우팅 확인

### 3. 뱃지가 업데이트되지 않는 경우
- setBadgeCount 호출 확인
- iOS 권한 설정 확인

## 📈 향후 개선 사항

1. **개인화된 알림 설정 UI**
2. **조용한 시간 기능**
3. **알림 히스토리 백업**
4. **푸시 분석 대시보드**
5. **A/B 테스트 기능**

---

## 🛟 지원

문제가 발생하거나 질문이 있으시면:
1. GitHub Issues 생성
2. 개발팀 연락
3. 로그 파일 확인 (`console.log` 출력)

**Happy Coding! 🎉**
