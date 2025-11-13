import { Timestamp, FieldValue } from 'firebase/firestore';

// Firebase Timestamp와 number 타입을 모두 지원하는 타입
export type FirebaseTimestamp = Timestamp | number | FieldValue;

// Firestore FieldValue를 포함한 타임스탬프 타입 (생성 시 사용)
export type FirebaseTimestampInput = FirebaseTimestamp | FieldValue;

// 사용자 역할 타입
export type UserRole = 'student' | 'teacher' | 'admin';

// 게시판 타입
export type BoardType = 'school' | 'regional' | 'national';

// 출석 로그 객체 타입
export interface AttendanceLog {
  [date: string]: boolean;
}

// 출석체크 데이터 타입
export interface UserAttendance {
  checkedToday: boolean;
  streak: number;
  totalCount: number;
  monthCount: number;
  lastAttendance?: FirebaseTimestamp;
  monthlyLog?: AttendanceLog;
  // 경험치 관련 정보 (출석체크 수행 시에만 포함)
  expGained?: number;
  leveledUp?: boolean;
  oldLevel?: number;
  newLevel?: number;
}

// 게시판 인터페이스
export interface Board {
  id: string;
  name: string;
  description?: string;
  icon: string;
  type: BoardType;
  code: string;
  isActive: boolean;
  order: number;
  stats?: {
    postCount: number;
    memberCount?: number;
    todayPostCount?: number;
  };
  accessLevel: {
    read: 'all' | 'member' | 'verified';
    write: 'all' | 'member' | 'verified';
  };
  settings?: {
    allowAnonymous: boolean;
    allowAttachment: boolean;
    maxAttachmentSize: number;
  };
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  parentCode?: string;
  isPublic: boolean;
  categories?: {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    order: number;
    isActive: boolean;
  }[];
}

// 학교 인터페이스
export interface School {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
  REGION?: string;
  HOMEPAGE?: string;
  memberCount?: number;
  favoriteCount?: number;
}

// 사용자 프로필 인터페이스 (통일된 구조)
export interface UserProfile {
  userName: string; // 사용자 아이디
  realName: string; // 실명
  gender: string; // 성별
  birthYear: number; // 생년
  birthMonth: number; // 생월
  birthDay: number; // 생일
  phoneNumber: string; // 전화번호
  profileImageUrl: string; // 프로필 이미지
  createdAt: FirebaseTimestamp; // 생성일
  isAdmin: boolean; // 관리자 여부
}

// 사용자 통계 인터페이스 (통일된 구조)
export interface UserStats {
  level: number; // 레벨
  currentExp: number; // 현재 레벨에서의 경험치 (0부터 시작)
  totalExperience: number; // 누적 경험치 (메인 필드)
  currentLevelRequiredXp: number; // 현재 레벨에서 다음 레벨로 가기 위해 필요한 경험치
  postCount: number; // 게시글 수
  commentCount: number; // 댓글 수
  likeCount: number; // 좋아요 수
  streak: number; // 연속 출석
}

// 게임 통계 인터페이스
export interface GameStats {
  reactionGame?: {
    bestReactionTime?: number; // ms 단위
  };
  tileGame?: {
    bestReactionTime?: number; // ms 단위 (최소 움직임 횟수)
  };
  flappyBird?: {
    bestReactionTime?: number; // ms 단위
  };
  mathGame?: {
    bestReactionTime?: number; // 최고 점수 (정답 개수)
  };
}

// 사용자 인터페이스 (통일된 구조)
export interface User {
  uid: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  status?: 'active' | 'inactive' | 'suspended';
  fake?: boolean; // 봇 여부 (true: 봇, false: 실제 사용자)
  searchTokens?: string[]; // 검색용 토큰 배열
  
  // 프로필 정보
  profile: UserProfile;
  
  // 학교 정보
  school?: {
    id: string;
    name: string;
    grade?: string | null;
    classNumber?: string | null;
    studentNumber?: string | null;
    isGraduate?: boolean | null;
  };
  
  // 즐겨찾기 정보
  favorites?: {
    schools: string[]; // 즐겨찾는 학교 ID 리스트 (최대 5개)
    boards: string[]; // 즐겨찾는 게시판 코드 리스트
  };
  
  // 지역 정보
  regions?: {
    sido: string;
    sigungu: string;
    address?: string;
  };
  
  // 경험치/통계
  stats: UserStats;
  
  // 게임 통계
  gameStats?: GameStats;
  
  // 약관 동의 (통합)
  agreements: {
    terms: boolean; // 이용약관
    privacy: boolean; // 개인정보
    location: boolean; // 위치정보
    marketing: boolean; // 마케팅
  };
  
  // 활동 제한
  activityLimits?: {
    lastResetDate: string;
    dailyCounts: {
      posts: number;
      comments: number;
      games: {
        flappyBird: number;
        reactionGame: number;
        tileGame: number;
        mathGame: number;
      };
      adViewedCount: number;
    };
    adRewards: {
      flappyBird: number;
      reactionGame: number;
      tileGame: number;
      mathGame: number;
      lastRewardTime: FirebaseTimestamp;
    }
  };
  
  // 푸시 알림 토큰
  pushTokens?: {
    [platform: string]: {
      token: string;
      platform: string;
      deviceId?: string;
      updatedAt?: FirebaseTimestamp;
    };
  };
  
  // 알림 설정
  notificationSettings?: {
    post_comment: boolean;
    comment_reply: boolean;
    system: boolean;
    referral: boolean;
    warning: boolean;
    suspension: boolean;
    report_received: boolean;
    report_resolved: boolean;
    quietHours?: {
      enabled: boolean;
      startTime: string; // HH:mm
      endTime: string; // HH:mm
    };
  };
  
  // 시스템 정보
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
  lastLoginAt?: FirebaseTimestamp;
  referrerId?: string; // 추천인 ID
}

// 게시글 타입
export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorInfo: {
    displayName: string;
    profileImageUrl?: string;
    isAnonymous: boolean;
  };
  boardCode: string;
  boardName: string;
  type: 'national' | 'regional' | 'school';
  category?: {
    id: string;
    name: string;
  };
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
  attachments: {
    type: 'image' | 'file';
    url: string;
    name: string;
    size: number;
  }[];
  tags: string[];
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
    scrapCount: number;
  };
  status: {
    isPinned: boolean;
    isDeleted: boolean;
    isHidden: boolean;
    isBlocked: boolean;
  };
  poll?: {
    isActive: boolean;
    question: string;
    options: {
      text: string;
      imageUrl?: string;
      voteCount: number;
      index: number;
    }[];
    expiresAt?: FirebaseTimestamp;
    multipleChoice: boolean;
  };
}

// 댓글 타입
export interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string | null; // 익명 댓글의 경우 null
  isAnonymous: boolean;
  parentId: string | null;
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  isEdited?: boolean;
  
  // 익명 댓글 정보 (비회원 작성 시)
  anonymousAuthor?: {
    nickname: string; // 익명 닉네임
    passwordHash: string; // 4자리 비밀번호 해시
    ipAddress?: string; // IP 주소 (관리 목적)
  };
  
  stats: {
    likeCount: number;
  };
  status: {
    isDeleted: boolean;
    isBlocked: boolean;
  };
}

// 로그인 폼 데이터
export interface LoginFormData {
  email: string;
  password: string;
}

// 회원가입 폼 데이터
export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  userName: string;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 신고 관련 타입 정의
export type ReportType = 'post' | 'comment' | 'user';

export type ReportReason = 
  | 'spam'           // 스팸/도배
  | 'inappropriate'  // 부적절한 내용
  | 'harassment'     // 괴롭힘/욕설
  | 'fake'          // 허위정보
  | 'copyright'     // 저작권 침해
  | 'privacy'       // 개인정보 노출
  | 'violence'      // 폭력적 내용
  | 'sexual'        // 성적 내용
  | 'hate'          // 혐오 발언
  | 'other';        // 기타

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';

export interface Report {
  id: string;
  reason: ReportReason;
  customReason?: string; // 기타 사유 선택 시 직접 입력
  description?: string;  // 상세 설명
  
  // 신고 대상 정보
  targetId: string;      // 신고 대상의 ID (postId, commentId, userId)
  targetType: ReportType;
  targetContent?: string; // 신고 대상의 내용 (스냅샷)
  targetAuthorId?: string; // 신고받은 사용자 ID (게시글/댓글 작성자 또는 직접 신고받은 사용자)
  postId?: string;       // 댓글 신고 시 게시글 ID
  
  // 신고자 정보
  reporterId: string;
  reporterInfo: {
    displayName: string;
    profileImageUrl?: string;
  };
  
  // 신고 처리 정보
  status: ReportStatus;
  adminId?: string;      // 처리한 관리자 ID
  adminNote?: string;    // 관리자 메모
  actionTaken?: string;  // 취한 조치
  
  // 시간 정보
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  resolvedAt?: FirebaseTimestamp;
  
  // 추가 정보
  boardCode?: string;    // 게시판 코드 (게시글/댓글 신고 시)
  schoolId?: string;     // 학교 ID (학교 커뮤니티 신고 시)
  regions?: {            // 지역 정보 (지역 커뮤니티 신고 시)
    sido: string;
    sigungu: string;
  };
}

// 신고 통계 인터페이스
export interface ReportStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  rejectedReports: number;
  reportsByReason: Record<ReportReason, number>;
  reportsByType: Record<ReportType, number>;
  recentReports: Report[];
}

// 사용자 신고 기록 인터페이스
export interface UserReportRecord {
  reportsMade: Report[];     // 내가 신고한 내역
  reportsReceived: Report[]; // 나를 신고한 내역
  stats: {
    totalReportsMade: number;
    totalReportsReceived: number;
    warningsReceived: number;
    suspensionsReceived: number;
  };
}

export interface SystemSettings {
  experience: {
    postReward: number;
    commentReward: number;
    likeReward: number;
    attendanceReward: number;
    attendanceStreakReward: number;
    referralReward: number;
    levelRequirements: Record<number, number>;
  };
  dailyLimits: {
    postsForReward: number;
    commentsForReward: number;
    gamePlayCount: number;
  };
  gameSettings: {
    reactionGame: {
      enabled?: boolean;
      dailyLimit?: number;
      rewardThreshold: number;
      rewardAmount: number;
      thresholds?: {
        minScore: number;
        xpReward: number;
      }[];
    };
    tileGame: {
      enabled?: boolean;
      dailyLimit?: number;
      rewardThreshold: number;
      rewardAmount: number;
      thresholds?: {
        minScore: number;
        xpReward: number;
      }[];
    };
    flappyBird: {
      rewardThreshold: number;
      rewardAmount: number;
    };
  };
  ads: {
    rewardedVideo: {
      gameExtraPlays: number;
      cooldownMinutes: number;
      experienceReward: number;
      dailyLimit: number;
    };
  };
  appVersion: {
    current: string;
    minimum: string;
    forceUpdate: boolean;
  };
  maintenance: {
    isActive: boolean;
  };
  attendanceBonus?: {
    weeklyBonusXP: number;
    streakBonus: number;
  };
} 

// 알림 타입 정의
export type NotificationType = 
  | 'like'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'report_received'    // 신고 당함
  | 'report_resolved'    // 신고 처리 완료
  | 'warning'           // 경고 조치
  | 'suspension'        // 정지 조치
  | 'system'            // 관리자가 모든 유저에게 보내는 알림
  | 'general'           // 일반 알림
  | 'event'             // 이벤트 알림
  | 'referral'          // 누군가가 내 아이디를 추천인으로 설정
  | 'post_comment'      // 내가 쓴 게시글에 댓글
  | 'comment_reply';    // 내가 쓴 댓글에 대댓글

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    reportId?: string;
    postId?: string;
    commentId?: string;
    targetUserId?: string;
    actionTaken?: string;
    authorName?: string;       // 댓글/대댓글 작성자 이름
    referrerName?: string;     // 추천인 이름
    postTitle?: string;        // 게시글 제목
    commentContent?: string;   // 댓글 내용
    [key: string]: unknown;
  };
  isRead: boolean;
  createdAt: FirebaseTimestamp;
} 

// 이의제기 관련 타입 정의
export type AppealStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

export interface Appeal {
  id: string;
  reportId: string;
  userId: string; // 이의제기 신청자
  reason: string;
  description: string;
  status: AppealStatus;
  adminId?: string; // 처리한 관리자 ID
  adminNote?: string; // 관리자 메모
  adminDecision?: string; // 관리자 결정
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  resolvedAt?: FirebaseTimestamp;
}

// 급식 정보 관련 타입 정의
export interface MealInfo {
  id: string;
  schoolId: string;
  schoolName: string;
  date: string; // YYYY-MM-DD 형식
  mealType: 'breakfast' | 'lunch' | 'dinner'; // 조식, 중식, 석식
  menu: string[]; // 메뉴 항목들
  calories?: string; // 칼로리 정보
  nutrition?: {
    protein?: string; // 단백질
    fat?: string; // 지방
    carbohydrate?: string; // 탄수화물
    sodium?: string; // 나트륨
  };
  allergyInfo?: string[]; // 알레르기 정보
  origin?: string; // 원산지 정보
  price?: number; // 급식비
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

// 급식 정보 요청 파라미터
export interface MealRequestParams {
  schoolId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  mealType?: 'breakfast' | 'lunch' | 'dinner';
}

// 급식 정보 응답
export interface MealResponse {
  success: boolean;
  data: MealInfo[];
  message?: string;
  totalCount: number;
}

// 주간/월간 급식 정보
export interface WeeklyMealPlan {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  meals: {
    [date: string]: {
      breakfast?: MealInfo;
      lunch?: MealInfo;
      dinner?: MealInfo;
    };
  };
}

// 급식 설정 (사용자별)
export interface MealSettings {
  userId: string;
  schoolId: string;
  preferences: {
    showBreakfast: boolean;
    showLunch: boolean;
    showDinner: boolean;
    showAllergyInfo: boolean;
    showNutritionInfo: boolean;
    showCalories: boolean;
  };
  allergyFilters: string[]; // 알레르기 필터링
  notifications: {
    dailyMealNotification: boolean;
    weeklyMenuNotification: boolean;
    notificationTime: string; // HH:MM 형식
  };
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
} 