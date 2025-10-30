/**
 * 네트워크 요청 유틸리티
 * 재시도 로직 및 타임아웃 처리
 */

import { logger } from './logger';

export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  timeoutMs?: number;
  retryDelay?: number;
}

/**
 * 재시도 로직이 포함된 fetch 함수
 * @param url 요청 URL
 * @param options 요청 옵션 (maxRetries, timeoutMs 포함)
 * @returns Response 객체
 */
export const fetchWithRetry = async (
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> => {
  const {
    maxRetries = 3,
    timeoutMs = 10000,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.debug(`네트워크 요청 시도 ${attempt + 1}/${maxRetries}:`, url);

      // AbortController로 타임아웃 구현
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        logger.warn(`요청 타임아웃 (${timeoutMs}ms):`, url);
      }, timeoutMs);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 성공 응답
      if (response.ok) {
        logger.debug('요청 성공:', url, response.status);
        return response;
      }

      // 4xx 클라이언트 에러는 재시도하지 않음
      if (response.status >= 400 && response.status < 500) {
        logger.error('클라이언트 에러 (재시도 안 함):', response.status);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 5xx 서버 에러는 재시도
      if (response.status >= 500) {
        throw new Error(`서버 에러: HTTP ${response.status}`);
      }

      return response;

    } catch (error) {
      lastError = error as Error;

      // 마지막 시도인 경우 에러 throw
      if (attempt === maxRetries - 1) {
        logger.error('최대 재시도 횟수 초과:', url, lastError);
        throw lastError;
      }

      // 재시도 대기 (지수 백오프)
      const delay = retryDelay * Math.pow(2, attempt);
      logger.warn(
        `재시도 대기 ${attempt + 1}/${maxRetries - 1} (${delay}ms):`,
        lastError.message
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // 여기 도달하면 안 되지만, 안전장치
  throw lastError || new Error('알 수 없는 네트워크 오류');
};

/**
 * JSON 응답을 파싱하는 헬퍼 함수
 */
export const fetchJsonWithRetry = async <T = any>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> => {
  const response = await fetchWithRetry(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data as T;
};

/**
 * 네트워크 연결 상태 확인
 */
export const checkNetworkConnection = (): boolean => {
  // React Native에서는 NetInfo 사용 권장
  // 웹 환경에서는 navigator.onLine 사용
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true; // 기본값은 연결됨으로 가정
};

