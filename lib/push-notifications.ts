import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { collection, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// 알림 동작 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  platform: string;
  deviceId?: string;
}

/**
 * 푸시 알림 권한 요청 및 토큰 가져오기
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    // Android에서 알림 채널 설정
    await Notifications.setNotificationChannelAsync('default', {
      name: '인스쿨즈 알림',
      description: '인스쿨즈 앱의 기본 알림 채널입니다.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      // 화면 꺼져있을 때도 미리보기 표시
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      // 알림 우선순위 최대로 설정
      bypassDnd: false, // 방해금지 모드 우회하지 않음 (사용자 선택 존중)
    });

    // 추가 알림 채널들
    await Notifications.setNotificationChannelAsync('comments', {
      name: '댓글 알림',
      description: '게시글 댓글 및 답글 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync('system', {
      name: '시스템 알림',
      description: '시스템 공지사항 및 중요 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync('referral', {
      name: '추천인 알림',
      description: '추천인 관련 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  if (Device.isDevice) {
    // 알림 권한 확인 및 요청
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('푸시 알림 권한이 거부되었습니다.');
      return null;
    }
    
    try {
      // Expo 푸시 토큰 가져오기
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || '66ad576c-df73-47e1-ab61-5295a3174493',
      })).data;
      
      console.log('✅ 푸시 알림 토큰 획득:', token);
    } catch (error) {
      console.error('❌ 푸시 토큰 획득 실패:', error);
    }
  } else {
    console.warn('물리적 기기에서만 푸시 알림이 작동합니다.');
  }

  return token;
}

/**
 * 사용자의 푸시 토큰을 Firebase에 저장
 */
export async function savePushTokenToUser(userId: string, token: string): Promise<void> {
  try {
    if (!token || !userId) {
      console.warn('푸시 토큰 또는 사용자 ID가 없습니다.');
      return;
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn('사용자 문서가 존재하지 않습니다:', userId);
      return;
    }

    const tokenData: PushNotificationToken = {
      token,
      platform: Platform.OS,
      deviceId: Constants.deviceId || undefined,
    };

    await updateDoc(userRef, {
      pushTokens: {
        [Platform.OS]: tokenData,
      },
      updatedAt: new Date(),
    });

    console.log('✅ 푸시 토큰 저장 완료:', userId);
  } catch (error) {
    console.error('❌ 푸시 토큰 저장 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 푸시 토큰 제거 (로그아웃 시)
 */
export async function removePushTokenFromUser(userId: string): Promise<void> {
  try {
    if (!userId) {
      console.warn('사용자 ID가 없습니다.');
      return;
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn('사용자 문서가 존재하지 않습니다:', userId);
      return;
    }

    const userData = userDoc.data();
    const pushTokens = userData.pushTokens || {};
    
    // 현재 플랫폼의 토큰 제거
    delete pushTokens[Platform.OS];

    await updateDoc(userRef, {
      pushTokens,
      updatedAt: new Date(),
    });

    console.log('✅ 푸시 토큰 제거 완료:', userId);
  } catch (error) {
    console.error('❌ 푸시 토큰 제거 실패:', error);
    throw error;
  }
}

/**
 * 앱이 포그라운드에 있을 때 받은 알림 처리
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * 사용자가 알림을 탭했을 때 처리
 */
export function addNotificationResponseReceivedListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * 알림 뱃지 숫자 설정
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('뱃지 카운트 설정 실패:', error);
  }
}

/**
 * 모든 알림 제거
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await setBadgeCount(0);
  } catch (error) {
    console.error('알림 제거 실패:', error);
  }
}

/**
 * 특정 알림 제거
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    console.error('알림 제거 실패:', error);
  }
}

/**
 * 로컬 알림 스케줄링 (테스트용)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
      // Android 설정 - 화면 꺼져있을 때도 표시
      android: {
        channelId: 'default',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        color: '#FF231F7C',
      },
      // iOS 설정
      ios: {
        sound: true,
      },
    },
    trigger: trigger || null, // 즉시 발송
  });
}

/**
 * 앱이 백그라운드에서 알림으로 열렸는지 확인
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * 푸시 알림 설정 상태 확인
 */
export async function checkNotificationSettings(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
  expires?: 'never' | number;
}> {
  const settings = await Notifications.getPermissionsAsync();
  return {
    granted: settings.granted,
    canAskAgain: settings.canAskAgain,
    expires: settings.expires,
  };
}

/**
 * 알림 유형별 채널 ID 가져오기 (Android)
 */
export function getNotificationChannelId(notificationType: string): string {
  const channelMap: Record<string, string> = {
    post_comment: 'comments',
    comment_reply: 'comments',
    system: 'system',
    referral: 'referral',
    warning: 'system',
    suspension: 'system',
    report_received: 'system',
    report_resolved: 'default',
  };

  return channelMap[notificationType] || 'default';
}
