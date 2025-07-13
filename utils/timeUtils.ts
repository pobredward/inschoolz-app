import { Timestamp } from 'firebase/firestore';

// ===== 시간 관련 유틸리티 함수들 =====

/**
 * 다양한 형태의 timestamp를 Date 객체로 변환
 * @param timestamp Firebase Timestamp, Date, number, 또는 기타 형태
 * @returns Date 객체
 */
export function toDate(timestamp: unknown): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  if (timestamp && typeof timestamp === 'object') {
    // Firebase Timestamp 객체
    if ('toDate' in timestamp && typeof (timestamp as Timestamp).toDate === 'function') {
      return (timestamp as Timestamp).toDate();
    }
    
    // Firestore Timestamp 직렬화된 형태 (seconds, nanoseconds)
    if ('seconds' in timestamp && 'nanoseconds' in timestamp) {
      const { seconds, nanoseconds } = timestamp as { seconds: number; nanoseconds: number };
      return new Date(seconds * 1000 + nanoseconds / 1000000);
    }
  }
  
  // 기본값: 현재 시간
  return new Date();
}

/**
 * 다양한 형태의 timestamp를 number(milliseconds)로 변환
 * @param timestamp Firebase Timestamp, Date, number, 또는 기타 형태
 * @returns Unix timestamp (milliseconds)
 */
export function toTimestamp(timestamp: unknown): number {
  return toDate(timestamp).getTime();
}

/**
 * 현재 시간을 number(milliseconds)로 반환
 * @returns Unix timestamp (milliseconds)
 */
export function now(): number {
  return Date.now();
}

/**
 * 상대 시간 포맷팅 (예: "3시간 전", "2일 전")
 * @param timestamp 시간 데이터
 * @returns 포맷된 상대 시간 문자열
 */
export function formatRelativeTime(timestamp: unknown): string {
  try {
    const date = toDate(timestamp);
    
    if (isNaN(date.getTime())) {
      return '방금 전';
    }
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInSeconds < 30) {
      return '방금 전';
    } else if (diffInSeconds < 60) {
      return `${diffInSeconds}초 전`;
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`;
    } else if (diffInHours < 24) {
      return `${diffInHours}시간 전`;
    } else if (diffInDays < 7) {
      return `${diffInDays}일 전`;
    } else if (diffInDays < 30) {
      return `${Math.floor(diffInDays / 7)}주 전`;
    } else if (diffInDays < 365) {
      return `${Math.floor(diffInDays / 30)}개월 전`;
    } else {
      return `${Math.floor(diffInDays / 365)}년 전`;
    }
  } catch (error) {
    console.error('시간 포맷팅 오류:', error);
    return '방금 전';
  }
}

/**
 * 스마트 시간 포맷팅 (상황에 따라 상대/절대 시간 자동 선택)
 * @param timestamp 시간 데이터
 * @returns 포맷된 시간 문자열
 */
export function formatSmartTime(timestamp: unknown): string {
  try {
    const date = toDate(timestamp);
    
    if (isNaN(date.getTime())) {
      return '방금 전';
    }
    
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return '방금 전';
    } else if (diffInHours < 24) {
      return `${diffInHours}시간 전`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        month: '2-digit',
        day: '2-digit'
      });
    }
  } catch (error) {
    console.error('스마트 시간 포맷팅 오류:', error);
    return '방금 전';
  }
}

/**
 * 절대 시간 포맷팅 (예: "2024-01-15", "01-15")
 * @param timestamp 시간 데이터
 * @param format 포맷 형태 ('full' | 'short' | 'time')
 * @returns 포맷된 절대 시간 문자열
 */
export function formatAbsoluteTime(timestamp: unknown, format: 'full' | 'short' | 'time' = 'short'): string {
  try {
    const date = toDate(timestamp);
    
    if (isNaN(date.getTime())) {
      return '날짜 오류';
    }
    
    switch (format) {
      case 'full':
        return date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      case 'short':
        return date.toLocaleDateString('ko-KR', {
          month: '2-digit',
          day: '2-digit'
        });
      case 'time':
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      default:
        return date.toLocaleDateString('ko-KR');
    }
  } catch (error) {
    console.error('날짜 포맷팅 오류:', error);
    return '날짜 오류';
  }
}

/**
 * 한국 시간대 기준 날짜 문자열 생성 (YYYY-MM-DD 형태)
 * @param date 날짜 (선택사항, 기본값: 현재 시간)
 * @returns 한국 시간대 기준 날짜 문자열
 */
export function getKoreanDateString(date: Date = new Date()): string {
  // 한국 시간으로 변환 (UTC+9)
  const koreaTimezoneOffset = 9 * 60; // 9시간을 분 단위로
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const koreaMinutes = utcMinutes + koreaTimezoneOffset;
  
  // 한국 날짜 계산
  const koreaDate = new Date(date);
  koreaDate.setUTCHours(0, koreaMinutes, 0, 0);
  
  const year = koreaDate.getUTCFullYear();
  const month = String(koreaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(koreaDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 두 시간의 차이를 계산
 * @param start 시작 시간
 * @param end 종료 시간 (선택사항, 기본값: 현재 시간)
 * @returns 차이 (milliseconds)
 */
export function timeDiff(start: unknown, end: unknown = now()): number {
  return toTimestamp(end) - toTimestamp(start);
}

/**
 * 시간이 오늘인지 확인
 * @param timestamp 확인할 시간
 * @returns 오늘인지 여부
 */
export function isToday(timestamp: unknown): boolean {
  const date = toDate(timestamp);
  const today = new Date();
  
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}

// ===== 기존 함수들 (호환성 유지) =====

/**
 * 기존 formatDate 함수와 호환성을 위한 별칭
 * @deprecated formatSmartTime 사용을 권장합니다
 */
export function formatDate(timestamp: unknown): string {
  return formatSmartTime(timestamp);
} 