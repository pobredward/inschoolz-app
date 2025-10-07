/**
 * 푸시 알림 메시지 템플릿 관리
 * 모든 알림 메시지의 일관성을 보장하고 중앙 집중식으로 관리
 */

export interface NotificationTemplate {
  title: string;
  message: string;
  emoji?: string;
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  // 댓글 관련 알림
  post_comment: {
    title: '💬 새 댓글',
    message: '{authorName}님이 회원님의 게시글에 댓글을 남겼습니다.',
    emoji: '💬'
  },
  
  comment_reply: {
    title: '↩️ 새 답글', 
    message: '{authorName}님이 회원님의 댓글에 답글을 남겼습니다.',
    emoji: '↩️'
  },

  // 시스템 알림
  system: {
    title: '📢 시스템 알림',
    message: '중요한 시스템 공지사항이 있습니다.',
    emoji: '📢'
  },

  // 사용자 관련 알림
  referral: {
    title: '🎯 추천인 등록',
    message: '{referrerName}님이 회원님을 추천인으로 설정했습니다.',
    emoji: '🎯'
  },

  // 신고 및 제재 관련
  report_received: {
    title: '⚠️ 신고 접수',
    message: '회원님의 콘텐츠가 신고되었습니다.',
    emoji: '⚠️'
  },

  report_resolved: {
    title: '✅ 신고 처리 완료',
    message: '신고 처리가 완료되었습니다.',
    emoji: '✅'
  },

  warning: {
    title: '🚨 경고 알림',
    message: '커뮤니티 규칙 위반으로 경고가 발송되었습니다.',
    emoji: '🚨'
  },

  suspension: {
    title: '🔒 계정 정지',
    message: '계정이 일시 정지되었습니다.',
    emoji: '🔒'
  },

  // 이벤트 및 일반 알림
  event: {
    title: '🎉 이벤트 알림',
    message: '새로운 이벤트가 시작되었습니다.',
    emoji: '🎉'
  },

  general: {
    title: '📱 일반 알림',
    message: '새로운 소식이 있습니다.',
    emoji: '📱'
  },

  // 미구현 기능들 (향후 확장용)
  like: {
    title: '❤️ 좋아요',
    message: '{authorName}님이 회원님의 게시글에 좋아요를 눌렀습니다.',
    emoji: '❤️'
  },

  follow: {
    title: '👥 새 팔로워',
    message: '{authorName}님이 회원님을 팔로우하기 시작했습니다.',
    emoji: '👥'
  }
};

/**
 * 알림 타입에 따른 템플릿을 가져오고 변수 치환을 수행
 */
export function getNotificationTemplate(
  type: string, 
  variables: Record<string, string> = {}
): { title: string; message: string } {
  const template = NOTIFICATION_TEMPLATES[type] || NOTIFICATION_TEMPLATES.general;
  
  // 변수 치환
  let title = template.title;
  let message = template.message;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    title = title.replace(new RegExp(placeholder, 'g'), value);
    message = message.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return { title, message };
}

/**
 * 특정 알림 타입에 사용할 수 있는 변수 목록
 */
export const NOTIFICATION_VARIABLES: Record<string, string[]> = {
  post_comment: ['authorName'],
  comment_reply: ['authorName'],
  referral: ['referrerName'],
  like: ['authorName'],
  follow: ['authorName']
};
