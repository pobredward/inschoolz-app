import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc,
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  startAfter,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

export interface School {
  id: string;
  KOR_NAME: string;
  ADDRESS: string;
  REGION?: string;
  HOMEPAGE?: string;
  memberCount?: number;
  favoriteCount?: number;
}

/**
 * 학교 즐겨찾기 토글
 */
export const toggleFavoriteSchool = async (
  userId: string,
  schoolId: string
): Promise<{
  success: boolean;
  isFavorite: boolean;
  message?: string;
  favoriteCount?: number;
}> => {
  try {
    // 사용자 문서 참조
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const favorites = userData.favorites || {};
    const favoriteSchools = favorites.schools || [];
    
    // 학교가 이미 즐겨찾기에 있는지 확인
    const isAlreadyFavorite = favoriteSchools.includes(schoolId);
    
    let updatedFavoriteSchools;
    let message: string;
    
    if (isAlreadyFavorite) {
      // 즐겨찾기 제거
      updatedFavoriteSchools = favoriteSchools.filter((id: string) => id !== schoolId);
      message = '즐겨찾기에서 제거되었습니다.';
    } else {
      // 즐겨찾기 추가 - 5개 제한 체크
      if (favoriteSchools.length >= 5) {
        return {
          success: false,
          isFavorite: false,
          message: '즐겨찾기는 최대 5개 학교까지만 추가할 수 있습니다. 다른 학교를 제거한 후 다시 시도해주세요.',
          favoriteCount: favoriteSchools.length
        };
      }
      
      updatedFavoriteSchools = [...favoriteSchools, schoolId];
      message = '즐겨찾기에 추가되었습니다.';
    }
    
    // 사용자 문서 업데이트
    await updateDoc(userRef, {
      'favorites.schools': updatedFavoriteSchools,
      updatedAt: serverTimestamp()
    });
    
    // 학교 문서의 즐겨찾기 카운트 업데이트
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      const schoolData = schoolDoc.data();
      const currentFavoriteCount = schoolData.favoriteCount || 0;
      
      await updateDoc(schoolRef, {
        favoriteCount: isAlreadyFavorite ? Math.max(0, currentFavoriteCount - 1) : currentFavoriteCount + 1
      });
    }
    
    return {
      success: true,
      isFavorite: !isAlreadyFavorite,
      message,
      favoriteCount: updatedFavoriteSchools.length
    };
  } catch (error) {
    console.error('학교 즐겨찾기 토글 오류:', error);
    return {
      success: false,
      isFavorite: false,
      message: '즐겨찾기를 변경하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자가 특정 학교 커뮤니티에 접근할 수 있는지 확인
 */
export const checkSchoolAccess = async (
  userId: string,
  schoolId: string
): Promise<{
  hasAccess: boolean;
  reason?: string;
}> => {
  try {
    // 사용자 문서 참조
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        hasAccess: false,
        reason: '사용자 정보를 찾을 수 없습니다.'
      };
    }
    
    const userData = userDoc.data();
    const favorites = userData.favorites || {};
    const favoriteSchools = favorites.schools || [];
    
    // 즐겨찾기에 해당 학교가 있는지 확인
    const hasSchoolInFavorites = favoriteSchools.includes(schoolId);
    
    if (!hasSchoolInFavorites) {
      return {
        hasAccess: false,
        reason: '이 학교 커뮤니티에 접근하려면 먼저 즐겨찾기에 추가해주세요.'
      };
    }
    
    return {
      hasAccess: true
    };
  } catch (error) {
    console.error('학교 접근 권한 확인 오류:', error);
    return {
      hasAccess: false,
      reason: '접근 권한을 확인하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자의 즐겨찾기 학교 목록 가져오기 (메인 학교 자동 추가 포함)
 */
export const getUserFavoriteSchools = async (userId: string): Promise<School[]> => {
  try {
    // 사용자 문서에서 즐겨찾기 학교 ID 목록 조회
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const favorites = userData.favorites || {};
    let favoriteSchoolIds = favorites.schools || [];
    
    // 메인 학교가 설정되어 있는데 즐겨찾기에 없는 경우 자동으로 추가
    const mainSchoolId = userData.school?.id;
    if (mainSchoolId && !favoriteSchoolIds.includes(mainSchoolId)) {
      console.log('메인 학교가 즐겨찾기에 없어서 자동 추가:', mainSchoolId);
      
      favoriteSchoolIds = [...favoriteSchoolIds, mainSchoolId];
      
      // Firestore에 업데이트
      await updateDoc(userRef, {
        'favorites.schools': favoriteSchoolIds,
        updatedAt: serverTimestamp()
      });
      
      // 학교의 즐겨찾기 카운트도 증가
      try {
        const schoolRef = doc(db, 'schools', mainSchoolId);
        const schoolDoc = await getDoc(schoolRef);
        
        if (schoolDoc.exists()) {
          const schoolData = schoolDoc.data();
          const currentFavoriteCount = schoolData.favoriteCount || 0;
          
          await updateDoc(schoolRef, {
            favoriteCount: currentFavoriteCount + 1
          });
        }
      } catch (schoolUpdateError) {
        console.error('학교 즐겨찾기 카운트 업데이트 오류:', schoolUpdateError);
      }
    }
    
    if (favoriteSchoolIds.length === 0) {
      return [];
    }
    
    // 즐겨찾기 학교 정보 조회
    const favoriteSchools: School[] = [];
    
    for (const schoolId of favoriteSchoolIds) {
      const school = await getSchoolById(schoolId);
      if (school) {
        favoriteSchools.push(school);
      }
    }
    
    return favoriteSchools;
  } catch (error) {
    console.error('즐겨찾기 학교 목록 조회 오류:', error);
    throw new Error('즐겨찾기 학교 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 학교 상세 정보 조회
 */
export const getSchoolById = async (schoolId: string): Promise<School | null> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      const schoolData = schoolDoc.data();
      
      return {
        id: schoolDoc.id,
        KOR_NAME: schoolData.KOR_NAME,
        ADDRESS: schoolData.ADDRESS,
        REGION: schoolData.REGION,
        HOMEPAGE: schoolData.HOMEPAGE,
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0
      } as School;
    } else {
      return null;
    }
  } catch (error) {
    console.error('학교 정보 조회 오류:', error);
    throw new Error('학교 정보를 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 학교 검색
 */
export const searchSchools = async (searchTerm: string): Promise<School[]> => {
  try {
    const q = query(
      collection(db, 'schools'),
      where('KOR_NAME', '>=', searchTerm),
      where('KOR_NAME', '<=', searchTerm + '\uf8ff'),
      orderBy('KOR_NAME'),
      limit(20)
    );
    
    const querySnapshot = await getDocs(q);
    const schools: School[] = [];
    
    querySnapshot.forEach((doc) => {
      const schoolData = doc.data();
      schools.push({
        id: doc.id,
        KOR_NAME: schoolData.KOR_NAME,
        ADDRESS: schoolData.ADDRESS,
        REGION: schoolData.REGION,
        HOMEPAGE: schoolData.HOMEPAGE,
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0
      });
    });
    
    return schools;
  } catch (error) {
    console.error('학교 검색 오류:', error);
    throw new Error('학교를 검색하는 중 오류가 발생했습니다.');
  }
};

/**
 * 메인 학교 설정
 */
export const setMainSchool = async (userId: string, schoolId: string): Promise<{
  success: boolean;
  updatedUser?: any;
}> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const favorites = userData.favorites || {};
    const favoriteSchools = favorites.schools || [];
    
    // 해당 학교가 즐겨찾기에 있는지 확인
    if (!favoriteSchools.includes(schoolId)) {
      throw new Error('즐겨찾기에 없는 학교는 메인 학교로 설정할 수 없습니다.');
    }
    
    // 학교 정보 가져오기
    const school = await getSchoolById(schoolId);
    if (!school) {
      throw new Error('학교 정보를 찾을 수 없습니다.');
    }
    
    // 이전 메인 학교 ID 확인
    const previousSchoolId = userData.school?.id;
    
    // 업데이트할 학교 데이터
    const updatedSchoolData = {
      id: schoolId,
      name: school.KOR_NAME,
      grade: userData.school?.grade || '',
      classNumber: userData.school?.classNumber || '',
      studentNumber: userData.school?.studentNumber || '',
      isGraduate: userData.school?.isGraduate || false
    };
    
    // 메인 학교 설정 (올바른 경로로 수정)
    await updateDoc(userRef, {
      school: updatedSchoolData,
      updatedAt: serverTimestamp()
    });
    
    // 이전 학교와 현재 선택한 학교가 다른 경우 memberCount 업데이트
    if (previousSchoolId && previousSchoolId !== schoolId) {
      // 이전 학교의 회원 수 감소
      try {
        const prevSchoolRef = doc(db, 'schools', previousSchoolId);
        const prevSchoolDoc = await getDoc(prevSchoolRef);
        
        if (prevSchoolDoc.exists()) {
          const prevSchoolData = prevSchoolDoc.data();
          const currentMemberCount = prevSchoolData.memberCount || 0;
          
          await updateDoc(prevSchoolRef, {
            memberCount: Math.max(0, currentMemberCount - 1),
            updatedAt: serverTimestamp()
          });
        }
      } catch (prevSchoolError) {
        console.error('이전 학교 memberCount 업데이트 오류:', prevSchoolError);
        // 이전 학교 업데이트 실패해도 메인 학교 설정은 성공으로 처리
      }
      
      // 새 학교의 회원 수 증가
      try {
        const newSchoolRef = doc(db, 'schools', schoolId);
        const newSchoolDoc = await getDoc(newSchoolRef);
        
        if (newSchoolDoc.exists()) {
          const newSchoolData = newSchoolDoc.data();
          const currentMemberCount = newSchoolData.memberCount || 0;
          
          await updateDoc(newSchoolRef, {
            memberCount: currentMemberCount + 1,
            updatedAt: serverTimestamp()
          });
        }
      } catch (newSchoolError) {
        console.error('새 학교 memberCount 업데이트 오류:', newSchoolError);
        // 새 학교 업데이트 실패해도 메인 학교 설정은 성공으로 처리
      }
    } else if (!previousSchoolId) {
      // 처음으로 메인 학교를 설정하는 경우, 해당 학교의 회원 수만 증가
      try {
        const schoolRef = doc(db, 'schools', schoolId);
        const schoolDoc = await getDoc(schoolRef);
        
        if (schoolDoc.exists()) {
          const schoolData = schoolDoc.data();
          const currentMemberCount = schoolData.memberCount || 0;
          
          await updateDoc(schoolRef, {
            memberCount: currentMemberCount + 1,
            updatedAt: serverTimestamp()
          });
        }
      } catch (schoolError) {
        console.error('학교 memberCount 업데이트 오류:', schoolError);
        // 학교 업데이트 실패해도 메인 학교 설정은 성공으로 처리
      }
    }
    
    // 업데이트된 사용자 데이터 반환
    const updatedUser = {
      ...userData,
      school: updatedSchoolData,
      updatedAt: serverTimestamp()
    };
    
    return {
      success: true,
      updatedUser
    };
  } catch (error) {
    console.error('메인 학교 설정 오류:', error);
    throw new Error('메인 학교를 설정하는 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자의 메인 학교 정보 가져오기
 */
export const getMainSchool = async (userId: string): Promise<School | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    const schoolId = userData.school?.id; // 올바른 경로로 수정
    
    if (!schoolId) {
      return null;
    }
    
    // 메인 학교 정보 조회
    const school = await getSchoolById(schoolId);
    return school;
  } catch (error) {
    console.error('메인 학교 정보 조회 오류:', error);
    return null;
  }
}; 

/**
 * 게시글 수 기준으로 인기 학교 목록 가져오기
 */
export const getPopularSchools = async (limit = 10): Promise<School[]> => {
  try {
    // posts 컬렉션에서 학교별 게시글 수 집계
    const postsRef = collection(db, 'posts');
    const postsQuery = query(postsRef, where('type', '==', 'school'));
    const postsSnapshot = await getDocs(postsQuery);
    
    // 학교별 게시글 수 카운트
    const schoolPostCounts = new Map<string, number>();
    
    postsSnapshot.forEach((doc) => {
      const postData = doc.data();
      const schoolId = postData.schoolId;
      
      if (schoolId) {
        const currentCount = schoolPostCounts.get(schoolId) || 0;
        schoolPostCounts.set(schoolId, currentCount + 1);
      }
    });
    
    // 게시글 수 기준으로 정렬 (내림차순)
    const sortedSchoolIds = Array.from(schoolPostCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([schoolId]) => schoolId);
    
    // 학교 정보 조회
    const popularSchools: School[] = [];
    
    for (const schoolId of sortedSchoolIds) {
      const school = await getSchoolById(schoolId);
      if (school) {
        // 앱의 School 타입에 맞게 변환
        popularSchools.push({
          id: school.id,
          KOR_NAME: school.KOR_NAME,
          ADDRESS: school.ADDRESS,
          REGION: school.REGION,
          HOMEPAGE: school.HOMEPAGE,
          memberCount: school.memberCount,
          favoriteCount: school.favoriteCount
        });
      }
    }
    
    return popularSchools;
  } catch (error) {
    console.error('인기 학교 목록 조회 오류:', error);
    // 오류 발생 시 memberCount 기준으로 인기 학교 반환
    try {
      const schoolsRef = collection(db, 'schools');
      const q = query(
        schoolsRef,
        orderBy('memberCount', 'desc'),
        limit(limit)
      );
      const querySnapshot = await getDocs(q);
      const schools: School[] = [];
      
      querySnapshot.forEach((doc) => {
        const schoolData = doc.data();
        if (schoolData.memberCount > 0) {
          schools.push({
            id: doc.id,
            KOR_NAME: schoolData.KOR_NAME,
            ADDRESS: schoolData.ADDRESS,
            REGION: schoolData.REGION,
            HOMEPAGE: schoolData.HOMEPAGE,
            memberCount: schoolData.memberCount || 0,
            favoriteCount: schoolData.favoriteCount || 0
          });
        }
      });
      
      return schools;
    } catch (fallbackError) {
      console.error('인기 학교 fallback 조회 오류:', fallbackError);
      return [];
    }
  }
};

/**
 * 게시글 수 기준으로 인기 지역 목록 가져오기
 */
export interface RegionInfo {
  sido: string;
  sigungu: string;
  postCount: number;
}

export const getPopularRegions = async (limit = 12): Promise<RegionInfo[]> => {
  try {
    // posts 컬렉션에서 지역별 게시글 수 집계
    const postsRef = collection(db, 'posts');
    const postsQuery = query(postsRef, where('type', '==', 'regional'));
    const postsSnapshot = await getDocs(postsQuery);
    
    // 지역별 게시글 수 카운트
    const regionPostCounts = new Map<string, RegionInfo>();
    
    postsSnapshot.forEach((doc) => {
      const postData = doc.data();
      const regions = postData.regions;
      
      if (regions?.sido && regions?.sigungu) {
        const regionKey = `${regions.sido}-${regions.sigungu}`;
        const currentInfo = regionPostCounts.get(regionKey);
        
        if (currentInfo) {
          currentInfo.postCount += 1;
        } else {
          regionPostCounts.set(regionKey, {
            sido: regions.sido,
            sigungu: regions.sigungu,
            postCount: 1
          });
        }
      }
    });
    
    // 게시글 수 기준으로 정렬 (내림차순)
    const sortedRegions = Array.from(regionPostCounts.values())
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);
    
    return sortedRegions;
  } catch (error) {
    console.error('인기 지역 목록 조회 오류:', error);
    return [];
  }
};

// 관리자용 학교 관리 함수들
export const adminGetAllSchools = async (): Promise<School[]> => {
  try {
    const schoolsRef = collection(db, 'schools');
    
    // 인덱스 기반 최적화된 쿼리: favoriteCount desc, memberCount desc 순으로 정렬
    const q = query(
      schoolsRef,
      orderBy('favoriteCount', 'desc'),
      orderBy('memberCount', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const schools: School[] = [];
    
    querySnapshot.forEach((doc) => {
      const schoolData = doc.data();
      const memberCount = schoolData.memberCount || 0;
      const favoriteCount = schoolData.favoriteCount || 0;
      
      // memberCount >= 1 또는 favoriteCount >= 1인 학교만 추가
      if (memberCount >= 1 || favoriteCount >= 1) {
        schools.push({
          id: doc.id,
          KOR_NAME: schoolData.KOR_NAME || schoolData.name,
          ADDRESS: schoolData.ADDRESS || schoolData.address,
          REGION: schoolData.REGION || schoolData.district,
          HOMEPAGE: schoolData.HOMEPAGE || schoolData.websiteUrl,
          memberCount,
          favoriteCount
        });
      }
    });
    
    // 이미 Firestore에서 정렬된 상태로 가져오므로 추가 정렬 불필요
    return schools;
  } catch (error) {
    console.error('관리자 학교 목록 조회 오류:', error);
    throw new Error('학교 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

export const adminSearchSchools = async (searchTerm: string): Promise<School[]> => {
  try {
    if (!searchTerm.trim()) {
      return adminGetAllSchools();
    }

    const schoolsRef = collection(db, 'schools');
    
    // KOR_NAME으로 시작하는 학교들만 Firebase에서 직접 검색
    const q = query(
      schoolsRef,
      where('KOR_NAME', '>=', searchTerm),
      where('KOR_NAME', '<', searchTerm + '\uf8ff'),
      orderBy('KOR_NAME'),
      limit(100) // 결과 수 제한으로 성능 최적화
    );

    const snapshot = await getDocs(q);
    const schools: School[] = [];

    snapshot.forEach((doc) => {
      const schoolData = doc.data();
      const schoolName = schoolData.KOR_NAME || schoolData.name || '';
      
      schools.push({
        id: doc.id,
        KOR_NAME: schoolName,
        ADDRESS: schoolData.ADDRESS || schoolData.address || '',
        REGION: schoolData.REGION || schoolData.district || '',
        HOMEPAGE: schoolData.HOMEPAGE || schoolData.websiteUrl || '',
        memberCount: schoolData.memberCount || 0,
        favoriteCount: schoolData.favoriteCount || 0
      });
    });

    // 학교명 기준으로 정확도 정렬
    return schools.sort((a, b) => {
      const aName = a.KOR_NAME || '';
      const bName = b.KOR_NAME || '';
      
      // 완전 매칭 우선
      const aExactMatch = aName === searchTerm ? 1 : 0;
      const bExactMatch = bName === searchTerm ? 1 : 0;
      if (aExactMatch !== bExactMatch) return bExactMatch - aExactMatch;
      
      // 즐겨찾기 수로 정렬
      const aFavorites = a.favoriteCount || 0;
      const bFavorites = b.favoriteCount || 0;
      if (aFavorites !== bFavorites) return bFavorites - aFavorites;
      
      // 멤버 수로 정렬
      return (b.memberCount || 0) - (a.memberCount || 0);
    });
  } catch (error) {
    console.error('학교 검색 오류:', error);
    throw new Error('학교 검색 중 오류가 발생했습니다.');
  }
};

export const adminCreateSchool = async (schoolData: Omit<School, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'schools'), {
      ...schoolData,
      memberCount: schoolData.memberCount || 0,
      favoriteCount: schoolData.favoriteCount || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('학교 생성 오류:', error);
    throw new Error('학교 생성 중 오류가 발생했습니다.');
  }
};

export const adminUpdateSchool = async (schoolId: string, schoolData: Partial<School>): Promise<void> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    await updateDoc(schoolRef, {
      ...schoolData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('학교 수정 오류:', error);
    throw new Error('학교 수정 중 오류가 발생했습니다.');
  }
};

export const adminDeleteSchool = async (schoolId: string): Promise<void> => {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    await deleteDoc(schoolRef);
  } catch (error) {
    console.error('학교 삭제 오류:', error);
    throw new Error('학교 삭제 중 오류가 발생했습니다.');
  }
}; 