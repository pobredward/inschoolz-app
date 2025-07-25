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
  Timestamp,
  QueryConstraint,
  FieldValue
} from 'firebase/firestore';
import { db } from './firebase';
import { User, FirebaseTimestamp } from '../types'; // 통일된 타입 사용
import { EnhancedAdminUserListParams, AdminActionLog, SuspensionSettings } from '../types/admin';
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
  attachments?: unknown[];
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
 * 개선된 관리자용 사용자 목록 조회 (다중 필드 검색 지원)
 */
export const getEnhancedUsersList = async (params: EnhancedAdminUserListParams = {}): Promise<AdminUserListResponse> => {
  try {
    const {
      page = 1,
      pageSize = 20,
      search = '',
      searchType = 'all',
      role = 'all',
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateRange,
      levelRange,
      experienceRange,
      regions,
      hasWarnings
    } = params;

    const usersRef = collection(db, 'users');
    const constraints: QueryConstraint[] = [];

    // 역할 필터
    if (role !== 'all') {
      constraints.push(where('role', '==', role));
    }

    // 상태 필터
    if (status !== 'all') {
      constraints.push(where('status', '==', status));
    }

    // 검색 조건 (다중 필드 지원)
    if (search.trim()) {
      const searchTerm = search.trim();
      
      if (searchType === 'all') {
        // 모든 필드에서 검색 (OR 조건)
        // Firestore의 제한으로 인해 클라이언트 측에서 필터링
        // 서버에서는 userName으로만 검색하고 클라이언트에서 추가 필터링
        constraints.push(where('profile.userName', '>=', searchTerm));
        constraints.push(where('profile.userName', '<=', searchTerm + '\uf8ff'));
      } else if (searchType === 'userName') {
        constraints.push(where('profile.userName', '>=', searchTerm));
        constraints.push(where('profile.userName', '<=', searchTerm + '\uf8ff'));
      } else if (searchType === 'realName') {
        constraints.push(where('profile.realName', '>=', searchTerm));
        constraints.push(where('profile.realName', '<=', searchTerm + '\uf8ff'));
      } else if (searchType === 'email') {
        constraints.push(where('email', '>=', searchTerm.toLowerCase()));
        constraints.push(where('email', '<=', searchTerm.toLowerCase() + '\uf8ff'));
      } else if (searchType === 'school') {
        constraints.push(where('school.name', '>=', searchTerm));
        constraints.push(where('school.name', '<=', searchTerm + '\uf8ff'));
      }
    }

    // 날짜 범위 필터
    if (dateRange) {
      if (dateRange.from) {
        constraints.push(where('createdAt', '>=', Timestamp.fromDate(dateRange.from)));
      }
      if (dateRange.to) {
        constraints.push(where('createdAt', '<=', Timestamp.fromDate(dateRange.to)));
      }
    }

    // 레벨 범위 필터
    if (levelRange) {
      if (levelRange.min) {
        constraints.push(where('stats.level', '>=', levelRange.min));
      }
      if (levelRange.max) {
        constraints.push(where('stats.level', '<=', levelRange.max));
      }
    }

    // 경험치 범위 필터
    if (experienceRange) {
      if (experienceRange.min) {
        constraints.push(where('stats.totalExperience', '>=', experienceRange.min));
      }
      if (experienceRange.max) {
        constraints.push(where('stats.totalExperience', '<=', experienceRange.max));
      }
    }

    // 지역 필터
    if (regions) {
      if (regions.sido) {
        constraints.push(where('regions.sido', '==', regions.sido));
      }
      if (regions.sigungu) {
        constraints.push(where('regions.sigungu', '==', regions.sigungu));
      }
    }

    // 경고 여부 필터
    if (hasWarnings !== undefined) {
      if (hasWarnings) {
        constraints.push(where('warnings.count', '>', 0));
      } else {
        constraints.push(where('warnings.count', '==', 0));
      }
    }

    // 정렬 추가
    constraints.push(orderBy(sortBy, sortOrder));

    // 페이지네이션
    const offset = (page - 1) * pageSize;
    constraints.push(limit(pageSize + offset));

    const q = query(usersRef, ...constraints);
    const querySnapshot = await getDocs(q);
    let allUsers: User[] = [];
    
    querySnapshot.forEach((doc) => {
      allUsers.push({ 
        uid: doc.id, 
        ...doc.data() 
      } as User);
    });

    // 클라이언트 측 추가 필터링 (다중 필드 검색용)
    if (search.trim() && searchType === 'all') {
      const searchTerm = search.trim().toLowerCase();
      allUsers = allUsers.filter(user => {
        const userName = user.profile?.userName?.toLowerCase() || '';
        const realName = user.profile?.realName?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const schoolName = user.school?.name?.toLowerCase() || '';
        
        return userName.includes(searchTerm) || 
               realName.includes(searchTerm) || 
               email.includes(searchTerm) || 
               schoolName.includes(searchTerm);
      });
    }

    // 페이지네이션 적용
    const users = allUsers.slice(offset, offset + pageSize);

    // 전체 개수 조회 (필터 조건 적용)
    const countConstraints = constraints.slice(0, -2); // 마지막 2개(orderBy, limit) 제거
    const countQuery = countConstraints.length > 0 
      ? query(usersRef, ...countConstraints)
      : query(usersRef);
    const countSnapshot = await getCountFromServer(countQuery);
    const totalCount = countSnapshot.data().count;

    return {
      users,
      totalCount,
      hasMore: totalCount > page * pageSize,
      currentPage: page
    };
  } catch (error) {
    console.error('개선된 사용자 목록 조회 오류:', error);
    throw new Error('사용자 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자 작업 로그 기록
 */
export const logAdminAction = async (actionData: Omit<AdminActionLog, 'id' | 'timestamp'>): Promise<void> => {
  try {
    await addDoc(collection(db, 'adminActionLogs'), {
      ...actionData,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('관리자 작업 로그 기록 오류:', error);
    // 로그 기록 실패는 주요 작업을 중단시키지 않음
  }
};

/**
 * 개선된 사용자 상태 변경 (정지 기간 지원)
 */
export const updateUserStatusEnhanced = async (
  userId: string, 
  newStatus: 'active' | 'inactive' | 'suspended', 
  settings?: SuspensionSettings,
  adminId?: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data() as User;
    const oldStatus = userData.status;

    const updateData: Record<string, FieldValue | string | number | boolean | object | null> = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };

    if (newStatus === 'suspended' && settings) {
      updateData.suspensionReason = settings.reason;
      updateData.suspendedAt = serverTimestamp();
      
      if (settings.type === 'temporary' && settings.duration) {
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + settings.duration);
        updateData.suspendedUntil = Timestamp.fromDate(suspendedUntil);
        updateData.autoRestore = settings.autoRestore;
      }
      
      updateData.notifyUser = settings.notifyUser;
    } else if (newStatus === 'active') {
      // 정지 해제 시 관련 필드 정리
      updateData.suspensionReason = null;
      updateData.suspendedAt = null;
      updateData.suspendedUntil = null;
      updateData.autoRestore = null;
    }

    await updateDoc(userRef, updateData);

    // 정지 알림 발송
    if (newStatus === 'suspended' && settings && settings.notifyUser) {
      try {
        const { createSanctionNotification } = await import('./notifications');
        
        let duration = '';
        if (settings.type === 'temporary' && settings.duration) {
          duration = `${settings.duration}일`;
        } else if (settings.type === 'permanent') {
          duration = '영구';
        }

        await createSanctionNotification(
          userId,
          'suspension',
          settings.reason,
          duration
        );

        console.log('정지 알림 발송 완료:', userId);
      } catch (notificationError) {
        console.error('정지 알림 발송 실패:', notificationError);
        // 알림 발송 실패는 정지 처리 자체를 실패시키지 않음
      }
    }

    // 관리자 작업 로그 기록
    await logAdminAction({
      adminId: adminId || 'current_admin',
      adminName: 'Admin',
      action: 'status_change',
      targetUserId: userId,
      targetUserName: userData.profile?.userName || userData.email || '',
      oldValue: oldStatus || 'active',
      newValue: newStatus,
      reason: settings?.reason
    });

    console.log('사용자 상태 업데이트 완료:', { userId, oldStatus, newStatus });
  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 기존 관리자용 사용자 목록 조회 (호환성 유지)
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
    const constraints: QueryConstraint[] = [];

    // 역할 필터
    if (role !== 'all') {
      constraints.push(where('role', '==', role));
    }

    // 상태 필터
    if (status !== 'all') {
      constraints.push(where('status', '==', status));
    }

    // 검색 (userName 기준)
    if (search) {
      constraints.push(where('profile.userName', '>=', search));
      constraints.push(where('profile.userName', '<=', search + '\uf8ff'));
    }

    // 정렬
    constraints.push(orderBy(sortBy, sortOrder));

    // 페이지네이션
    const offset = (page - 1) * pageSize;
    constraints.push(limit(pageSize + offset));

    const q = query(usersRef, ...constraints);
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
export const addUserWarning = async (userId: string, reason: string): Promise<void> => {
  try {
    // 경고 추가
    await addDoc(collection(db, 'users', userId, 'warningHistory'), {
      reason,
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

// UserRelationship 타입 정의 (차단/팔로우 관계)
interface UserRelationship {
  id?: string;
  userId: string;
  targetId: string;
  type: 'follow' | 'block';
  status: 'active' | 'inactive';
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

/**
 * 차단 상태 확인
 */
export const checkBlockStatus = async (
  userId: string,
  targetId: string
): Promise<boolean> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'block'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('차단 상태 확인 오류:', error);
    throw new Error('차단 상태를 확인하는 중 오류가 발생했습니다.');
  }
};

/**
 * 차단/차단해제 토글
 */
export const toggleBlock = async (
  userId: string,
  targetId: string
): Promise<{ isBlocked: boolean }> => {
  try {
    // 자기 자신을 차단할 수 없음
    if (userId === targetId) {
      throw new Error('자기 자신을 차단할 수 없습니다.');
    }
    
    // 대상 사용자 존재 여부 확인
    const targetUser = await getUserById(targetId);
    if (!targetUser) {
      throw new Error('존재하지 않는 사용자입니다.');
    }
    
    // 현재 차단 상태 확인
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'block')
    );
    
    const querySnapshot = await getDocs(q);
    
    // 차단 관계가 존재하면 상태 변경
    if (!querySnapshot.empty) {
      const relationshipDoc = querySnapshot.docs[0];
      const relationship = relationshipDoc.data() as UserRelationship;
      
      if (relationship.status === 'active') {
        // 활성 상태면 비활성화 (차단 해제)
        await updateDoc(doc(db, 'userRelationships', relationshipDoc.id), {
          status: 'inactive',
          updatedAt: serverTimestamp()
        });
        return { isBlocked: false };
      } else {
        // 비활성 상태면 활성화 (다시 차단)
        await updateDoc(doc(db, 'userRelationships', relationshipDoc.id), {
          status: 'active',
          updatedAt: serverTimestamp()
        });
        return { isBlocked: true };
      }
    } else {
      // 차단 관계가 없으면 새로 생성
      const newRelationship: Omit<UserRelationship, 'id'> = {
        userId,
        targetId,
        type: 'block',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const relationshipRef = await addDoc(relationshipsRef, newRelationship);
      
      // ID 업데이트
      await updateDoc(relationshipRef, {
        id: relationshipRef.id
      });
      
      return { isBlocked: true };
    }
  } catch (error) {
    console.error('차단 토글 오류:', error);
    throw new Error('차단 상태를 변경하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자가 차단한 사용자 ID 목록만 빠르게 조회
 */
export const getBlockedUserIds = async (userId: string): Promise<string[]> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'block'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().targetId);
  } catch (error) {
    console.error('차단된 사용자 ID 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 사용자가 차단한 사용자 목록 조회
 */
export const getBlockedUsers = async (
  userId: string,
  page = 1,
  pageSize = 20
): Promise<{ users: User[]; totalCount: number; hasMore: boolean }> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'block'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize * page)
    );
    
    const querySnapshot = await getDocs(q);
    const relationships = querySnapshot.docs.map(doc => doc.data() as UserRelationship);
    
    // 차단된 사용자 정보 조회
    const users: User[] = [];
    for (const relationship of relationships) {
      const user = await getUserById(relationship.targetId);
      if (user) {
        users.push({
          ...user,
          // 차단 날짜 추가
          blockedAt: relationship.createdAt
        } as User & { blockedAt: any });
      }
    }
    
    // 전체 차단 사용자 수 조회
    const countQuery = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'block'),
      where('status', '==', 'active')
    );
    const countSnapshot = await getDocs(countQuery);
    const totalCount = countSnapshot.size;
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);
    
    return {
      users: paginatedUsers,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('차단된 사용자 목록 조회 오류:', error);
    throw new Error('차단된 사용자 목록을 조회하는 중 오류가 발생했습니다.');
  }
}; 

// 기존 getUserById 함수 개선
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    return {
      uid: userDoc.id,
      ...userData
    } as User;
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    throw new Error('사용자 정보를 조회하는 중 오류가 발생했습니다.');
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
 * 팔로우 상태 확인
 */
export const checkFollowStatus = async (userId: string, targetId: string): Promise<boolean> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'follow'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('팔로우 상태 확인 오류:', error);
    return false;
  }
};

/**
 * 팔로워 수 조회
 */
export const getFollowersCount = async (userId: string): Promise<number> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('targetId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('팔로워 수 조회 오류:', error);
    return 0;
  }
};

/**
 * 팔로잉 수 조회
 */
export const getFollowingCount = async (userId: string): Promise<number> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('팔로잉 수 조회 오류:', error);
    return 0;
  }
};

/**
 * 팔로워 목록 조회
 */
export const getFollowers = async (
  userId: string,
  page = 1,
  pageSize = 20
): Promise<{ users: User[], totalCount: number, hasMore: boolean }> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('targetId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize * page)
    );
    
    const querySnapshot = await getDocs(q);
    const relationships = querySnapshot.docs.map(doc => doc.data() as UserRelationship);
    
    // 팔로워 사용자 정보 조회
    const users: User[] = [];
    for (const relationship of relationships) {
      const user = await getUserById(relationship.userId);
      if (user) {
        users.push(user);
      }
    }
    
    // 전체 팔로워 수 조회
    const totalCount = await getFollowersCount(userId);
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);
    
    return {
      users: paginatedUsers,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('팔로워 목록 조회 오류:', error);
    throw new Error('팔로워 목록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 팔로잉 목록 조회
 */
export const getFollowings = async (
  userId: string,
  page = 1,
  pageSize = 20
): Promise<{ users: User[], totalCount: number, hasMore: boolean }> => {
  try {
    const relationshipsRef = collection(db, 'userRelationships');
    const q = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('type', '==', 'follow'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize * page)
    );
    
    const querySnapshot = await getDocs(q);
    const relationships = querySnapshot.docs.map(doc => doc.data() as UserRelationship);
    
    // 팔로잉 사용자 정보 조회
    const users: User[] = [];
    for (const relationship of relationships) {
      const user = await getUserById(relationship.targetId);
      if (user) {
        users.push(user);
      }
    }
    
    // 전체 팔로잉 수 조회
    const totalCount = await getFollowingCount(userId);
    
    // 페이징 처리
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);
    
    return {
      users: paginatedUsers,
      totalCount,
      hasMore: totalCount > page * pageSize
    };
  } catch (error) {
    console.error('팔로잉 목록 조회 오류:', error);
    throw new Error('팔로잉 목록을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 팔로우/언팔로우 토글
 */
export const toggleFollow = async (userId: string, targetId: string): Promise<void> => {
  try {
    if (userId === targetId) {
      throw new Error('자기 자신을 팔로우할 수 없습니다.');
    }

    const relationshipsRef = collection(db, 'userRelationships');
    
    // 기존 관계 확인
    const existingQuery = query(
      relationshipsRef,
      where('userId', '==', userId),
      where('targetId', '==', targetId),
      where('type', '==', 'follow')
    );
    
    const existingSnapshot = await getDocs(existingQuery);
    
    if (existingSnapshot.empty) {
      // 팔로우 관계 생성
      await addDoc(relationshipsRef, {
        userId,
        targetId,
        type: 'follow',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // 기존 관계 토글
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      
      if (existingData.status === 'active') {
        // 언팔로우
        await updateDoc(existingDoc.ref, {
          status: 'inactive',
          updatedAt: serverTimestamp()
        });
      } else {
        // 재팔로우
        await updateDoc(existingDoc.ref, {
          status: 'active',
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('팔로우 토글 오류:', error);
    throw new Error('팔로우 상태를 변경하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 게시글 조회
 */
export const getUserPosts = async (
  userId: string,
  page = 1,
  pageSize = 10,
  sortBy: 'latest' | 'popular' = 'latest'
): Promise<{ posts: any[], totalCount: number, hasMore: boolean }> => {
  try {
    // TODO: 실제 게시글 조회 로직 구현
    // 현재는 빈 배열 반환
    return {
      posts: [],
      totalCount: 0,
      hasMore: false
    };
  } catch (error) {
    console.error('사용자 게시글 조회 오류:', error);
    throw new Error('게시글을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 댓글 조회
 */
export const getUserComments = async (
  userId: string,
  page = 1,
  pageSize = 10
): Promise<{ comments: any[], totalCount: number, hasMore: boolean }> => {
  try {
    // TODO: 실제 댓글 조회 로직 구현
    // 현재는 빈 배열 반환
    return {
      comments: [],
      totalCount: 0,
      hasMore: false
    };
  } catch (error) {
    console.error('사용자 댓글 조회 오류:', error);
    throw new Error('댓글을 조회하는 중 오류가 발생했습니다.');
  }
};

/**
 * 이메일 중복 확인 함수
 * @param email 확인할 이메일 주소
 * @returns 사용 가능 여부와 메시지
 */
export const checkEmailAvailability = async (email: string): Promise<{
  isAvailable: boolean;
  message: string;
}> => {
  try {
    if (!email || email.trim() === '') {
      return { isAvailable: false, message: '이메일을 입력해주세요.' };
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isAvailable: false, message: '올바른 이메일 형식이 아닙니다.' };
    }

    // Firestore에서 중복 확인
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('email', '==', email.trim().toLowerCase()),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { isAvailable: false, message: '이미 가입된 이메일 주소입니다.' };
    }

    return { isAvailable: true, message: '사용 가능한 이메일입니다.' };
  } catch (error) {
    console.error('이메일 중복 확인 오류:', error);
    return { isAvailable: false, message: '이메일 확인 중 오류가 발생했습니다.' };
  }
};

/**
 * userName 중복 확인 함수
 * @param userName 확인할 사용자명
 * @returns 사용 가능 여부와 메시지
 */
export const checkUserNameAvailability = async (userName: string): Promise<{
  isAvailable: boolean;
  message: string;
}> => {
  try {
    if (!userName || userName.trim() === '') {
      return { isAvailable: false, message: '사용자명을 입력해주세요.' };
    }

    // 사용자명 유효성 검증
    if (userName.length < 5 || userName.length > 20) {
      return { isAvailable: false, message: '사용자명은 5-20자 사이여야 합니다.' };
    }

    if (!/^[a-z0-9]+$/.test(userName)) {
      return { isAvailable: false, message: '사용자명은 영문 소문자와 숫자만 사용 가능합니다.' };
    }

    // Firestore에서 중복 확인
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('profile.userName', '==', userName.trim()),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { isAvailable: false, message: '이미 사용 중인 사용자명입니다.' };
    }

    return { isAvailable: true, message: '사용 가능한 사용자명입니다.' };
  } catch (error) {
    console.error('사용자명 중복 확인 오류:', error);
    return { isAvailable: false, message: '사용자명 확인 중 오류가 발생했습니다.' };
  }
}; 

/**
 * 추천인 아이디 존재 여부 확인 함수
 * @param userName 확인할 추천인 아이디
 * @returns 존재 여부와 사용자 정보
 */
export const checkReferralExists = async (userName: string): Promise<{ 
  exists: boolean; 
  displayName?: string;
  userName?: string;
}> => {
  try {
    if (!userName || userName.trim() === '') {
      return { exists: false };
    }

    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('profile.userName', '==', userName.trim()),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return { 
        exists: true, 
        displayName: userData.profile.userName || '사용자',
        userName: userData.profile.userName
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('추천 아이디 확인 오류:', error);
    return { exists: false };
  }
}; 

 