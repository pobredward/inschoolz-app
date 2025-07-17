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
  getDoc,
  startAt,
  endAt
} from 'firebase/firestore';
import { db } from './firebase';
import { Notification, NotificationType } from '../types';

// 알림 생성
export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}): Promise<Notification> {
  try {
    console.log('createNotification 호출됨:', data);
    
    const notificationData: Omit<Notification, 'id'> = {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: false,
      createdAt: Date.now(),
    };

    // data 필드가 유효할 때만 추가 (undefined 방지)
    if (data.data && Object.keys(data.data).length > 0) {
      // undefined 값들을 필터링
      const filteredData = Object.fromEntries(
        Object.entries(data.data).filter(([_, value]) => value !== undefined)
      );
      
      console.log('data 필터링 결과:', { original: data.data, filtered: filteredData });
      
      if (Object.keys(filteredData).length > 0) {
        notificationData.data = filteredData;
      }
    }

    console.log('Firestore에 저장할 알림 데이터:', notificationData);

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    
    console.log('알림 생성 성공:', docRef.id);
    
    return {
      id: docRef.id,
      ...notificationData,
    };
  } catch (error) {
    console.error('알림 생성 실패:', error);
    console.error('입력 데이터:', data);
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

// 추천인 설정 알림 (추천인에게 보내는 알림)
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

// 추천인 등록 성공 알림 (추천받은 사용자에게 보내는 알림)
export async function createReferralSuccessNotification(
  newUserId: string,
  referredUserName: string,
  referredUserId: string,
  expGained?: number
): Promise<void> {
  try {
    const expText = expGained ? ` ${expGained} 경험치를 받았습니다!` : '!';
    
    await createNotification({
      userId: newUserId,
      type: 'referral',
      title: '추천인 등록 완료',
      message: `${referredUserName}님을 추천인으로 성공적으로 등록했습니다${expText}`,
      data: {
        referrerName: referredUserName,
        targetUserId: referredUserId,
        expGained: expGained || 0
      }
    });
  } catch (error) {
    console.error('추천인 등록 성공 알림 생성 실패:', error);
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

// 사용자 검색 함수
export async function searchUsers(query: string): Promise<Array<{
  id: string;
  realName: string;
  userName: string;
  schoolName?: string;
}>> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const users = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          realName: data.profile?.realName || '',
          userName: data.profile?.userName || '',
          schoolName: data.school?.name || ''
        };
      })
      .filter(user => 
        user.realName.toLowerCase().includes(query.toLowerCase()) ||
        user.userName.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 50); // 최대 50명까지만 반환
    
    return users;
  } catch (error) {
    console.error('사용자 검색 오류:', error);
    return [];
  }
}

// 학교 검색 함수 (Firebase 쿼리 최적화)
export async function searchSchools(searchQuery: string): Promise<Array<{
  id: string;
  name: string;
  address?: string;
  type?: string;
}>> {
  try {
    // 최소 2글자 이상 입력해야 검색
    if (searchQuery.length < 2) {
      return [];
    }

    const queryTrimmed = searchQuery.trim();
    
    // Firebase 쿼리로 앞글자 기반 검색 (startAt ~ endAt 사용)
    const schoolsRef = collection(db, 'schools');
    
    // 정확한 앞글자 매칭을 위한 쿼리
    const exactStartQuery = query(
      schoolsRef,
      where('KOR_NAME', '>=', queryTrimmed),
      where('KOR_NAME', '<=', queryTrimmed + '\uf8ff'),
      orderBy('KOR_NAME'),
      limit(20)
    );
    
    // 대소문자 구분 없는 검색을 위한 추가 쿼리 (소문자)
    const lowerCaseQuery = query(
      schoolsRef,
      where('KOR_NAME', '>=', queryTrimmed.toLowerCase()),
      where('KOR_NAME', '<=', queryTrimmed.toLowerCase() + '\uf8ff'),
      orderBy('KOR_NAME'),
      limit(20)
    );
    
    // 두 쿼리 실행
    const [exactSnapshot, lowerSnapshot] = await Promise.all([
      getDocs(exactStartQuery),
      getDocs(lowerCaseQuery)
    ]);
    
    // 결과 합치기 및 중복 제거
    const schoolsMap = new Map<string, {
      id: string;
      name: string;
      address?: string;
      type?: string;
    }>();
    
    // 정확한 매칭 결과 추가
    exactSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const schoolName = data.KOR_NAME || data.name || '';
      
      if (schoolName.toLowerCase().startsWith(queryTrimmed.toLowerCase())) {
        schoolsMap.set(doc.id, {
          id: doc.id,
          name: schoolName,
          address: data.ADDR || data.address || '',
          type: data.SCHUL_KND_SC_NM || data.type || ''
        });
      }
    });
    
    // 소문자 매칭 결과 추가
    lowerSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const schoolName = data.KOR_NAME || data.name || '';
      
      if (schoolName.toLowerCase().startsWith(queryTrimmed.toLowerCase()) && !schoolsMap.has(doc.id)) {
        schoolsMap.set(doc.id, {
          id: doc.id,
          name: schoolName,
          address: data.ADDR || data.address || '',
          type: data.SCHUL_KND_SC_NM || data.type || ''
        });
      }
    });
    
    // 결과를 배열로 변환하고 정렬
    const schools = Array.from(schoolsMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30); // 최대 30개
    
    return schools;
  } catch (error) {
    console.error('학교 검색 오류:', error);
    return [];
  }
}

// 관리자 전체 알림 발송
export async function sendBroadcastNotification(data: {
  type: NotificationType;
  title: string;
  message: string;
  targetType?: 'all' | 'students' | 'admins' | 'specific_users' | 'specific_school';
  targetUserIds?: string[];
  targetSchoolId?: string;
  data?: {
    [key: string]: unknown;
  };
}): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  try {
    console.log('알림 발송 시작:', data);
    
    // 모든 사용자 조회
    const usersQuery = collection(db, 'users');
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log(`총 ${usersSnapshot.docs.length}명의 사용자를 찾았습니다.`);
    
    const results = {
      success: true,
      sentCount: 0,
      errors: [] as string[]
    };

    // 사용자 필터링
    const targetUsers = [];
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // 사용자 데이터 유효성 검사
      if (!userData) {
        results.errors.push(`사용자 ${userId}: 사용자 데이터가 없습니다`);
        continue;
      }
      
      // 대상 타입별 필터링
      switch (data.targetType) {
        case 'students':
          if (userData.role === 'admin') continue;
          break;
        case 'admins':
          if (userData.role !== 'admin') continue;
          break;
        case 'specific_users':
          if (!data.targetUserIds?.includes(userId)) continue;
          break;
        case 'specific_school':
          if (!data.targetSchoolId) continue;
          const favoriteSchools = userData.favorites?.schools || [];
          if (!favoriteSchools.includes(data.targetSchoolId)) continue;
          break;
        case 'all':
        default:
          // 모든 사용자 포함
          break;
      }
      
      targetUsers.push({ userId, userData });
    }
    
    console.log(`필터링 후 ${targetUsers.length}명의 대상 사용자`);
    
    // 배치로 처리 (10명씩)
    const batchSize = 10;
    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);
      const batchPromises = [];
      
      for (const { userId, userData } of batch) {
        try {
          const notificationData: Omit<Notification, 'id'> = {
            userId: userId,
            type: data.type,
            title: data.title,
            message: data.message,
            data: data.data || {},
            isRead: false,
            createdAt: Date.now(),
          };

          batchPromises.push(
            addDoc(collection(db, 'notifications'), notificationData)
              .then(() => ({ success: true, userId }))
              .catch((error) => ({ success: false, userId, error }))
          );
        } catch (error) {
          results.errors.push(`사용자 ${userId} 준비 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }
      
      // 배치 실행
      if (batchPromises.length > 0) {
        try {
          const batchResults = await Promise.allSettled(batchPromises);
          
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              const batchResult = result.value;
              if (batchResult.success) {
                results.sentCount++;
              } else {
                const error = 'error' in batchResult ? batchResult.error : '알 수 없는 오류';
                results.errors.push(`사용자 ${batchResult.userId}: ${error instanceof Error ? error.message : error}`);
              }
            } else {
              results.errors.push(`배치 처리 실패: ${result.reason}`);
            }
          }
        } catch (error) {
          results.errors.push(`배치 ${i / batchSize + 1} 실행 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }
      
      // 배치 간 딜레이 (500ms)
      if (i + batchSize < targetUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`알림 발송 완료: 성공 ${results.sentCount}명, 실패 ${results.errors.length}건`);
    
    if (results.errors.length > 0) {
      console.error('발송 실패 상세:', results.errors);
      results.success = false;
    }
    
    return results;
  } catch (error) {
    console.error('전체 알림 발송 실패:', error);
    throw error;
  }
} 