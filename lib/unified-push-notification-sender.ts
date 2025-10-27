/**
 * React Native용 통합 푸시 알림 발송 시스템
 * Expo 푸시 알림을 지원합니다.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { NotificationType } from '../types';

interface ExpoMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  icon?: string;
  android?: {
    channelId?: string;
    sound?: boolean;
    priority?: 'default' | 'normal' | 'high';
    vibrate?: boolean;
    color?: string;
    icon?: string;
    largeIcon?: string;
  };
  ios?: {
    sound?: boolean;
    _displayInForeground?: boolean;
    attachments?: Array<{
      url: string;
      type?: string;
    }>;
  };
}

/**
 * Expo Push API를 사용하여 푸시 알림 발송
 */
export async function sendExpoPushNotification(message: ExpoMessage): Promise<{
  success: boolean;
  error?: string;
  receipt?: any;
}> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (response.ok) {
      return { success: true, receipt: result };
    } else {
      return { success: false, error: result.errors?.[0]?.message || 'Unknown error' };
    }
  } catch (error) {
    console.error('푸시 알림 발송 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * 통합 푸시 알림 발송 - 앱에서는 Expo만 지원
 */
export async function sendUnifiedPushNotification(
  userId: string,
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string; results?: any[] }> {
  try {
    // 사용자의 푸시 토큰 가져오기
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.log('📱 [INFO] 사용자를 찾을 수 없음:', userId);
      return { success: false, error: 'User not found' };
    }

    const userData = userDoc.data();
    const pushTokens = userData.pushTokens;

    if (!pushTokens || Object.keys(pushTokens).length === 0) {
      console.log('📱 [INFO] 푸시 토큰이 없음 (정상 - 토큰 미등록 사용자):', userId);
      return { 
        success: false, 
        error: 'No push tokens found - user may not have app installed or push permission denied' 
      };
    }

    const sendPromises: Promise<any>[] = [];
    const results: any[] = [];

    // Expo 토큰에만 알림 발송 (iOS/Android)
    for (const [platform, tokenData] of Object.entries(pushTokens)) {
      if (!tokenData || !(tokenData as any)?.token) {
        console.warn(`⚠️ [DEBUG] ${platform} 토큰이 유효하지 않음`);
        continue;
      }

      // 웹 토큰은 앱에서 처리하지 않음
      if (platform === 'web') {
        continue;
      }

      const token = (tokenData as any).token;
      const channelId = getChannelIdForNotificationType(notificationType);
      const expoMessage: ExpoMessage = {
        to: token,
        title,
        body,
        data: {
          type: notificationType,
          userId,
          ...data,
        },
        sound: 'default',
        priority: 'high',
        channelId,
        icon: 'https://inschoolz.com/android-icon-96x96.png',
        android: {
          channelId,
          sound: true,
          priority: 'high',
          vibrate: true,
          color: '#FF231F7C',
          icon: 'https://inschoolz.com/android-icon-96x96.png',
          largeIcon: 'https://inschoolz.com/android-icon-192x192.png',
        },
        ios: {
          sound: true,
          _displayInForeground: true,
          attachments: [{
            url: 'https://inschoolz.com/apple-icon-180x180.png',
            type: 'image'
          }],
        },
      };

      sendPromises.push(
        sendExpoPushNotification(expoMessage).then(result => ({
          platform,
          ...result
        }))
      );
    }

    if (sendPromises.length === 0) {
      return { success: false, error: 'No app push tokens found' };
    }

    // 모든 앱 토큰에 발송
    const allResults = await Promise.allSettled(sendPromises);
    
    // 결과 처리
    let hasSuccess = false;
    const errors: string[] = [];

    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        const platformResult = result.value;
        results.push(platformResult);
        
        if (platformResult.success) {
          hasSuccess = true;
        } else {
          errors.push(`${platformResult.platform}: ${platformResult.error}`);
        }
      } else {
        errors.push(`Exception: ${result.reason}`);
      }
    }

    if (hasSuccess) {
      return { success: true, results };
    } else {
      return { 
        success: false, 
        error: errors.join(', '), 
        results 
      };
    }

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * 기존 함수와의 호환성을 위한 래퍼 함수
 */
export async function sendPushNotificationToUser(
  userId: string,
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const result = await sendUnifiedPushNotification(userId, notificationType, title, body, data);
  return {
    success: result.success,
    error: result.error
  };
}

/**
 * 앱에서 서버로 웹 푸시 요청을 보내는 함수
 */
export async function requestWebPushFromServer(
  userId: string,
  notificationType: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // 서버의 웹 푸시 API 엔드포인트 호출
    const response = await fetch('/api/send-web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        notificationType,
        title,
        body,
        data
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Server error' };
    }
  } catch (error) {
    console.error('웹 푸시 서버 요청 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

// 알림 타입별 채널 ID 매핑
function getChannelIdForNotificationType(type: NotificationType): string {
  const channelMap: Record<NotificationType, string> = {
    'post_comment': 'comments',
    'comment_reply': 'comments', 
    'referral': 'referral',
    'system': 'system',
    'report_received': 'system',
    'report_resolved': 'system',
    'warning': 'system',
    'suspension': 'system',
  };
  
  return channelMap[type] || 'default';
}
