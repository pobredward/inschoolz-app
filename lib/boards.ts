import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  limit,
  Timestamp,
  writeBatch,
  increment,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { Board, BoardType, Post } from '../types';

/**
 * 타입별 게시판 목록 가져오기
 */
export const getBoardsByType = async (type: BoardType): Promise<Board[]> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('type', '==', type),
      where('isActive', '==', true),
      orderBy('order', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const boards: Board[] = [];
    
    querySnapshot.forEach((doc) => {
      const boardData = doc.data();
      boards.push({
        id: doc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board);
    });
    
    return boards;
  } catch (error) {
    console.error('게시판 목록 조회 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 상세 정보 가져오기
 */
export const getBoardById = async (boardId: string): Promise<Board | null> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (boardDoc.exists()) {
      const boardData = boardDoc.data();
      return {
        id: boardDoc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board;
    } else {
      return null;
    }
  } catch (error) {
    console.error('게시판 정보 조회 오류:', error);
    throw new Error('게시판 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 코드로 게시판 찾기 (단일 함수)
 */
export const getBoard = async (code: string): Promise<Board | null> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('code', '==', code),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const boardData = doc.data();
      
      return {
        id: doc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        categories: boardData.categories || [],
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board;
    }
    
    return null;
  } catch (error) {
    console.error('게시판 조회 오류:', error);
    throw new Error('게시판을 찾는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 코드로 게시판 찾기
 */
export const getBoardByCode = async (code: string, type: BoardType): Promise<Board | null> => {
  try {
    const q = query(
      collection(db, 'boards'),
      where('code', '==', code),
      where('type', '==', type),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const boardData = doc.data();
      
      return {
        id: doc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board;
    }
    
    return null;
  } catch (error) {
    console.error('게시판 코드 조회 오류:', error);
    throw new Error('게시판을 찾는 중 오류가 발생했습니다.');
  }
};

/**
 * 기본 게시판 데이터 초기화 (관리자용)
 */
export const initializeDefaultBoards = async (): Promise<void> => {
  try {
    const defaultBoards = [
      // 학교 게시판
      {
        name: '자유게시판',
        description: '자유롭게 이야기해요',
        icon: '💬',
        type: 'school',
        code: 'free',
        isActive: true,
        order: 1,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: true, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '질문/답변',
        description: '궁금한 것들을 물어보세요',
        icon: '❓',
        type: 'school',
        code: 'qa',
        isActive: true,
        order: 2,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: true, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '정보공유',
        description: '유용한 정보를 나눠요',
        icon: '📢',
        type: 'school',
        code: 'info',
        isActive: true,
        order: 3,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '동아리',
        description: '동아리 활동 이야기',
        icon: '🎭',
        type: 'school',
        code: 'club',
        isActive: true,
        order: 4,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      
      // 지역 게시판
      {
        name: '맛집추천',
        description: '우리 동네 맛집을 소개해요',
        icon: '🍕',
        type: 'regional',
        code: 'restaurant',
        isActive: true,
        order: 1,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '학원정보',
        description: '학원 정보를 공유해요',
        icon: '📚',
        type: 'regional',
        code: 'academy',
        isActive: true,
        order: 2,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '동네소식',
        description: '우리 동네 소식을 알려요',
        icon: '🏠',
        type: 'regional',
        code: 'local',
        isActive: true,
        order: 3,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '함께해요',
        description: '같이 할 일을 찾아요',
        icon: '🤝',
        type: 'regional',
        code: 'together',
        isActive: true,
        order: 4,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      
      // 전국 게시판
      {
        name: '입시정보',
        description: '입시 관련 정보를 나눠요',
        icon: '🎓',
        type: 'national',
        code: 'exam',
        isActive: true,
        order: 1,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '진로상담',
        description: '진로에 대해 상담해요',
        icon: '💼',
        type: 'national',
        code: 'career',
        isActive: true,
        order: 2,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: true, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '대학생활',
        description: '대학생활 경험을 공유해요',
        icon: '🏛️',
        type: 'national',
        code: 'university',
        isActive: true,
        order: 3,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      },
      {
        name: '취미생활',
        description: '취미 활동을 공유해요',
        icon: '🎨',
        type: 'national',
        code: 'hobby',
        isActive: true,
        order: 4,
        stats: { postCount: 0 },
        accessLevel: { read: 'all', write: 'all' },
        settings: { allowAnonymous: false, allowAttachment: true, maxAttachmentSize: 10 },
        createdAt: Date.now()
      }
    ];

    const boardsCollection = collection(db, 'boards');
    
    for (const board of defaultBoards) {
      await addDoc(boardsCollection, board);
    }
    
    console.log('기본 게시판 데이터가 성공적으로 초기화되었습니다.');
  } catch (error) {
    console.error('기본 게시판 초기화 오류:', error);
    throw new Error('기본 게시판을 초기화하는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 게시판 관리 API
 */

/**
 * 모든 게시판 조회 (관리자용)
 */
export const getAllBoards = async (): Promise<Board[]> => {
  try {
    // 색인 없이 전체 데이터 조회 후 클라이언트에서 정렬
    const querySnapshot = await getDocs(collection(db, 'boards'));
    const boards: Board[] = [];
    
    querySnapshot.forEach((doc) => {
      const boardData = doc.data();
      boards.push({
        id: doc.id,
        name: boardData.name,
        description: boardData.description,
        icon: boardData.icon,
        type: boardData.type,
        code: boardData.code,
        isActive: boardData.isActive,
        order: boardData.order,
        stats: boardData.stats || { postCount: 0, memberCount: 0, todayPostCount: 0 },
        accessLevel: boardData.accessLevel || { read: 'all', write: 'all' },
        settings: boardData.settings,
        createdAt: boardData.createdAt,
        updatedAt: boardData.updatedAt
      } as Board);
    });
    
    // 클라이언트에서 정렬: type -> order 순
    return boards.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return (a.order || 0) - (b.order || 0);
    });
  } catch (error) {
    console.error('전체 게시판 조회 오류:', error);
    throw new Error('게시판 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 생성 (관리자용)
 */
export const createBoard = async (boardData: Omit<Board, 'id' | 'createdAt' | 'updatedAt'>): Promise<Board> => {
  try {
    const newBoardData = {
      ...boardData,
      createdAt: Date.now(),
      stats: boardData.stats || { postCount: 0, memberCount: 0, todayPostCount: 0 },
    };
    
    const docRef = await addDoc(collection(db, 'boards'), newBoardData);
    
    return {
      id: docRef.id,
      ...newBoardData,
    } as Board;
  } catch (error) {
    console.error('게시판 생성 오류:', error);
    throw new Error('게시판 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 수정 (관리자용)
 */
export const updateBoard = async (boardId: string, boardData: Partial<Board>): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      ...boardData,
      updatedAt: Date.now(),
    } as any);
  } catch (error) {
    console.error('게시판 수정 오류:', error);
    throw new Error('게시판 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 삭제 (관리자용)
 */
export const deleteBoard = async (boardId: string): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await deleteDoc(boardRef);
  } catch (error) {
    console.error('게시판 삭제 오류:', error);
    throw new Error('게시판 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 게시판 활성화/비활성화 (관리자용)
 */
export const toggleBoardStatus = async (boardId: string, isActive: boolean): Promise<void> => {
  try {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      isActive,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('게시판 상태 변경 오류:', error);
    throw new Error('게시판 상태 변경 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 게시판의 게시글 목록 가져오기 (커뮤니티 페이지용)
 */
export const getPostsByBoardType = async (
  type: BoardType,
  code: string,
  pageSize = 20,
  schoolId?: string,
  regions?: { sido: string; sigungu: string }
): Promise<Post[]> => {
  try {
    let q = query(
      collection(db, 'posts'),
      where('type', '==', type),
      where('boardCode', '==', code),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false)
    );
    
    // 학교 커뮤니티인 경우 schoolId 필터링 추가
    if (type === 'school' && schoolId) {
      q = query(q, where('schoolId', '==', schoolId));
    }
    
    // 지역 커뮤니티인 경우 지역 필터링 추가
    if (type === 'regional' && regions?.sido && regions?.sigungu) {
      q = query(q, where('regions.sido', '==', regions.sido));
      q = query(q, where('regions.sigungu', '==', regions.sigungu));
    }
    
    // 정렬 조건 추가
    q = query(q, orderBy('status.isPinned', 'desc'));
    q = query(q, orderBy('createdAt', 'desc'));
    q = query(q, limit(pageSize));
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status
      } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 모든 게시판의 게시글 가져오기 (커뮤니티 페이지용)
 */
export const getAllPostsByType = async (
  type: BoardType,
  pageSize = 50
): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('type', '==', type),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status
      } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('전체 게시글 목록 가져오기 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 학교의 게시글 목록 가져오기 (커뮤니티 페이지용)
 */
export const getAllPostsBySchool = async (
  schoolId: string,
  pageSize = 50
): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('type', '==', 'school'),
      where('schoolId', '==', schoolId),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status
      } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('학교 게시글 목록 가져오기 오류:', error);
    throw new Error('학교 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 지역의 게시글 목록 가져오기 (커뮤니티 페이지용)
 */
export const getAllPostsByRegion = async (
  sido: string,
  sigungu: string,
  pageSize = 50
): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('type', '==', 'regional'),
      where('regions.sido', '==', sido),
      where('regions.sigungu', '==', sigungu),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      orderBy('status.isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status
      } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('지역 게시글 목록 가져오기 오류:', error);
    throw new Error('지역 게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 홈 화면용 인기 게시글 가져오기 (14일 내 조회수 기준)
 */
export const getPopularPostsForHome = async (count = 10): Promise<Post[]> => {
  try {
    // 14일 전 Timestamp 계산
    const fourteenDaysAgo = Timestamp.fromDate(new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)));
    
    const q = query(
      collection(db, 'posts'),
      where('createdAt', '>=', fourteenDaysAgo),
      where('status.isDeleted', '==', false),
      where('status.isHidden', '==', false),
      where('type', '==', 'national'), // 전국 커뮤니티만
      orderBy('createdAt', 'desc'), // 최신순으로 정렬
      limit(count * 3) // 더 많은 게시글을 가져와서 클라이언트에서 필터링
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    // 게시판 정보를 캐시할 맵
    const boardsMap = new Map<string, Board>();
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        authorInfo: postData.authorInfo,
        boardCode: postData.boardCode || postData.code,
        type: postData.type || postData.boardType,
        category: postData.category,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        tags: postData.tags || [],
        stats: postData.stats,
        status: postData.status
      } as Post);
    });
    
    // 게시판 정보 가져오기
    for (const post of posts) {
      if (post.boardCode && !boardsMap.has(post.boardCode)) {
        try {
          const board = await getBoardByCode(post.boardCode, 'national');
          if (board) {
            boardsMap.set(post.boardCode, board);
          }
        } catch (error) {
          console.warn(`게시판 정보 조회 실패: ${post.boardCode}`, error);
        }
      }
    }
    
    // 조회수 기준으로 정렬하고 상위 게시글만 선택 (클라이언트 사이드)
    const sortedPosts = posts
      .sort((a, b) => (b.stats?.viewCount || 0) - (a.stats?.viewCount || 0))
      .slice(0, count)
      .map(post => ({
        ...post,
        boardName: boardsMap.get(post.boardCode)?.name || post.boardCode,
        previewContent: post.content?.replace(/<[^>]*>/g, '').slice(0, 100) || ''
      }));
    
    return sortedPosts;
  } catch (error) {
    console.error('홈 화면 인기 게시글 가져오기 오류:', error);
    throw new Error('인기 게시글을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 게시글 작성 파라미터 타입
 */
export interface CreatePostParams {
  title: string;
  content: string;
  code: string;
  type: 'national' | 'regional' | 'school';
  category?: {
    id: string;
    name: string;
  };
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
  tags?: string[];
  isAnonymous?: boolean;
}

/**
 * 게시글 작성
 */
export const createPost = async (userId: string, params: CreatePostParams): Promise<Post> => {
  try {
    const {
      title,
      content,
      code,
      type,
      category,
      schoolId,
      regions,
      tags,
      isAnonymous
    } = params;

    // 게시판 존재 여부 확인
    const board = await getBoard(code);
    if (!board) {
      throw new Error('존재하지 않는 게시판입니다.');
    }

    // 새 게시글 정보 생성
    const newPost: Omit<Post, 'id'> = {
      title,
      content,
      authorId: userId,
      authorInfo: {
        displayName: '', // 실제로는 사용자 정보에서 가져와야 함
        isAnonymous: isAnonymous || false
      },
      boardCode: code,
      type,
      category: category || undefined,
      schoolId: schoolId || undefined,
      regions: regions || undefined,
      stats: {
        viewCount: 0,
        likeCount: 0,
        commentCount: 0
      },
      status: {
        isDeleted: false,
        isHidden: false,
        isBlocked: false,
        isPinned: false
      },
      attachments: [],
      tags: tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Firestore에 게시글 추가
    const postRef = await addDoc(collection(db, 'posts'), newPost);
    
    // 생성된 게시글 반환
    return {
      id: postRef.id,
      ...newPost
    } as Post;
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    throw new Error('게시글 작성 중 오류가 발생했습니다.');
  }
};

/**
 * 댓글 좋아요 토글
 */
export const toggleCommentLike = async (postId: string, commentId: string, userId: string): Promise<boolean> => {
  try {
    // 좋아요 중복 체크
    const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId);
    const likeDoc = await getDoc(likeRef);
    const batch = writeBatch(db);
    
    let isLiked = false;
    
    if (likeDoc.exists()) {
      // 좋아요 취소
      batch.delete(likeRef);
      // 댓글 좋아요 수 감소
      batch.update(doc(db, 'posts', postId, 'comments', commentId), {
        'stats.likeCount': increment(-1)
      });
    } else {
      // 좋아요 추가
      batch.set(likeRef, {
        createdAt: serverTimestamp()
      });
      // 댓글 좋아요 수 증가
      batch.update(doc(db, 'posts', postId, 'comments', commentId), {
        'stats.likeCount': increment(1)
      });
      isLiked = true;
    }
    
    await batch.commit();
    return isLiked;
  } catch (error) {
    console.error('댓글 좋아요 토글 오류:', error);
    throw new Error('좋아요 처리 중 오류가 발생했습니다.');
  }
};

/**
 * 게시글 북마크/스크랩 토글
 */
export const togglePostBookmark = async (postId: string, userId: string): Promise<boolean> => {
  try {
    // 사용자 문서에서 스크랩 목록 가져오기
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const scraps = userData.scraps || [];
    const isBookmarked = scraps.includes(postId);
    
    let updatedScraps: string[];
    
    if (isBookmarked) {
      // 북마크 제거
      updatedScraps = scraps.filter((id: string) => id !== postId);
    } else {
      // 북마크 추가
      updatedScraps = [...scraps, postId];
    }
    
    // 사용자 문서 업데이트
    await updateDoc(userRef, {
      scraps: updatedScraps,
      updatedAt: Date.now()
    });
    
    return !isBookmarked; // 새로운 북마크 상태 반환
  } catch (error) {
    console.error('게시글 북마크 토글 오류:', error);
    throw new Error('북마크 처리 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자가 북마크한 게시글 목록 가져오기
 */
export const getBookmarkedPosts = async (userId: string): Promise<Post[]> => {
  try {
    // 사용자 문서에서 스크랩 목록 가져오기
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return [];
    }
    
    const userData = userDoc.data();
    const scraps = userData.scraps || [];
    
    if (scraps.length === 0) {
      return [];
    }
    
    // 스크랩한 게시글들 가져오기
    const posts: Post[] = [];
    for (const postId of scraps) {
      try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        
        if (postDoc.exists()) {
          const postData = postDoc.data();
          if (!postData.status?.isDeleted) {
            posts.push({
              id: postDoc.id,
              ...postData
            } as Post);
          }
        }
      } catch (error) {
        console.warn(`게시글 ${postId} 조회 실패:`, error);
      }
    }
    
    // 최신순으로 정렬
    return posts.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('북마크 목록 조회 오류:', error);
    throw new Error('북마크 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자가 북마크한 게시글 개수 가져오기
 */
export const getBookmarkedPostsCount = async (userId: string): Promise<number> => {
  try {
    // 사용자 문서에서 스크랩 목록 가져오기
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return 0;
    }
    
    const userData = userDoc.data();
    const scraps = userData.scraps || [];
    
    return scraps.length;
  } catch (error) {
    console.error('북마크 개수 조회 오류:', error);
    return 0;
  }
}; 

// 댓글 작성하기
export const createComment = async (
  postId: string,
  content: string,
  userId: string,
  isAnonymous: boolean,
  parentId?: string
) => {
  try {
    // 게시글 정보 가져오기
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('존재하지 않는 게시글입니다.');
    }
    const postData = postDoc.data();

    // 사용자 정보 가져오기
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    // 댓글 데이터 생성
    const commentData = {
      postId,
      content,
      authorId: userId,
      isAnonymous,
      parentId: parentId || null,
      stats: {
        likeCount: 0
      },
      status: {
        isDeleted: false,
        isBlocked: false
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 댓글 저장
    const commentRef = collection(db, 'posts', postId, 'comments');
    const commentDoc = await addDoc(commentRef, commentData);
    const commentId = commentDoc.id;

    // 게시글 댓글 수 업데이트
    await updateDoc(doc(db, 'posts', postId), {
      'stats.commentCount': increment(1)
    });

    // 사용자 댓글 수 업데이트
    await updateDoc(doc(db, 'users', userId), {
      'stats.commentCount': increment(1)
    });

    // 알림 발송 로직
    try {
      const userData = userDoc.data();
      const commenterName = isAnonymous 
        ? '익명' 
        : (userData?.profile?.userName || '사용자');

      if (parentId) {
        // 대댓글인 경우: 원 댓글 작성자에게 알림
        const parentCommentDoc = await getDoc(doc(db, `posts/${postId}/comments`, parentId));
        if (parentCommentDoc.exists()) {
          const parentCommentData = parentCommentDoc.data();
          const parentAuthorId = parentCommentData.authorId;
          
          // 자기 자신에게는 알림 보내지 않음
          if (parentAuthorId && parentAuthorId !== userId) {
            const { createCommentReplyNotification } = await import('./notifications');
            await createCommentReplyNotification(
              parentAuthorId,
              postId,
              postData.title || '게시글',
              parentId,
              commenterName,
              content,
              commentId
            );
          }
        }
      } else {
        // 일반 댓글인 경우: 게시글 작성자에게 알림
        const postAuthorId = postData.authorId;
        
        // 자기 자신에게는 알림 보내지 않음
        if (postAuthorId && postAuthorId !== userId) {
          const { createPostCommentNotification } = await import('./notifications');
          await createPostCommentNotification(
            postAuthorId,
            postId,
            postData.title || '게시글',
            commenterName,
            content,
            commentId
          );
        }
      }
    } catch (notificationError) {
      console.error('댓글 알림 발송 실패:', notificationError);
      // 알림 발송 실패는 댓글 작성 자체를 실패시키지 않음
    }

    return commentId;
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    throw new Error('댓글을 작성하는 중 오류가 발생했습니다.');
  }
}; 

// 4자리 비밀번호를 해시화합니다. (Web Crypto API 사용)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'inschoolz_salt'); // 간단한 솔트 추가
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 비밀번호를 검증합니다.
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
};

// 익명 댓글 작성하기
export const createAnonymousComment = async ({
  postId,
  content,
  nickname,
  password,
  parentId = null,
  ipAddress
}: {
  postId: string;
  content: string;
  nickname: string;
  password: string;
  parentId?: string | null;
  ipAddress?: string;
}) => {
  try {
    // 게시글 정보 가져오기
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('존재하지 않는 게시글입니다.');
    }

    // 비밀번호 해시화
    const passwordHash = await hashPassword(password);
    
    // 댓글 데이터 생성
    const commentData = {
      postId,
      content,
      authorId: null,
      isAnonymous: true,
      parentId,
      anonymousAuthor: {
        nickname,
        passwordHash,
        ipAddress: ipAddress || null,
      },
      stats: {
        likeCount: 0,
      },
      status: {
        isDeleted: false,
        isBlocked: false,
      },
      createdAt: Date.now(),
    };

    // Firestore에 댓글 추가
    const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
    
    // 게시글의 댓글 수 증가
    await updateDoc(doc(db, 'posts', postId), {
      'stats.commentCount': increment(1),
    });

    return commentRef.id;
  } catch (error) {
    console.error('익명 댓글 작성 실패:', error);
    throw new Error('댓글 작성에 실패했습니다.');
  }
};

// 익명 댓글의 비밀번호를 검증합니다.
export const verifyAnonymousCommentPassword = async (
  postId: string,
  commentId: string,
  password: string
): Promise<boolean> => {
  try {
    const commentDoc = await getDoc(doc(db, 'posts', postId, 'comments', commentId));
    
    if (!commentDoc.exists()) {
      return false;
    }

    const comment = commentDoc.data();
    
    // 익명 댓글이 아니거나 비밀번호 해시가 없는 경우
    if (!comment.isAnonymous || !comment.anonymousAuthor?.passwordHash) {
      return false;
    }

    return verifyPassword(password, comment.anonymousAuthor.passwordHash);
  } catch (error) {
    console.error('익명 댓글 비밀번호 검증 실패:', error);
    return false;
  }
};

// 익명 댓글을 수정합니다.
export const updateAnonymousComment = async (
  postId: string,
  commentId: string,
  content: string,
  password: string
): Promise<void> => {
  try {
    // 비밀번호 검증
    const isValidPassword = await verifyAnonymousCommentPassword(postId, commentId, password);
    
    if (!isValidPassword) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    // 댓글 수정
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    await updateDoc(commentRef, {
      content,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('익명 댓글 수정 실패:', error);
    throw error;
  }
};

// 익명 댓글을 삭제합니다.
export const deleteAnonymousComment = async (
  postId: string,
  commentId: string,
  password: string
): Promise<void> => {
  try {
    // 비밀번호 검증
    const isValidPassword = await verifyAnonymousCommentPassword(postId, commentId, password);
    
    if (!isValidPassword) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    // 트랜잭션으로 댓글 삭제 및 게시글 댓글 수 감소
    await runTransaction(db, async (transaction) => {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const postRef = doc(db, 'posts', postId);
      
      // 댓글 상태를 삭제로 변경 (실제 삭제하지 않고 상태만 변경)
      transaction.update(commentRef, {
        'status.isDeleted': true,
        content: '삭제된 댓글입니다.',
        deletedAt: Date.now(),
      });
      
      // 게시글의 댓글 수 감소
      transaction.update(postRef, {
        'stats.commentCount': increment(-1),
      });
    });
  } catch (error) {
    console.error('익명 댓글 삭제 실패:', error);
    throw error;
  }
}; 