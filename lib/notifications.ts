import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  getDoc
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
    authorName?: string;
    referrerName?: string;
    postTitle?: string;
    commentContent?: string;
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

// 관리자 전체 알림
export async function createSystemNotification(
  title: string,
  message: string,
  targetUserIds?: string[] // 특정 사용자들만 대상으로 할 경우
): Promise<void> {
  try {
    // targetUserIds가 있으면 해당 사용자들에게만, 없으면 모든 사용자에게
    if (targetUserIds && targetUserIds.length > 0) {
      const createPromises = targetUserIds.map(userId =>
        createNotification({
          userId,
          type: 'system',
          title,
          message,
        })
      );
      await Promise.all(createPromises);
    } else {
      // 모든 사용자에게 알림 - 실제로는 Cloud Function으로 처리하는 것이 좋음
      console.log('전체 사용자 대상 알림은 Cloud Function으로 처리해야 합니다:', { title, message });
    }
  } catch (error) {
    console.error('시스템 알림 생성 실패:', error);
    throw error;
  }
}

// 추천인 설정 알림
export async function createReferralNotification(
  referredUserId: string,
  referrerName: string,
  referrerUserId: string,
  expGained?: number
): Promise<void> {
  try {
    const expText = expGained ? ` ${expGained} 경험치를 받았습니다!` : '!';
    
    await createNotification({
      userId: referredUserId,
      type: 'referral',
      title: '새로운 추천인 등록',
      message: `${referrerName}님이 회원님을 추천인으로 설정했습니다${expText}`,
      data: {
        referrerName,
        targetUserId: referrerUserId,
        expGained: expGained || 0
      }
    });
  } catch (error) {
    console.error('추천인 알림 생성 실패:', error);
    throw error;
  }
}

// 게시글 댓글 알림
export async function createPostCommentNotification(
  postAuthorId: string,
  commenterId: string,
  postId: string,
  commentId: string,
  postTitle: string,
  commentContent: string
): Promise<void> {
  try {
    // 댓글 작성자 정보 조회
    const commenterDoc = await getDoc(doc(db, 'users', commenterId));
    const commenterData = commenterDoc.data();
    const commenterName = commenterData?.profile?.userName || '사용자';

    // 게시글 정보 조회 (라우팅에 필요한 정보)
    const postDoc = await getDoc(doc(db, 'posts', postId));
    const postData = postDoc.data();

    // 기본 데이터 객체
    const notificationData: any = {
      postId,
      commentId,
      postTitle,
      authorName: commenterName,
      commentContent: commentContent.slice(0, 100), // 처음 100자만
    };

    // 라우팅에 필요한 정보 조건부 추가 (undefined 값 제외)
    if (postData?.type) {
      notificationData.postType = postData.type;
    }
    if (postData?.boardCode) {
      notificationData.boardCode = postData.boardCode;
    }
    if (postData?.schoolId) {
      notificationData.schoolId = postData.schoolId;
    }
    if (postData?.regions) {
      notificationData.regions = postData.regions;
    }

    await createNotification({
      userId: postAuthorId,
      type: 'post_comment',
      title: '새 댓글',
      message: `${commenterName}님이 회원님의 게시글에 댓글을 남겼습니다.`,
      data: notificationData
    });
  } catch (error) {
    console.error('게시글 댓글 알림 생성 실패:', error);
    throw error;
  }
}

// 댓글 대댓글 알림
export async function createCommentReplyNotification(
  commentAuthorId: string,
  postId: string,
  postTitle: string,
  parentCommentId: string,
  replierName: string,
  replyContent: string,
  replyId: string
): Promise<void> {
  try {
    // 게시글 정보 조회 (라우팅에 필요한 정보)
    const postDoc = await getDoc(doc(db, 'posts', postId));
    const postData = postDoc.data();

    // 기본 데이터 객체
    const notificationData: any = {
      postId,
      commentId: parentCommentId,
      replyId,
      postTitle,
      authorName: replierName,
      commentContent: replyContent.slice(0, 100), // 처음 100자만
    };

    // 라우팅에 필요한 정보 조건부 추가 (undefined 값 제외)
    if (postData?.type) {
      notificationData.postType = postData.type;
    }
    if (postData?.boardCode) {
      notificationData.boardCode = postData.boardCode;
    }
    if (postData?.schoolId) {
      notificationData.schoolId = postData.schoolId;
    }
    if (postData?.regions) {
      notificationData.regions = postData.regions;
    }

    await createNotification({
      userId: commentAuthorId,
      type: 'comment_reply',
      title: '새 답글',
      message: `${replierName}님이 회원님의 댓글에 답글을 남겼습니다.`,
      data: notificationData
    });
  } catch (error) {
    console.error('댓글 답글 알림 생성 실패:', error);
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

// 알림 삭제
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('알림 삭제 실패:', error);
    throw error;
  }
}

// 여러 알림 삭제
export async function deleteMultipleNotifications(notificationIds: string[]): Promise<void> {
  try {
    const deletePromises = notificationIds.map(id => 
      deleteDoc(doc(db, 'notifications', id))
    );
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('다중 알림 삭제 실패:', error);
    throw error;
  }
}

// 읽지 않은 알림 개수 조회
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('읽지 않은 알림 개수 조회 실패:', error);
    throw error;
  }
} 