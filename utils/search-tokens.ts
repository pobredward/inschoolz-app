/**
 * 닉네임용 검색 토큰 생성 함수 (한글 지원)
 */
export function generateNicknameTokens(nickname: string): string[] {
  if (!nickname) return [];
  
  const tokens = new Set<string>();
  const cleanText = nickname.toLowerCase().trim();
  
  // 전체 닉네임
  tokens.add(cleanText);
  
  // 모든 부분 문자열 생성 (1글자부터 전체까지)
  for (let i = 0; i < cleanText.length; i++) {
    for (let j = i + 1; j <= cleanText.length; j++) {
      const substring = cleanText.substring(i, j);
      if (substring.length >= 1 && substring.length <= 8) { // 1-8글자만
        tokens.add(substring);
      }
    }
  }
  
  return Array.from(tokens);
}

/**
 * 학교명용 검색 토큰 생성 함수 (효율적인 부분 매칭)
 */
export function generateSchoolTokens(schoolName: string): string[] {
  if (!schoolName) return [];
  
  const tokens = new Set<string>();
  const cleanText = schoolName.toLowerCase().trim();
  
  // 전체 학교명
  tokens.add(cleanText);
  
  // 의미있는 부분 문자열만 생성 (2글자 이상, 연속된 부분)
  for (let i = 0; i < cleanText.length; i++) {
    for (let j = i + 2; j <= Math.min(i + 5, cleanText.length); j++) { // 2-4글자만
      const substring = cleanText.substring(i, j);
      tokens.add(substring);
    }
  }
  
  return Array.from(tokens);
}

/**
 * 사용자의 검색 토큰 생성 (닉네임 + 실명 + 학교명)
 */
export function generateUserSearchTokens(
  nickname?: string,
  realName?: string,
  schoolName?: string
): string[] {
  const allTokens = new Set<string>();
  
  // nickname 토큰 (전체 부분 문자열)
  if (nickname) {
    const nicknameTokens = generateNicknameTokens(nickname);
    nicknameTokens.forEach(token => allTokens.add(token));
  }
  
  // realName 토큰 (닉네임과 동일한 방식)
  if (realName) {
    const realNameTokens = generateNicknameTokens(realName);
    realNameTokens.forEach(token => allTokens.add(token));
  }
  
  // schoolName 토큰 (효율적인 부분 문자열만)
  if (schoolName) {
    const schoolTokens = generateSchoolTokens(schoolName);
    schoolTokens.forEach(token => allTokens.add(token));
  }
  
  // 토큰 배열로 변환 (최대 50개로 제한)
  return Array.from(allTokens).slice(0, 50);
}
