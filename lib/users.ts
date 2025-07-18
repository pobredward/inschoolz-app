import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  increment,
  getCountFromServer,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { User, FirebaseTimestamp } from '../types'; // 통일된 타입 사용
import { storage } from './firebase'; // storage 추가
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; // storage 관련 함수 추가
import { getBoard } from './boards'; // 게시판 정보 조회를 위해 추가
import { getSchoolById } from './schools'; // 학교 정보 조회를 위해 추가
import { toTimestamp } from '../utils/timeUtils'; // toTimestamp 함수 import

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  boardCode: string;
  type: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
  attachments?: any[];
  status: {
    isDeleted: boolean;
  };
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  boardName?: string;
  previewContent?: string;
  schoolName?: string;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  postId: string;
  createdAt: FirebaseTimestamp;
  status: {
    isDeleted: boolean;
  };
  postData?: {
    title: string;
    type: string;
    boardCode: string;
    schoolId?: string;
    regions?: {
      sido: string;
      sigungu: string;
    };
  };
}

export interface AdminUserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: 'all' | 'admin' | 'user';
  status?: 'all' | 'active' | 'inactive' | 'suspended';
  sortBy?: 'createdAt' | 'lastActiveAt' | 'totalExperience' | 'userName';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserListResponse {
  users: User[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
}

/**
 * 관리자용 사용자 목록 조회
 */
export const getUsersList = async (params: AdminUserListParams = {}): Promise<AdminUserListResponse> => {
  try {
    const {
      page = 1,
      pageSize = 20,
      search = '',
      role = 'all',
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    const usersRef = collection(db, 'users');
    let q = query(usersRef);

    // 역할 필터
    if (role !== 'all') {
      q = query(q, where('role', '==', role));
    }

    // 상태 필터
    if (status !== 'all') {
      q = query(q, where('status', '==', status));
    }

    // 검색 (userName 기준)
    if (search) {
      q = query(q, where('profile.userName', '>=', search), where('profile.userName', '<=', search + '\uf8ff'));
    }

    // 정렬
    q = query(q, orderBy(sortBy, sortOrder));

    // 페이지네이션
    const offset = (page - 1) * pageSize;
    q = query(q, limit(pageSize + offset));

    const querySnapshot = await getDocs(q);
    const allUsers: User[] = [];
    
    querySnapshot.forEach((doc) => {
      allUsers.push({ 
        uid: doc.id, 
        ...doc.data() 
      } as User);
    });

    // 페이지네이션 적용
    const users = allUsers.slice(offset, offset + pageSize);

    // 전체 개수 조회
    const countQuery = query(usersRef);
    const countSnapshot = await getCountFromServer(countQuery);
    const totalCount = countSnapshot.data().count;

    return {
      users,
      totalCount,
      hasMore: totalCount > page * pageSize,
      currentPage: page
    };
  } catch (error) {
    console.error('관리자 사용자 목록 조회 오류:', error);
    throw new Error('사용자 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 사용자 상세 정보 조회
 */
export const getUserDetail = async (userId: string): Promise<User & {
  activityStats: {
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    warningCount: number;
  };
  recentActivity: {
    lastLoginAt?: number;
    lastActiveAt?: number;
    recentPosts: Post[];
    recentComments: Comment[];
  };
}> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = { uid: userDoc.id, ...userDoc.data() } as User;

    // 활동 통계 조회
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const postsSnapshot = await getDocs(postsQuery);
    const recentPosts: Post[] = [];
    postsSnapshot.forEach((doc) => {
      recentPosts.push({ id: doc.id, ...doc.data() } as Post);
    });

    const commentsQuery = query(
      collection(db, 'comments'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    const recentComments: Comment[] = [];
    commentsSnapshot.forEach((doc) => {
      recentComments.push({ id: doc.id, ...doc.data() } as Comment);
    });

    // 통계 계산
    const totalPostsCount = await getCountFromServer(
      query(collection(db, 'posts'), where('authorId', '==', userId))
    );
    const totalCommentsCount = await getCountFromServer(
      query(collection(db, 'comments'), where('authorId', '==', userId))
    );

    return {
      ...userData,
      activityStats: {
        totalPosts: totalPostsCount.data().count,
        totalComments: totalCommentsCount.data().count,
        totalLikes: userData.stats?.likeCount || 0,
        warningCount: 0 // warnings는 별도 컬렉션에서 관리
      },
      recentActivity: {
        lastLoginAt: userData.lastLoginAt ? toTimestamp(userData.lastLoginAt) : undefined,
        lastActiveAt: userData.updatedAt ? toTimestamp(userData.updatedAt) : undefined,
        recentPosts,
        recentComments
      }
    };
  } catch (error) {
    console.error('사용자 상세 정보 조회 오류:', error);
    throw new Error('사용자 상세 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 활동 요약 정보 조회
 */
export const getUserActivitySummary = async (userId: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data() as User;
    
    // 다음 레벨까지 필요한 경험치 계산
    const calculateNextLevelXP = (currentLevel: number): number => {
      return currentLevel * 10; // 1->2레벨: 10XP, 2->3레벨: 20XP, ...
    };

    const level = userData.stats?.level || 1;
    const currentExp = userData.stats?.currentExp || 0;
    const totalExperience = userData.stats?.totalExperience || 0;
    const nextLevelXP = calculateNextLevelXP(level);
    
    return {
      level,
      currentExp,
      totalExperience,
      nextLevelXP,
      totalPosts: userData.stats?.postCount || 0,
      totalComments: userData.stats?.commentCount || 0,
      totalLikes: userData.stats?.likeCount || 0,
      totalViews: 0, // 추후 구현
      streak: userData.stats?.streak || 0
    };
  } catch (error) {
    console.error('사용자 활동 요약 조회 오류:', error);
    throw new Error('사용자 활동 요약을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 역할 변경
 */
export const updateUserRole = async (userId: string, newRole: 'admin' | 'user'): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('사용자 역할 변경 오류:', error);
    throw new Error('사용자 역할을 변경하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 상태 변경
 */
export const updateUserStatus = async (userId: string, newStatus: 'active' | 'inactive' | 'suspended', reason?: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const updateData: any = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };

    if (newStatus === 'suspended' && reason) {
      updateData.suspensionReason = reason;
      updateData.suspendedAt = serverTimestamp();
    }

    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('사용자 상태 변경 오류:', error);
    throw new Error('사용자 상태를 변경하는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 사용자 경험치 수정
 */
export const updateUserExperienceAdmin = async (userId: string, newExperience: number, reason: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // 경험치 시스템 함수 사용
    const { calculateCurrentLevelProgress } = await import('./experience');
    const progress = calculateCurrentLevelProgress(newExperience);
    
    await updateDoc(userRef, {
      'stats.totalExperience': newExperience,
      // 'stats.experience': newExperience, // experience 필드 제거
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      updatedAt: serverTimestamp()
    });

    // 경험치 변경 로그 추가
    await addDoc(collection(db, 'users', userId, 'experienceHistory'), {
      type: 'admin_adjustment',
      amount: newExperience,
      reason,
      adminId: 'current_admin', // 실제로는 현재 관리자 ID
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('사용자 경험치 수정 오류:', error);
    throw new Error('사용자 경험치를 수정하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 경고 추가
 */
export const addUserWarning = async (userId: string, reason: string, severity: 'low' | 'medium' | 'high'): Promise<void> => {
  try {
    // 경고 추가
    await addDoc(collection(db, 'users', userId, 'warningHistory'), {
      reason,
      severity,
      status: 'active',
      adminId: 'current_admin', // 실제로는 현재 관리자 ID
      createdAt: serverTimestamp()
    });

    // 사용자 경고 수 업데이트
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'warnings.count': increment(1),
      'warnings.lastWarningAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('사용자 경고 추가 오류:', error);
    throw new Error('사용자 경고를 추가하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 삭제
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    // 사용자 문서 삭제
    await deleteDoc(doc(db, 'users', userId));

    // 관련 데이터 정리는 Cloud Functions에서 처리하는 것이 좋음
    // 여기서는 기본적인 삭제만 수행
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    throw new Error('사용자를 삭제하는 중 오류가 발생했습니다.');
  }
};

/**
 * 대량 사용자 업데이트
 */
export const bulkUpdateUsers = async (userIds: string[], updates: {
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive' | 'suspended';
  reason?: string;
}): Promise<void> => {
  try {
    const batch = [];
    
    for (const userId of userIds) {
      const userRef = doc(db, 'users', userId);
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      if (updates.status === 'suspended' && updates.reason) {
        updateData.suspensionReason = updates.reason;
        updateData.suspendedAt = serverTimestamp();
      }

      batch.push(updateDoc(userRef, updateData));
    }

    await Promise.all(batch);
  } catch (error) {
    console.error('대량 사용자 업데이트 오류:', error);
    throw new Error('사용자들을 업데이트하는 중 오류가 발생했습니다.');
  }
}; 

/**
 * 사용자 정보 조회
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return { 
        ...userDoc.data(),
        uid: userDoc.id
      } as User;
    } else {
      return null;
    }
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    throw new Error('사용자 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * userName으로 사용자 정보 조회
 */
export const getUserByUserName = async (userName: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('profile.userName', '==', userName),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      return { 
        ...userDoc.data(),
        uid: userDoc.id
      } as User;
    } else {
      return null;
    }
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    throw new Error('사용자 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 추천인 검색 함수
 * @param searchTerm 검색어 (userName)
 * @returns 검색된 사용자 목록
 */
export const searchUsers = async (searchTerm: string): Promise<Array<{
  uid: string;
  userName: string;
  realName: string;
}>> => {
  try {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    const usersRef = collection(db, 'users');
    
    // userName으로 부분 일치 검색
    const q = query(
      usersRef,
      where('profile.userName', '>=', searchTerm.trim()),
      where('profile.userName', '<=', searchTerm.trim() + '\uf8ff'),
      limit(10) // 최대 10개 결과
    );
    
    const querySnapshot = await getDocs(q);
    const users: Array<{
      uid: string;
      userName: string;
      realName: string;
    }> = [];
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.profile?.userName && userData.profile?.realName) {
        users.push({
          uid: doc.id,
          userName: userData.profile.userName,
          realName: userData.profile.realName
        });
      }
    });
    
    return users;
  } catch (error) {
    console.error('사용자 검색 오류:', error);
    return [];
  }
}; 

/**
 * 사용자 프로필 업데이트
 */
export const updateUserProfile = async (
  userId: string,
  profileData: {
    userName?: string;
    realName?: string;
    gender?: string;
    birthYear?: string | number;
    birthMonth?: string | number;
    birthDay?: string | number;
    phoneNumber?: string;
    referrerId?: string;
    sido?: string;
    sigungu?: string;
    address?: string;
  }
): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const updates: Record<string, any> = {};
    
    // 프로필 필드 업데이트
    if (profileData.userName) {
      updates['profile.userName'] = profileData.userName;
    }
    
    if (profileData.realName !== undefined) {
      updates['profile.realName'] = profileData.realName;
    }
    
    if (profileData.gender !== undefined) {
      updates['profile.gender'] = profileData.gender;
    }
    
    if (profileData.birthYear !== undefined) {
      updates['profile.birthYear'] = Number(profileData.birthYear) || 0;
    }
    
    if (profileData.birthMonth !== undefined) {
      updates['profile.birthMonth'] = Number(profileData.birthMonth) || 0;
    }
    
    if (profileData.birthDay !== undefined) {
      updates['profile.birthDay'] = Number(profileData.birthDay) || 0;
    }
    
    if (profileData.phoneNumber !== undefined) {
      updates['profile.phoneNumber'] = profileData.phoneNumber;
    }
    
    // 추천인 업데이트
    if (profileData.referrerId !== undefined) {
      updates['referrerId'] = profileData.referrerId;
    }
    
    // 지역 정보 업데이트
    if (profileData.sido || profileData.sigungu || profileData.address) {
      // 지역 정보가 아직 없는 경우 초기화
      if (!userDoc.data()?.regions) {
        updates['regions'] = {
          sido: '',
          sigungu: '',
          address: ''
        };
      }
      
      if (profileData.sido !== undefined) {
        updates['regions.sido'] = profileData.sido;
      }
      
      if (profileData.sigungu !== undefined) {
        updates['regions.sigungu'] = profileData.sigungu;
      }
      
      if (profileData.address !== undefined) {
        updates['regions.address'] = profileData.address;
      }
    }
    
    // 변경된 필드가 있는 경우에만 업데이트
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      await updateDoc(userRef, updates);
    }
    
    return true;
  } catch (error) {
    console.error('사용자 프로필 업데이트 오류:', error);
    throw new Error('프로필을 업데이트하는 중 오류가 발생했습니다.');
  }
};

/**
 * 프로필 이미지 업로드 및 업데이트
 */
export const updateProfileImage = async (
  userId: string,
  imageUri: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    if (!imageUri) {
      return { success: false, error: '이미지가 제공되지 않았습니다.' };
    }

    // 이전 프로필 이미지 URL 가져오기
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }
    
    const userData = userDoc.data();
    const oldImageUrl = userData?.profile?.profileImageUrl;
    
    // Firebase Storage 경로 설정
    const fileName = `${userId}_${Date.now()}.jpg`;
    const storageRef = ref(storage, `profile_images/${fileName}`);
    
    // 이미지를 blob으로 변환 후 업로드
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // 이미지 업로드
    await uploadBytes(storageRef, blob);
    
    // 다운로드 URL 가져오기
    const downloadUrl = await getDownloadURL(storageRef);
    
    // Firestore 업데이트
    await updateDoc(userRef, {
      'profile.profileImageUrl': downloadUrl,
      updatedAt: serverTimestamp()
    });
    
    // 이전 이미지가 있고 기본 이미지가 아니라면 삭제
    if (oldImageUrl && !oldImageUrl.includes('default-profile')) {
      try {
        // URL에서 파일 경로 추출
        const oldImagePath = decodeURIComponent(oldImageUrl.split('?')[0].split('/o/')[1]);
        const oldImageRef = ref(storage, oldImagePath);
        await deleteObject(oldImageRef);
      } catch (err) {
        console.error('이전 프로필 이미지 삭제 오류:', err);
        // 이전 이미지 삭제 실패해도 계속 진행
      }
    }
    
    return { success: true, url: downloadUrl };
  } catch (error) {
    console.error('프로필 이미지 업로드 오류:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '프로필 이미지를 업로드하는 중 오류가 발생했습니다.' 
    };
  }
};

/**
 * 사용자가 작성한 게시글 목록 조회
 */
export const getUserPosts = async (
  userId: string, 
  page = 1, 
  pageSize = 10,
  sortBy: 'latest' | 'popular' = 'latest'
): Promise<{ posts: Post[], totalCount: number, hasMore: boolean }> => {
  try {
    if (!userId) {
      return {
        posts: [],
        totalCount: 0,
        hasMore: false
      };
    }

    let postsQuery;
    
    if (sortBy === 'latest') {
      postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', userId),
        where('status.isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(pageSize * page)
      );
    } else {
      postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', userId),
        where('status.isDeleted', '==', false),
        orderBy('stats.likeCount', 'desc'),
        limit(pageSize * page)
      );
    }
    
    const querySnapshot = await getDocs(postsQuery);
    const posts: Post[] = [];
    
    // 게시판 정보 캐시
    const boardCache: { [key: string]: string } = {};
    // 학교 정보 캐시
    const schoolCache: { [key: string]: string } = {};
    
    for (const doc of querySnapshot.docs) {
      const postData = doc.data();
      
      // 게시판 이름 조회
      let boardName = postData.boardName || '게시판';
      
      // postData에 boardName이 없는 경우에만 조회
      if (!postData.boardName && postData.boardCode) {
        if (boardCache[postData.boardCode]) {
          boardName = boardCache[postData.boardCode];
        } else {
          try {
            const board = await getBoard(postData.boardCode);
            boardName = board?.name || `게시판 (${postData.boardCode})`;
            boardCache[postData.boardCode] = boardName;
          } catch (error) {
            console.error('게시판 정보 조회 실패:', error);
            boardName = postData.boardCode || '게시판';
          }
        }
      }
      
      // 학교 이름 조회 (학교 게시글인 경우)
      let schoolName = undefined;
      if (postData.type === 'school' && postData.schoolId) {
        if (schoolCache[postData.schoolId]) {
          schoolName = schoolCache[postData.schoolId];
        } else {
          try {
            const school = await getSchoolById(postData.schoolId);
            schoolName = school?.KOR_NAME || '학교';
            schoolCache[postData.schoolId] = schoolName;
          } catch (error) {
            console.error('학교 정보 조회 실패:', error);
            schoolName = '학교';
          }
        }
      }
      
      // 미리보기 콘텐츠 생성
      const previewContent = postData.content 
        ? postData.content.replace(/<[^>]*>/g, '').substring(0, 100)
        : '';
      
      posts.push({
        id: doc.id,
        title: postData.title,
        content: postData.content,
        authorId: postData.authorId,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
        boardCode: postData.boardCode,
        type: postData.type,
        schoolId: postData.schoolId,
        regions: postData.regions,
        attachments: postData.attachments || [],
        status: postData.status,
        stats: postData.stats,
        boardName,
        previewContent,
        schoolName
      } as Post);
    }
    
    // 전체 게시글 수 가져오기
    const countQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', userId),
      where('status.isDeleted', '==', false)
    );
    
    const countSnapshot = await getDocs(countQuery);
    const totalCount = countSnapshot.size;
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedPosts = posts.slice(startIndex, startIndex + pageSize);
    
    return {
      posts: paginatedPosts,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('사용자 게시글 목록 조회 오류:', error);
    throw new Error('게시글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자가 작성한 댓글 목록 조회
 */
export const getUserComments = async (
  userId: string,
  page = 1,
  pageSize = 10
): Promise<{ comments: Comment[], totalCount: number, hasMore: boolean }> => {
  try {
    if (!userId) {
      return {
        comments: [],
        totalCount: 0,
        hasMore: false
      };
    }
    
    // Firestore에서는 하위 컬렉션에 대한 전체 쿼리가 불가능하므로 
    // 실제 구현에서는 별도의 comments 컬렉션을 만들거나 다른 방법 필요
    // 여기서는 개념적으로 구현
    
    // 모든 게시글의 comments 하위 컬렉션을 조회해야 함
    // 실제로는 사용자의 댓글을 추적하는 별도 컬렉션을 사용하는 것이 좋음
    const postsRef = collection(db, 'posts');
    const postsSnapshot = await getDocs(postsRef);
    
    const allComments: Comment[] = [];
    
    // 각 게시글의 comments 하위 컬렉션 조회
    for (const postDoc of postsSnapshot.docs) {
      const commentsRef = collection(db, `posts/${postDoc.id}/comments`);
      const commentsQuery = query(
        commentsRef,
        where('authorId', '==', userId),
        where('status.isDeleted', '==', false),
        orderBy('createdAt', 'desc')
      );
      
      const commentsSnapshot = await getDocs(commentsQuery);
      
      for (const commentDoc of commentsSnapshot.docs) {
        const postData = postDoc.data();
        const commentData = commentDoc.data();
        
        // 게시판 이름 가져오기
        let boardName = postData.boardName || '게시판';
        
        // postData에 boardName이 없는 경우에만 조회
        if (!postData.boardName && postData.boardCode) {
          try {
            const boardRef = doc(db, 'boards', postData.boardCode);
            const boardDoc = await getDoc(boardRef);
            if (boardDoc.exists()) {
              boardName = boardDoc.data()?.name || postData.boardCode;
            } else {
              boardName = postData.boardCode;
            }
          } catch (error) {
            console.error('게시판 정보 조회 실패:', error);
            boardName = postData.boardCode || '게시판';
          }
        }
        
        allComments.push({ 
          id: commentDoc.id, 
          ...commentData,
          postId: postDoc.id,  // 명시적으로 postId 추가
          postData: {
            title: postData.title,
            type: postData.type,
            boardCode: postData.boardCode,
            boardName: boardName,
            schoolId: postData.schoolId,
            regions: postData.regions
          }
        } as any);
      }
    }
    
    // 생성일 기준 정렬 (최신 댓글이 위에)
    allComments.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
    
    // 페이징 처리
    const totalCount = allComments.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedComments = allComments.slice(startIndex, endIndex);
    
    return {
      comments: paginatedComments,
      totalCount,
      hasMore: totalCount > endIndex
    };
  } catch (error) {
    console.error('사용자 댓글 목록 조회 오류:', error);
    throw new Error('댓글 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

 