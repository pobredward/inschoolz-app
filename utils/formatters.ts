/**
 * 휴대폰 번호 포맷팅 함수
 * @param value 입력된 휴대폰 번호 (숫자만 또는 하이픈 포함)
 * @returns 포맷팅된 휴대폰 번호 (010-1234-5678 형식)
 */
export const formatPhoneNumber = (value: string): string => {
  if (!value) return '미설정';
  const numbers = value.replace(/\D/g, ''); // 숫자만 추출
  
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return numbers.replace(/(\d{3})(\d{1,4})/, '$1-$2');
  } else {
    return numbers.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
  }
};

/**
 * 입력용 휴대폰 번호 포맷팅 함수 (빈 값일 때 빈 문자열 반환)
 * @param value 입력된 휴대폰 번호
 * @returns 포맷팅된 휴대폰 번호 또는 빈 문자열
 */
export const formatPhoneNumberForInput = (value: string): string => {
  if (!value) return '';
  const numbers = value.replace(/\D/g, ''); // 숫자만 추출
  
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return numbers.replace(/(\d{3})(\d{1,4})/, '$1-$2');
  } else {
    return numbers.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
  }
};

/**
 * 휴대폰 번호에서 숫자만 추출하는 함수
 * @param value 포맷팅된 휴대폰 번호
 * @returns 숫자만 포함된 문자열
 */
export const extractPhoneNumbers = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * 생년월일 월/일에 앞자리 0 패딩
 * @param value 입력된 월 또는 일
 * @returns 2자리로 패딩된 문자열 (01, 02, ... 12)
 */
export const padBirthValue = (value: string | number): string => {
  if (!value) return '';
  return String(value).padStart(2, '0');
};

/**
 * 숫자만 허용하는 입력 필터
 * @param value 입력된 문자열
 * @returns 숫자만 포함된 문자열
 */
export const filterNumericOnly = (value: string): string => {
  return value.replace(/[^0-9]/g, '');
}; 