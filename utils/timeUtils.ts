// React Native 환경에서 사용할 시간 관련 유틸리티 함수들
import { Timestamp } from 'firebase/firestore';

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
  // 현재 UTC 시간 가져오기
  const now = date;
  
  // 한국 시간으로 변환 (UTC+9)
  const koreaTimezoneOffset = 9 * 60; // 9시간을 분 단위로
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const koreaMinutes = utcMinutes + koreaTimezoneOffset;
  
  // 한국 시간 계산
  const koreaDate = new Date(now);
  koreaDate.setUTCHours(Math.floor(koreaMinutes / 60));
  koreaDate.setUTCMinutes(koreaMinutes % 60);
  
  // 날짜 부분만 추출
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
 * @param timestamp 시간 데이터 (Timestamp, number, string, Date 등)
 * @returns Date 객체
 */
export function toDate(timestamp: unknown): Date {
  // Date 객체인 경우
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // number 타입인 경우 (Unix timestamp)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  // string 타입인 경우
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Firebase Timestamp 객체인 경우
  if (timestamp && typeof timestamp === 'object') {
    // Timestamp 객체의 toDate 메소드 사용
    if ('toDate' in timestamp && typeof (timestamp as Timestamp).toDate === 'function') {
      return (timestamp as Timestamp).toDate();
    }
    
    // Firestore에서 직렬화된 Timestamp 형태 (seconds, nanoseconds)
    if ('seconds' in timestamp && typeof (timestamp as any).seconds === 'number') {
      const { seconds, nanoseconds = 0 } = timestamp as { seconds: number; nanoseconds?: number };
      return new Date(seconds * 1000 + nanoseconds / 1000000);
    }
    
    // serverTimestamp() 후 아직 서버에서 처리되지 않은 경우 (null)
    if (timestamp === null) {
      console.warn('serverTimestamp()가 아직 처리되지 않았습니다. 현재 시간을 사용합니다.');
      return new Date();
    }
  }
  
  console.warn('알 수 없는 timestamp 형태:', timestamp, typeof timestamp);
  return new Date();
}

/**
 * 다양한 형태의 timestamp를 number(milliseconds)로 변환
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
 * 절대 시간 포맷팅 (예: "2024-01-15", "2024-01-15 14:30")
 * @param timestamp 시간 데이터
 * @param format 'short' | 'long' | 'datetime'
 * @returns 포맷된 절대 시간 문자열
 */
export function formatAbsoluteTime(timestamp: unknown, format: 'short' | 'long' | 'datetime' = 'short'): string {
  try {
    const date = toDate(timestamp);
    
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    switch (format) {
      case 'short':
        return `${year}-${month}-${day}`;
      case 'long':
        return date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
      case 'datetime':
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}.${month}.${day} ${hour}:${minute}`;
      default:
        return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.error('절대 시간 포맷팅 오류:', error);
    return '-';
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

/**
 * 두 시간이 같은 날인지 확인
 * @param timestamp1 첫 번째 시간
 * @param timestamp2 두 번째 시간
 * @returns 같은 날인지 여부
 */
export function isSameDay(timestamp1: unknown, timestamp2: unknown): boolean {
  try {
    const date1 = toDate(timestamp1);
    const date2 = toDate(timestamp2);
    
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  } catch (error) {
    return false;
  }
}

/**
 * 게시글에서 이미지 URL들을 추출하는 함수 (content와 attachments 모두 고려)
 * @param post 게시글 객체
 * @param maxImages 최대 이미지 개수 (기본값: 10)
 * @returns 이미지 URL 배열
 */
export function extractPostImageUrls(
  post: { 
    content: string; 
    attachments?: Array<{ type: string; url: string }> 
  }, 
  maxImages: number = 10
): string[] {
  const imageUrls: string[] = [];
  
  // 1. attachments에서 이미지 타입만 추출
  if (post.attachments && Array.isArray(post.attachments)) {
    const attachmentImages = post.attachments
      .filter(attachment => attachment.type === 'image')
      .map(attachment => attachment.url);
    imageUrls.push(...attachmentImages);
  }
  
  // 2. content에서 이미지 URL 추출 (HTML img 태그, 마크다운 이미지 등)
  if (post.content) {
    const contentImages = extractImageUrlsFromContent(post.content);
    // attachments에 이미 있는 이미지는 제외 (중복 방지)
    const newContentImages = contentImages.filter(url => !imageUrls.includes(url));
    imageUrls.push(...newContentImages);
  }
  
  // 중복 제거 및 최대 개수 제한
  const uniqueImages = [...new Set(imageUrls)];
  return uniqueImages.slice(0, maxImages);
}

/**
 * 텍스트 내용에서 이미지 URL을 추출하는 함수
 * @param content 텍스트 내용
 * @returns 이미지 URL 배열
 */
function extractImageUrlsFromContent(content: string): string[] {
  const imageUrls: string[] = [];
  
  if (!content) return imageUrls;
  
  // HTML img 태그에서 src 추출
  const imgTagRegex = /<img[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgTagRegex.exec(content)) !== null) {
    imageUrls.push(match[1]);
  }
  
  // 마크다운 이미지 문법 ![alt](url) 추출
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = markdownImageRegex.exec(content)) !== null) {
    imageUrls.push(match[2]);
  }
  
  // 직접 이미지 URL (http/https로 시작하고 이미지 확장자로 끝남)
  const directImageRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)(\?[^\s]*)?/gi;
  while ((match = directImageRegex.exec(content)) !== null) {
    imageUrls.push(match[0]);
  }
  
  return imageUrls;
}

/**
 * 게시글 리스트용 이미지 미리보기 URL 추출 (최대 2개)
 * @param post 게시글 객체
 * @returns 이미지 URL 배열 (최대 2개)
 */
export function getPostPreviewImages(
  post: { 
    content: string; 
    attachments?: Array<{ type: string; url: string }> 
  }
): string[] {
  return extractPostImageUrls(post, 2);
}

 