import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from './firebase';
import { Report, ReportType, ReportReason, ReportStatus, ReportStats, UserReportRecord } from '../types';
import { createReportReceivedNotification } from './notifications';

// 신고 스팸 방지 검사 (단순화된 버전 - Firebase 인덱스 없이)
export async function checkReportSpam(reporterId: string): Promise<{
  canReport: boolean;
  reason?: string;
  remainingTime?: number;
}> {
  try {
    // 기본적으로 신고 허용
    // 복잡한 스팸 체크는 서버사이드 Cloud Functions에서 처리
    // 중복 신고는 hasUserReported 함수에서 별도 체크
    return { canReport: true };
  } catch (error) {
    console.error('신고 스팸 검사 실패:', error);
    // 에러 발생 시 신고 허용 (안전한 기본값)
    return { canReport: true };
  }
}

// 신고 생성
export async function createReport(data: {
  reason: ReportReason;
  customReason?: string;
  description?: string;
  targetId: string;
  targetType: ReportType;
  targetContent?: string;
  postId?: string; // 댓글 신고 시 필요
  reporterId: string;
  reporterInfo: {
    displayName: string;
    profileImageUrl?: string;
  };
  boardCode?: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}): Promise<Report> {
  try {
    // 신고 스팸 방지 검사
    const spamCheck = await checkReportSpam(data.reporterId);
    if (!spamCheck.canReport) {
      throw new Error(spamCheck.reason || '신고할 수 없습니다.');
    }

    // 신고받은 사용자 ID 찾기
    let targetAuthorId: string | null = null;
    
    if (data.targetType === 'user') {
      targetAuthorId = data.targetId;
    } else if (data.targetType === 'post') {
      // 게시글 신고 시 게시글 작성자 ID 조회
      const postDoc = await getDoc(doc(db, 'posts', data.targetId));
      if (postDoc.exists()) {
        targetAuthorId = postDoc.data()?.authorId;
      }
    } else if (data.targetType === 'comment') {
      // 댓글 신고 시 댓글 작성자 ID 조회
      if (data.postId) {
        const commentDoc = await getDoc(doc(db, 'posts', data.postId, 'comments', data.targetId));
        if (commentDoc.exists()) {
          targetAuthorId = commentDoc.data()?.authorId;
        }
      }
    }

    // undefined 값들을 제거한 reportData 생성
    const reportData: Omit<Report, 'id'> = {
      reason: data.reason,
      targetId: data.targetId,
      targetType: data.targetType,
      reporterId: data.reporterId,
      reporterInfo: data.reporterInfo,
      status: 'pending',
      createdAt: Date.now(),
      // 조건부로 필드 추가 (undefined 값 제외)
      ...(data.customReason && { customReason: data.customReason }),
      ...(data.description && { description: data.description }),
      ...(data.targetContent && { targetContent: data.targetContent }),
      ...(targetAuthorId && { targetAuthorId }),
      ...(data.postId && { postId: data.postId }),
      ...(data.boardCode && { boardCode: data.boardCode }),
      ...(data.schoolId && { schoolId: data.schoolId }),
      ...(data.regions && { regions: data.regions }),
    };

    const docRef = await addDoc(collection(db, 'reports'), reportData);
    
    const report = {
      id: docRef.id,
      ...reportData,
    };

    // 신고당한 사용자에게 알림 전송
    try {
      // 자기 자신을 신고한 경우는 알림 전송하지 않음
      if (targetAuthorId && targetAuthorId !== data.reporterId) {
        await createReportReceivedNotification(
          targetAuthorId,
          docRef.id,
          data.reporterInfo.displayName,
          data.targetType
        );
      }
    } catch (notificationError) {
      console.error('신고 알림 전송 실패:', notificationError);
      // 알림 전송 실패는 신고 생성 자체를 실패시키지 않음
    }
    
    return report;
  } catch (error) {
    console.error('신고 생성 실패:', error);
    throw error;
  }
}

// 신고 조회 (단일)
export async function getReport(reportId: string): Promise<Report | null> {
  try {
    const docRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Report;
    }
    
    return null;
  } catch (error) {
    console.error('신고 조회 실패:', error);
    throw error;
  }
}

// 사용자의 신고 내역 조회
export async function getUserReports(userId: string): Promise<UserReportRecord> {
  try {
    // 내가 신고한 내역
    const reportsMadeQuery = query(
      collection(db, 'reports'),
      where('reporterId', '==', userId)
    );
    const reportsMadeSnap = await getDocs(reportsMadeQuery);
    const reportsMade = reportsMadeSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];
    
    // 클라이언트에서 정렬
    reportsMade.sort((a, b) => b.createdAt - a.createdAt);

    // 나를 신고한 내역 - targetAuthorId 필드 사용
    const reportsReceivedQuery = query(
      collection(db, 'reports'),
      where('targetAuthorId', '==', userId)
    );
    const reportsReceivedSnap = await getDocs(reportsReceivedQuery);
    const reportsReceived = reportsReceivedSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Report[];

    // 정렬
    reportsReceived.sort((a, b) => b.createdAt - a.createdAt);

    // 통계 계산
    const stats = {
      totalReportsMade: reportsMade.length,
      totalReportsReceived: reportsReceived.length,
      warningsReceived: reportsReceived.filter(r => r.status === 'resolved' && r.actionTaken?.includes('경고')).length,
      suspensionsReceived: reportsReceived.filter(r => r.status === 'resolved' && r.actionTaken?.includes('정지')).length,
    };

    return {
      reportsMade,
      reportsReceived,
      stats,
    };
  } catch (error) {
    console.error('사용자 신고 내역 조회 실패:', error);
    throw error;
  }
}

// 신고 수정 (사용자가 자신의 신고를 수정)
export async function updateReport(reportId: string, data: {
  reason?: ReportReason;
  customReason?: string;
  description?: string;
}): Promise<void> {
  try {
    const docRef = doc(db, 'reports', reportId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('신고 수정 실패:', error);
    throw error;
  }
}

// 신고 취소 (사용자가 자신의 신고를 삭제)
export async function cancelReport(reportId: string): Promise<void> {
  try {
    const docRef = doc(db, 'reports', reportId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('신고 취소 실패:', error);
    throw error;
  }
}

// 사용자가 이미 신고했는지 확인
export async function hasUserReported(
  reporterId: string,
  targetId: string,
  targetType: ReportType
): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'reports'),
      where('reporterId', '==', reporterId),
      where('targetId', '==', targetId),
      where('targetType', '==', targetType),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('중복 신고 확인 실패:', error);
    throw error;
  }
} 