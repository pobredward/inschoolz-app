import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Notification, NotificationType } from '../types';

// 알림 생성
export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    reportId?: string;
    postId?: string;
    commentId?: string;
    targetUserId?: string;
    actionTaken?: string;
    [key: string]: unknown;
  };
}): Promise<Notification> {
  try {
    const notificationData: Omit<Notification, 'id'> = {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
      isRead: false,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    
    return {
      id: docRef.id,
      ...notificationData,
    };
  } catch (error) {
    console.error('알림 생성 실패:', error);
    throw error;
  }
}

// 신고 접수 알림
export async function createReportReceivedNotification(
  targetUserId: string,
  reportId: string,
  reporterName: string,
  targetType: 'post' | 'comment' | 'user'
): Promise<void> {
  try {
    const targetTypeLabel = {
      post: '게시글',
      comment: '댓글',
      user: '프로필'
    }[targetType];

    await createNotification({
      userId: targetUserId,
      type: 'report_received',
      title: '신고 접수',
      message: `회원님의 ${targetTypeLabel}이 신고되었습니다. 검토 후 조치가 취해질 수 있습니다.`,
      data: {
        reportId,
        targetUserId,
      }
    });
  } catch (error) {
    console.error('신고 접수 알림 생성 실패:', error);
    throw error;
  }
}

// 신고 처리 완료 알림
export async function createReportResolvedNotification(
  reporterId: string,
  reportId: string,
  targetType: 'post' | 'comment' | 'user',
  actionTaken: string
): Promise<void> {
  try {
    const targetTypeLabel = {
      post: '게시글',
      comment: '댓글',
      user: '사용자'
    }[targetType];

    await createNotification({
      userId: reporterId,
      type: 'report_resolved',
      title: '신고 처리 완료',
      message: `신고하신 ${targetTypeLabel}에 대한 검토가 완료되었습니다. 조치: ${actionTaken}`,
      data: {
        reportId,
        actionTaken,
      }
    });
  } catch (error) {
    console.error('신고 처리 완료 알림 생성 실패:', error);
    throw error;
  }
}

// 경고/정지 알림
export async function createSanctionNotification(
  userId: string,
  type: 'warning' | 'suspension',
  reason: string,
  duration?: string
): Promise<void> {
  try {
    const title = type === 'warning' ? '경고 조치' : '계정 정지';
    const message = type === 'warning' 
      ? `커뮤니티 규칙 위반으로 경고가 부여되었습니다. 사유: ${reason}`
      : `커뮤니티 규칙 위반으로 계정이 정지되었습니다. 사유: ${reason}${duration ? ` (기간: ${duration})` : ''}`;

    await createNotification({
      userId,
      type,
      title,
      message,
      data: {
        reason,
        duration,
      }
    });
  } catch (error) {
    console.error('제재 알림 생성 실패:', error);
    throw error;
  }
}

// 사용자 알림 조회
export async function getUserNotifications(
  userId: string,
  limitCount: number = 20
): Promise<Notification[]> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
  } catch (error) {
    console.error('사용자 알림 조회 실패:', error);
    throw error;
  }
}

// 알림 읽음 처리
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, {
      isRead: true,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('알림 읽음 처리 실패:', error);
    throw error;
  }
}

// 모든 알림 읽음 처리
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        isRead: true,
        updatedAt: Timestamp.now(),
      })
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('모든 알림 읽음 처리 실패:', error);
    throw error;
  }
} 