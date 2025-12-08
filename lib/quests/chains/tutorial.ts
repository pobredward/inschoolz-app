import { QuestChain } from '../../../types';

/**
 * 인스쿨즈 입학기 (Tutorial Chain)
 * 신규 유저 온보딩 및 모든 기능 학습
 */
export const tutorialChain: QuestChain = {
  id: 'tutorial',
  type: 'tutorial',
  name: '인스쿨즈 입학기',
  description: '인스쿨즈의 모든 기능을 배우고 진정한 인스쿨러가 되어보세요!',
  icon: '🎓',
  
  steps: [
    {
      id: 'tutorial_1',
      step: 1,
      title: '환영합니다!',
      description: '닉네임을 설정하세요',
      storyText: '인스쿨즈에 오신 걸 환영해요! 먼저 닉네임을 정해주세요.',
      objective: {
        type: 'nickname_change',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 50,
      },
      status: 'available',
      icon: '👋',
      color: '#3B82F6',
    },
    {
      id: 'tutorial_2',
      step: 2,
      title: '학교를 찾아서',
      description: '즐겨찾기 학교를 등록하세요',
      storyText: '마음에 드는 학교를 즐겨찾기에 추가해보세요!',
      objective: {
        type: 'favorite_school',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 50,
      },
      status: 'locked',
      icon: '⭐',
      color: '#10B981',
    },
    {
      id: 'tutorial_3',
      step: 3,
      title: '첫 발걸음',
      description: '학교 게시판을 방문하세요',
      storyText: '학교 친구들은 어떤 이야기를 하고 있을까요?',
      objective: {
        type: 'visit_board',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 30,
      },
      status: 'locked',
      icon: '👀',
      color: '#8B5CF6',
    },
    {
      id: 'tutorial_4',
      step: 4,
      title: '용기 내어',
      description: '첫 게시글을 작성하세요',
      storyText: '이제 당신의 목소리를 들려줄 시간이에요!',
      objective: {
        type: 'create_post',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 100,
      },
      status: 'locked',
      icon: '✍️',
      color: '#F59E0B',
    },
    {
      id: 'tutorial_5',
      step: 5,
      title: '소통의 시작',
      description: '댓글 3개를 작성하세요',
      storyText: '댓글로 친구들과 대화해보세요.',
      objective: {
        type: 'create_comment',
        target: 3,
        current: 0,
      },
      rewards: {
        xp: 80,
      },
      status: 'locked',
      icon: '💬',
      color: '#EC4899',
    },
    {
      id: 'tutorial_6',
      step: 6,
      title: '공감의 힘',
      description: '좋아요 5개를 눌러보세요',
      storyText: '마음에 드는 글에 하트를 눌러보세요.',
      objective: {
        type: 'give_like',
        target: 5,
        current: 0,
      },
      rewards: {
        xp: 50,
      },
      status: 'locked',
      icon: '❤️',
      color: '#EF4444',
    },
    {
      id: 'tutorial_7',
      step: 7,
      title: '두뇌 활성화',
      description: '게임을 1회 플레이하세요',
      storyText: '잠깐의 휴식, 게임으로 두뇌를 풀어볼까요?',
      objective: {
        type: 'play_game',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 60,
      },
      status: 'locked',
      icon: '🎮',
      color: '#6366F1',
    },
    {
      id: 'tutorial_8',
      step: 8,
      title: '매일의 습관',
      description: '첫 출석체크를 하세요',
      storyText: '내일도 만나요! 출석체크로 보상을 받으세요.',
      objective: {
        type: 'attendance',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 50,
      },
      status: 'locked',
      icon: '📅',
      color: '#14B8A6',
    },
    {
      id: 'tutorial_9',
      step: 9,
      title: '세상 구경',
      description: '다른 학교/지역 게시판을 방문하세요',
      storyText: '우리 학교 밖 세상도 구경해봐요.',
      objective: {
        type: 'visit_other_board',
        target: 1,
        current: 0,
      },
      rewards: {
        xp: 40,
      },
      status: 'locked',
      icon: '🌍',
      color: '#06B6D4',
    },
    {
      id: 'tutorial_10',
      step: 10,
      title: '진정한 인스쿨러',
      description: '3일 연속 출석하세요',
      storyText: '축하합니다! 이제 진정한 인스쿨러에요! 🎉',
      objective: {
        type: 'consecutive_attendance',
        target: 3,
        current: 0,
      },
      rewards: {
        xp: 200,
        title: '신입생',
      },
      status: 'locked',
      icon: '🎊',
      color: '#A855F7',
    },
  ],
  
  totalSteps: 10,
  currentStep: 0,
  
  completionRewards: {
    xp: 500,
    badge: 'tutorial_complete',
    title: '입학 완료',
    frame: 'newbie_frame',
    items: ['rare_box'],
  },
  
  status: 'available',
};


