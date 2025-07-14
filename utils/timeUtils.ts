// React Native 환경에서 사용할 시간 관련 유틸리티 함수들

/**
 * 현재 시간을 number(milliseconds)로 반환
 * @returns Unix timestamp (milliseconds)
 */
export function now(): number {
  return Date.now();
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
  
  // 날짜가 바뀌었는지 확인하고 조정
  if (koreaMinutes >= 24 * 60) {
    koreaDate.setUTCDate(koreaDate.getUTCDate() + 1);
  } else if (koreaMinutes < 0) {
    koreaDate.setUTCDate(koreaDate.getUTCDate() - 1);
  }
  
  const year = koreaDate.getUTCFullYear();
  const month = String(koreaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(koreaDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 시간 차이 계산 (milliseconds)
 * @param start 시작 시간
 * @param end 종료 시간 (기본값: 현재 시간)
 * @returns 시간 차이 (milliseconds)
 */
export function timeDiff(start: unknown, end: unknown = now()): number {
  const startTime = toTimestamp(start);
  const endTime = toTimestamp(end);
  return endTime - startTime;
}

/**
 * 오늘 날짜인지 확인
 * @param timestamp 확인할 시간 데이터
 * @returns 오늘 날짜 여부
 */
export function isToday(timestamp: unknown): boolean {
  try {
    const date = toDate(timestamp);
    const today = new Date();
    
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  } catch (error) {
    return false;
  }
}

/**
 * 다양한 형태의 timestamp를 Date 객체로 변환
 * @param timestamp 시간 데이터
 * @returns Date 객체
 */
export function toDate(timestamp: unknown): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Firebase Timestamp 타입 처리
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as any).toDate();
  }
  
  // Firebase Timestamp의 seconds, nanoseconds 처리
  if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
    const seconds = (timestamp as any).seconds;
    const nanoseconds = (timestamp as any).nanoseconds || 0;
    return new Date(seconds * 1000 + nanoseconds / 1000000);
  }
  
  console.warn('알 수 없는 timestamp 형태:', timestamp);
  return new Date();
}

/**
 * 시간 데이터를 timestamp(milliseconds)로 변환
 * @param timestamp 시간 데이터
 * @returns Unix timestamp (milliseconds)
 */
export function toTimestamp(timestamp: unknown): number {
  return toDate(timestamp).getTime();
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
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}분 전`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    } else if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    } else {
      return formatAbsoluteTime(timestamp, 'short');
    }
  } catch (error) {
    console.error('시간 포맷팅 오류:', error);
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
      return formatAbsoluteTime(timestamp, 'short');
    }
  } catch (error) {
    console.error('스마트 시간 포맷팅 오류:', error);
    return '방금 전';
  }
} 