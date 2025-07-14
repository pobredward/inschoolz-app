import { 
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';

export interface RegionOption {
  value: string;
  label: string;
}

/**
 * 모든 지역(시/도) 목록 가져오기
 */
export const getAllRegions = async (): Promise<string[]> => {
  try {
    const regionsRef = collection(db, 'regions');
    const querySnapshot = await getDocs(regionsRef);
    
    const regions: string[] = [];
    querySnapshot.forEach((doc) => {
      regions.push(doc.id);
    });
    
    return regions.sort();
  } catch (error) {
    console.error('지역 목록 조회 오류:', error);
    throw new Error('지역 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 시/도의 시/군/구 목록 가져오기
 */
export const getDistrictsByRegion = async (region: string): Promise<string[]> => {
  try {
    const regionRef = doc(db, 'regions', region);
    const regionDoc = await getDoc(regionRef);
    
    if (regionDoc.exists()) {
      const regionData = regionDoc.data();
      const sigunguData = regionData.sigungu || {};
      
      // sigungu 객체에서 값만 추출하여 반환
      return Object.values(sigunguData);
    } else {
      return [];
    }
  } catch (error) {
    console.error('시/군/구 목록 조회 오류:', error);
    throw new Error('시/군/구 목록을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 시/도 목록 조회 (옵션 형태)
 */
export const getSidoList = async (): Promise<RegionOption[]> => {
  try {
    const regionsRef = collection(db, 'regions');
    const regionsQuery = query(
      regionsRef,
      where('type', '==', 'sido'),
      orderBy('name', 'asc')
    );
    
    const regionsSnapshot = await getDocs(regionsQuery);
    const sidoList = regionsSnapshot.docs.map(doc => ({
      value: doc.id,
      label: doc.data().name
    }));
    
    return sidoList;
  } catch (error) {
    console.error('시/도 목록 조회 오류:', error);
    throw new Error('지역 정보를 불러오는데 실패했습니다.');
  }
};

/**
 * 시/군/구 목록 조회 (옵션 형태)
 * @param sidoCode 시/도 코드
 */
export const getSigunguList = async (sidoCode: string): Promise<RegionOption[]> => {
  try {
    if (!sidoCode) {
      return [];
    }
    
    const regionsRef = collection(db, 'regions');
    const regionsQuery = query(
      regionsRef,
      where('type', '==', 'sigungu'),
      where('parentCode', '==', sidoCode),
      orderBy('name', 'asc')
    );
    
    const regionsSnapshot = await getDocs(regionsQuery);
    const sigunguList = regionsSnapshot.docs.map(doc => ({
      value: doc.id,
      label: doc.data().name
    }));
    
    return sigunguList;
  } catch (error) {
    console.error('시/군/구 목록 조회 오류:', error);
    throw new Error('지역 정보를 불러오는데 실패했습니다.');
  }
}; 