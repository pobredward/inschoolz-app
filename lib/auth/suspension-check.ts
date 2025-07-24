import { User, FirebaseTimestamp } from '@/types';

export interface SuspensionStatus {
  isSuspended: boolean;
  isPermanent: boolean;
  suspendedUntil?: Date;
  reason?: string;
  remainingDays?: number;
}

/**
 * Firebase Timestamp를 Date로 변환
 */
const toDate = (timestamp: unknown): Date => {
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (typeof timestamp === 'number') return new Date(timestamp);
  
  // Firebase Timestamp 객체인 경우
  if (timestamp && typeof timestamp === 'object') {
    const ts = timestamp as Record<string, unknown>;
    if (typeof ts.toDate === 'function') {
      return ts.toDate() as Date;
    }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000);
    }
  }
  
  throw new Error('유효하지 않은 timestamp 형식');
};

/**
 * 사용자의 정지 상태를 확인합니다
 */
export const checkSuspensionStatus = (user: User): SuspensionStatus => {
  // User 타입을 확장하여 status 필드 접근
  const userWithStatus = user as User & { status?: string };
  
  if (!user || userWithStatus.status !== 'suspended') {
    return { isSuspended: false, isPermanent: false };
  }

  const suspensionReason = (user as unknown as Record<string, unknown>).suspensionReason as string;
  const suspendedUntil = (user as unknown as Record<string, unknown>).suspendedUntil;
  
  // 영구 정지인 경우
  if (!suspendedUntil) {
    return {
      isSuspended: true,
      isPermanent: true,
      reason: suspensionReason
    };
  }

  // 임시 정지인 경우
  try {
    const suspendedUntilDate = toDate(suspendedUntil);
    const now = new Date();
    
    // 정지 기간이 만료된 경우
    if (suspendedUntilDate <= now) {
      return { isSuspended: false, isPermanent: false };
    }
    
    // 아직 정지 기간인 경우
    const remainingTime = suspendedUntilDate.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
    
    return {
      isSuspended: true,
      isPermanent: false,
      suspendedUntil: suspendedUntilDate,
      reason: suspensionReason,
      remainingDays
    };
  } catch (error) {
    console.error('정지 상태 확인 오류:', error);
    // 오류 발생 시 안전을 위해 정지된 것으로 처리
    return {
      isSuspended: true,
      isPermanent: true,
      reason: suspensionReason
    };
  }
};

/**
 * 정지된 사용자의 허용된 액션 목록
 */
export const getAllowedActionsForSuspended = () => {
  return [
    'view_suspension_notice',    // 정지 안내 확인
    'contact_support',          // 고객지원 문의
    'logout',                   // 로그아웃
    'view_profile_basic'        // 기본 프로필 조회 (정지 정보 확인용)
  ];
};

/**
 * 정지된 사용자의 금지된 액션 목록
 */
export const getRestrictedActionsForSuspended = () => {
  return [
    // 커뮤니티 관련
    'create_post',              // 게시글 작성
    'create_comment',           // 댓글 작성
    'like_post',               // 좋아요
    'report_content',          // 신고
    'join_community',          // 커뮤니티 가입
    
    // 게임 관련
    'play_games',              // 게임 플레이
    'submit_score',            // 점수 제출
    
    // 소셜 관련
    'follow_user',             // 팔로우
    'send_message',            // 메시지 발송
    'create_friendship',       // 친구 요청
    
    // 프로필 관련
    'update_profile',          // 프로필 수정
    'upload_image',            // 이미지 업로드
    
    // 기타
    'earn_experience',         // 경험치 획득
    'daily_attendance',        // 출석 체크
    'use_features'             // 대부분의 기능 사용
  ];
};

/**
 * 특정 액션이 정지된 사용자에게 허용되는지 확인
 */
export const isActionAllowedForSuspended = (action: string): boolean => {
  return getAllowedActionsForSuspended().includes(action);
};

/**
 * 정지 안내 메시지 생성
 */
export const generateSuspensionMessage = (suspensionStatus: SuspensionStatus): string => {
  if (!suspensionStatus.isSuspended) {
    return '';
  }

  if (suspensionStatus.isPermanent) {
    return `계정이 영구 정지되었습니다.\n사유: ${suspensionStatus.reason || '정책 위반'}\n\n문의사항이 있으시면 고객지원팀에 연락해주세요.`;
  }

  const until = suspensionStatus.suspendedUntil?.toLocaleDateString('ko-KR');
  const days = suspensionStatus.remainingDays;
  
  return `계정이 임시 정지되었습니다.\n정지 해제일: ${until}\n남은 기간: ${days}일\n사유: ${suspensionStatus.reason || '정책 위반'}\n\n정지 기간 동안 대부분의 서비스 이용이 제한됩니다.`;
}; 