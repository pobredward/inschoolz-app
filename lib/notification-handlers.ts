/**
 * 푸시 알림 핸들링 로직
 * 알림 수신, 처리, 네비게이션 등을 담당합니다.
 */

import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { markNotificationAsRead, getUnreadNotificationCount } from './notifications';
import { setBadgeCount } from './push-notifications';
import { useAuthStore } from '../store/authStore';

/**
 * 알림 데이터 타입 정의
 */
interface NotificationData {
  type?: string;
  postId?: string;
  commentId?: string;
  replyId?: string;
  targetUserId?: string;
  postType?: string;
  boardCode?: string;
  schoolId?: string;
  regions?: string[];
  reportId?: string;
  referrerName?: string;
  expGained?: number;
  test?: boolean;
  timestamp?: number;
}

/**
 * 알림 탭 시 적절한 화면으로 네비게이션
 */
export function handleNotificationNavigation(data: NotificationData): void {
  if (!data || !data.type) {
    console.warn('알림 데이터가 없거나 타입이 지정되지 않았습니다.');
    router.push('/notifications');
    return;
  }

  try {
    console.log('알림 네비게이션 처리:', data);

    switch (data.type) {
      case 'post_comment':
      case 'comment_reply':
        handlePostNotificationNavigation(data);
        break;
        
      case 'referral':
        handleReferralNotificationNavigation(data);
        break;
        
      case 'system':
      case 'warning':
      case 'suspension':
      case 'report_received':
      case 'report_resolved':
        handleSystemNotificationNavigation(data);
        break;
        
      default:
        console.log('알 수 없는 알림 타입:', data.type);
        router.push('/notifications');
        break;
    }
  } catch (error) {
    console.error('알림 네비게이션 처리 실패:', error);
    // 실패시 기본 알림 화면으로 이동
    router.push('/notifications');
  }
}

/**
 * 게시글/댓글 관련 알림 네비게이션
 */
function handlePostNotificationNavigation(data: NotificationData): void {
  if (!data.postId) {
    console.warn('게시글 ID가 없습니다.');
    router.push('/notifications');
    return;
  }

  // 게시글 타입에 따른 라우팅
  let route = '';
  
  if (data.postType === 'national' && data.boardCode) {
    // 전국 게시판
    route = `/board/national/${data.boardCode}/${data.postId}`;
  } else if (data.postType === 'regional' && data.boardCode) {
    // 지역 게시판
    route = `/board/regional/${data.boardCode}/${data.postId}`;
  } else if (data.postType === 'school' && data.boardCode) {
    // 학교 게시판
    route = `/board/school/${data.boardCode}/${data.postId}`;
  } else {
    console.warn('알림 데이터가 불완전합니다:', data);
    router.push('/notifications');
    return;
  }
  
  if (route) {
    console.log('알림 클릭으로 이동:', route);
    router.push(route as any);
  }
}

/**
 * 추천인 관련 알림 네비게이션
 */
function handleReferralNotificationNavigation(data: NotificationData): void {
  if (data.targetUserId) {
    // 추천인 프로필 화면으로 이동
    router.push(`/users/${data.targetUserId}` as any);
  } else {
    // 프로필 화면으로 이동
    router.push('/profile');
  }
}

/**
 * 시스템 관련 알림 네비게이션
 */
function handleSystemNotificationNavigation(data: NotificationData): void {
  // 시스템 알림은 기본적으로 알림 화면으로
  router.push('/notifications');
}

/**
 * 포그라운드에서 알림 수신 시 처리
 */
export function handleForegroundNotification(notification: Notifications.Notification): void {
  console.log('포그라운드 알림 수신:', notification);
  
  const { title, body, data } = notification.request.content;
  
  // 읽지 않은 알림 개수 업데이트
  updateNotificationBadge();
  
  // 필요시 인앱 알림 표시
  // 예: Toast 메시지, 배너 알림 등
  showInAppNotification(title, body, data);
}

/**
 * 알림 탭 시 처리 (백그라운드/종료 상태에서 알림으로 앱 열림)
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  console.log('알림 탭 처리:', response);
  
  const { data } = response.notification.request.content;
  const notificationId = response.notification.request.identifier;
  
  // 알림을 읽음으로 처리
  if (data?.notificationId) {
    markNotificationAsRead(data.notificationId).catch(error => {
      console.warn('알림 읽음 처리 실패:', error);
    });
  }
  
  // 뱃지 업데이트
  updateNotificationBadge();
  
  // 네비게이션 처리
  handleNotificationNavigation(data as NotificationData);
}

/**
 * 알림 뱃지 업데이트
 */
export async function updateNotificationBadge(): Promise<void> {
  try {
    const { user, updateUnreadNotificationCount } = useAuthStore.getState();
    
    if (user) {
      const unreadCount = await getUnreadNotificationCount(user.uid);
      await setBadgeCount(unreadCount);
      updateUnreadNotificationCount(unreadCount);
      console.log('알림 뱃지 업데이트:', unreadCount);
    }
  } catch (error) {
    console.error('알림 뱃지 업데이트 실패:', error);
  }
}

/**
 * 인앱 알림 표시 (선택적 구현)
 */
function showInAppNotification(
  title: string | undefined, 
  body: string | undefined, 
  data: any
): void {
  // 여기에서 커스텀 인앱 알림 UI를 표시할 수 있습니다.
  // 예: React Native의 Alert, Toast 라이브러리, 커스텀 모달 등
  
  console.log('인앱 알림 표시:', { title, body, data });
  
  // 예시: 간단한 로그만 출력 (실제로는 UI 컴포넌트로 표시)
  if (title && body) {
    // Alert.alert(title, body); // 필요시 활성화
  }
}

/**
 * 알림 설정 저장/로드 (향후 구현)
 */
export interface NotificationSettings {
  post_comment: boolean;
  comment_reply: boolean;
  system: boolean;
  referral: boolean;
  warning: boolean;
  suspension: boolean;
  report_received: boolean;
  report_resolved: boolean;
  // 시간대 설정
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  };
}

/**
 * 기본 알림 설정
 */
export const defaultNotificationSettings: NotificationSettings = {
  post_comment: true,
  comment_reply: true,
  system: true,
  referral: true,
  warning: true,
  suspension: true,
  report_received: true,
  report_resolved: true,
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

/**
 * 사용자 알림 설정 업데이트 (향후 구현)
 */
export async function updateNotificationSettings(
  userId: string,
  settings: Partial<NotificationSettings>
): Promise<void> {
  try {
    // Firebase에 설정 저장
    console.log('알림 설정 업데이트:', { userId, settings });
    // TODO: Firestore에 설정 저장 로직 구현
  } catch (error) {
    console.error('알림 설정 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 사용자 알림 설정 조회 (향후 구현)
 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    // Firebase에서 설정 조회
    console.log('알림 설정 조회:', userId);
    // TODO: Firestore에서 설정 조회 로직 구현
    return defaultNotificationSettings;
  } catch (error) {
    console.error('알림 설정 조회 실패:', error);
    return defaultNotificationSettings;
  }
}

/**
 * 조용한 시간 체크 (향후 구현)
 */
export function isQuietHours(settings: NotificationSettings): boolean {
  if (!settings.quietHours?.enabled) {
    return false;
  }
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const { startTime, endTime } = settings.quietHours;
  
  // 시간 비교 로직
  if (startTime <= endTime) {
    // 같은 날 (예: 22:00 - 23:00)
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // 다음 날까지 (예: 22:00 - 08:00)
    return currentTime >= startTime || currentTime <= endTime;
  }
}

/**
 * 테스트 알림 발송 (개발용) - 화면 꺼짐 상태 테스트 포함
 */
export async function sendTestNotification(): Promise<void> {
  try {
    const { user } = useAuthStore.getState();
    if (!user) {
      console.warn('로그인된 사용자가 없습니다.');
      return;
    }

    // 로컬 테스트 알림 스케줄링 - 화면 꺼져있을 때도 소리와 미리보기 테스트
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 테스트 알림',
        body: '화면이 꺼져있어도 소리가 나고 미리보기가 보여야 합니다!',
        data: {
          type: 'system',
          test: true,
          timestamp: Date.now(),
        },
        sound: 'default',
        // Android 전용 설정
        android: {
          channelId: 'default',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          color: '#FF231F7C',
        },
        // iOS 전용 설정
        ios: {
          sound: true,
        },
      },
      trigger: null, // 즉시 발송
    });

    console.log('🎉 테스트 알림 발송 완료 - 화면 꺼져있을 때 소리와 미리보기 확인하세요!');
  } catch (error) {
    console.error('❌ 테스트 알림 발송 실패:', error);
  }
}
