/**
 * HTML 태그를 제거하고 순수 텍스트만 반환하는 함수 (앱용)
 * @param html HTML 문자열 또는 일반 텍스트
 * @returns 순수 텍스트
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  // <br>, <p> 태그를 줄바꿈으로 변환
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '');
  
  // 다른 HTML 태그 제거
  text = text.replace(/<[^>]*>/g, '');
  
  // HTML 엔티티 디코딩
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // 연속된 줄바꿈을 최대 2개로 제한하고 앞뒤 공백 제거
  text = text
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  return text;
}

/**
 * JSON 형태의 content를 파싱하여 텍스트를 추출하는 함수 (앱용)
 * @param content JSON 문자열 또는 일반 텍스트
 * @returns 추출된 텍스트
 */
export function parseContentText(content: string): string {
  if (!content) return '';
  
  try {
    // JSON 형태인지 확인
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      const parsed = JSON.parse(content);
      
      // TipTap JSON 형태인 경우
      if (parsed.type === 'doc' && parsed.content) {
        return extractTextFromTipTapJson(parsed);
      }
      
      // 다른 JSON 형태인 경우
      return JSON.stringify(parsed);
    }
    
    // HTML 태그가 포함된 경우
    if (content.includes('<') && content.includes('>')) {
      return stripHtmlTags(content);
    }
    
    // 일반 텍스트인 경우 (줄바꿈 보존)
    return content;
  } catch {
    // JSON 파싱 실패 시 HTML 태그 제거 시도
    return stripHtmlTags(content);
  }
}

/**
 * TipTap JSON에서 텍스트를 추출하는 함수 (앱용)
 * @param node TipTap JSON 노드
 * @returns 추출된 텍스트
 */
function extractTextFromTipTapJson(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  
  const nodeObj = node as Record<string, unknown>;
  let text = '';
  
  // 텍스트 노드인 경우
  if (nodeObj.type === 'text') {
    return (nodeObj.text as string) || '';
  }
  
  // 하드 브레이크인 경우
  if (nodeObj.type === 'hardBreak') {
    return '\n';
  }
  
  // 자식 노드들을 재귀적으로 처리
  if (nodeObj.content && Array.isArray(nodeObj.content)) {
    for (const child of nodeObj.content) {
      text += extractTextFromTipTapJson(child);
    }
  }
  
  // 단락 노드인 경우 뒤에 줄바꿈 추가
  if (nodeObj.type === 'paragraph' && text) {
    text += '\n';
  }
  
  return text;
}

/**
 * 텍스트를 지정된 길이로 자르고 말줄임표를 추가하는 함수
 * @param text 원본 텍스트
 * @param maxLength 최대 길이 (기본값: 100)
 * @returns 잘린 텍스트
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return '';
  
  // 먼저 HTML 태그 제거 및 텍스트 파싱
  const cleanText = parseContentText(text);
  
  if (cleanText.length <= maxLength) {
    return cleanText;
  }
  
  return cleanText.substring(0, maxLength) + '...';
}

/**
 * 텍스트에서 첫 번째 이미지 URL을 추출하는 함수
 * @param content 콘텐츠 텍스트
 * @returns 첫 번째 이미지 URL 또는 null
 */
export function extractFirstImageUrl(content: string): string | null {
  if (!content) return null;
  
  // HTML img 태그에서 src 추출
  const imgTagMatch = content.match(/<img[^>]+src="([^"]+)"/i);
  if (imgTagMatch) {
    return imgTagMatch[1];
  }
  
  // 마크다운 이미지 형태 ![alt](url) 추출
  const markdownImgMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (markdownImgMatch) {
    return markdownImgMatch[1];
  }
  
  // URL 형태의 이미지 링크 추출
  const urlMatch = content.match(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  return null;
}

/**
 * 텍스트에서 모든 이미지 URL을 추출하는 함수
 * @param content 콘텐츠 텍스트
 * @returns 이미지 URL 배열
 */
export function extractAllImageUrls(content: string): string[] {
  if (!content) return [];
  
  const imageUrls: string[] = [];
  
  // HTML img 태그에서 src 추출
  const imgTagMatches = content.matchAll(/<img[^>]+src="([^"]+)"/gi);
  for (const match of imgTagMatches) {
    imageUrls.push(match[1]);
  }
  
  // 마크다운 이미지 형태 ![alt](url) 추출
  const markdownImgMatches = content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of markdownImgMatches) {
    imageUrls.push(match[1]);
  }
  
  // URL 형태의 이미지 링크 추출
  const urlMatches = content.matchAll(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi);
  for (const match of urlMatches) {
    imageUrls.push(match[1]);
  }
  
  // 중복 제거
  return [...new Set(imageUrls)];
}

/**
 * 텍스트에서 해시태그를 추출하는 함수
 * @param text 원본 텍스트
 * @returns 해시태그 배열
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  
  const hashtagRegex = /#[가-힣a-zA-Z0-9_]+/g;
  const matches = text.match(hashtagRegex);
  
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

/**
 * 텍스트에서 멘션(@사용자명)을 추출하는 함수
 * @param text 원본 텍스트
 * @returns 멘션 배열
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  
  const mentionRegex = /@[가-힣a-zA-Z0-9_]+/g;
  const matches = text.match(mentionRegex);
  
  return matches ? matches.map(mention => mention.substring(1)) : [];
} 