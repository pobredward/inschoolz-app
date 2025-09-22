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
  deleteDoc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { MealInfo, MealRequestParams, MealResponse, WeeklyMealPlan, MealSettings } from '../types';

/**
 * NEIS API 기본 설정
 */
const NEIS_API_CONFIG = {
  baseUrl: 'https://open.neis.go.kr/hub',
  serviceKey: process.env.EXPO_PUBLIC_NEIS_API_KEY || '', // Expo 환경변수
  endpoints: {
    mealInfo: '/mealServiceDietInfo'
  }
};

/**
 * NEIS API 응답 타입
 */
interface NeisApiResponse {
  mealServiceDietInfo?: Array<{
    head: Array<{ list_total_count: number; RESULT?: { CODE: string; MESSAGE: string } }>;
    row?: Array<{
      ATPT_OFCDC_SC_CODE: string; // 시도교육청코드
      ATPT_OFCDC_SC_NM: string;   // 시도교육청명
      SD_SCHUL_CODE: string;      // 표준학교코드
      SCHUL_NM: string;           // 학교명
      MMEAL_SC_CODE: string;      // 식사코드
      MMEAL_SC_NM: string;        // 식사명
      MLSV_YMD: string;           // 급식일자
      DDISH_NM: string;           // 요리명
      ORPLC_INFO: string;         // 원산지정보
      CAL_INFO: string;           // 칼로리정보
      NTR_INFO: string;           // 영양정보
      MLSV_FROM_YMD: string;      // 급식시작일자
      MLSV_TO_YMD: string;        // 급식종료일자
    }>;
  }>;
  // 에러 응답의 경우
  RESULT?: {
    CODE: string;
    MESSAGE: string;
  };
}

/**
 * 학교 정보 조회 (Firebase에서)
 */
export const getSchoolInfo = async (schoolId: string): Promise<{
  schoolCode: string | null;
  educationOfficeCode: string | null;
} | null> => {
  try {
    console.log('🏫 학교 정보 조회 시작:', schoolId);
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      const schoolData = schoolDoc.data();
      console.log('📋 학교 데이터 전체:', schoolData);
      
      const schoolCode = schoolData.ORIGINAL_CODE || schoolData.SD_SCHUL_CODE || schoolData.SCHUL_CODE || schoolData.SCHOOL_CODE || null;
      const educationOfficeCode = schoolData.ATPT_OFCDC_SC_CODE || null;
      
      console.log('🔑 추출된 학교 코드:', {
        schoolCode,
        educationOfficeCode,
        availableFields: Object.keys(schoolData).filter(key => 
          key.includes('CODE') || key.includes('SCHUL') || key.includes('OFCDC')
        )
      });
      
      return {
        schoolCode,
        educationOfficeCode
      };
    } else {
      console.error('❌ 학교 문서가 존재하지 않음:', schoolId);
    }
    
    return null;
  } catch (error) {
    console.error('학교 정보 조회 실패:', error);
    return null;
  }
};

/**
 * 학교 코드 조회 (하위 호환성을 위한 래퍼 함수)
 */
export const getSchoolCode = async (schoolId: string): Promise<string | null> => {
  const schoolInfo = await getSchoolInfo(schoolId);
  return schoolInfo?.schoolCode || null;
};

/**
 * NEIS API에서 급식 정보 조회
 */
const fetchMealsFromNeis = async (
  schoolCode: string,
  educationOfficeCode: string,
  startDate: string,
  endDate: string
): Promise<MealInfo[]> => {
  try {
    console.log('🌐 NEIS API 호출 준비:', {
      schoolCode,
      educationOfficeCode,
      startDate,
      endDate,
      apiKey: NEIS_API_CONFIG.serviceKey ? '✅ 설정됨' : '❌ 없음'
    });

    const params = new URLSearchParams({
      KEY: NEIS_API_CONFIG.serviceKey,
      Type: 'json',
      pIndex: '1',
      pSize: '1000',
      ATPT_OFCDC_SC_CODE: educationOfficeCode || '',
      SD_SCHUL_CODE: schoolCode,
      MLSV_FROM_YMD: startDate.replace(/-/g, ''),
      MLSV_TO_YMD: endDate.replace(/-/g, '')
    });

    const fullUrl = `${NEIS_API_CONFIG.baseUrl}${NEIS_API_CONFIG.endpoints.mealInfo}?${params}`;
    console.log('🔗 NEIS API 요청 URL:', fullUrl);

    const response = await fetch(fullUrl);

    console.log('📡 NEIS API 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ NEIS API 오류 응답:', errorText);
      throw new Error(`NEIS API 오류: ${response.status} - ${errorText}`);
    }

    const data: NeisApiResponse = await response.json();
    console.log('📦 NEIS API 응답 데이터:', JSON.stringify(data, null, 2));
    
    // NEIS API 에러 응답 체크
    if (data.RESULT) {
      console.error('❌ NEIS API 에러 응답:', data.RESULT);
      throw new Error(`NEIS API 에러: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE}`);
    }
    
    // NEIS API 응답 구조 상세 분석
    if (data.mealServiceDietInfo) {
      console.log('🔍 mealServiceDietInfo 구조 분석:', {
        length: data.mealServiceDietInfo.length,
        items: data.mealServiceDietInfo.map((item, index) => ({
          index,
          hasHead: !!item.head,
          hasRow: !!item.row,
          headCount: item.head?.length || 0,
          rowCount: item.row?.length || 0
        }))
      });

      // head 내부의 RESULT 체크 (첫 번째 요소에서)
      const headResult = data.mealServiceDietInfo[0]?.head?.find(h => h.RESULT)?.RESULT;
      if (headResult && headResult.CODE !== 'INFO-000') {
        console.error('❌ NEIS API head 에러:', headResult);
        throw new Error(`NEIS API 에러: ${headResult.CODE} - ${headResult.MESSAGE}`);
      }
    }
    
    // row 데이터를 찾기 위해 모든 배열 요소를 확인
    let mealRows: any[] = [];
    if (data.mealServiceDietInfo) {
      for (const item of data.mealServiceDietInfo) {
        if (item.row && item.row.length > 0) {
          mealRows = item.row;
          console.log(`✅ row 데이터 발견: ${mealRows.length}개`);
          break;
        }
      }
    }
    
    if (mealRows.length === 0) {
      console.log('ℹ️ 급식 데이터 없음:', {
        hasServiceDietInfo: !!data.mealServiceDietInfo,
        totalCount: data.mealServiceDietInfo?.[0]?.head?.find(h => h.list_total_count)?.list_total_count,
        fullResponse: data
      });
      
      // 데이터가 없는 경우 더 구체적인 메시지 제공
      const totalCount = data.mealServiceDietInfo?.[0]?.head?.find(h => h.list_total_count)?.list_total_count;
      if (totalCount === 0) {
        console.log('📅 해당 날짜에 급식 정보가 없습니다.');
      }
      
      return [];
    }

    const meals: MealInfo[] = [];
    
    console.log(`🍽️ 처리할 급식 데이터 ${mealRows.length}개 발견`);

    for (const row of mealRows) {
      // 메뉴 파싱 (HTML 태그 제거 및 알레르기 정보 분리)
      const menuText = row.DDISH_NM.replace(/<br\s*\/?>/gi, '\n');
      const menuItems = menuText
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);

      // 메뉴에서 알레르기 정보 제거 (숫자와 괄호 제거)
      const cleanMenu = menuItems.map(item => 
        item.replace(/\s*\([0-9,.\s]+\)/g, '').trim()
      );

      // 영양 정보는 제거됨

      // 식사 타입 변환
      let mealType: 'breakfast' | 'lunch' | 'dinner';
      switch (row.MMEAL_SC_CODE) {
        case '1':
          mealType = 'breakfast';
          break;
        case '2':
          mealType = 'lunch';
          break;
        case '3':
          mealType = 'dinner';
          break;
        default:
          mealType = 'lunch'; // 기본값
      }

      // 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
      const formattedDate = row.MLSV_YMD.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

      meals.push({
        id: `${schoolCode}_${row.MLSV_YMD}_${row.MMEAL_SC_CODE}`,
        schoolId: '', // 나중에 설정
        schoolName: row.SCHUL_NM,
        date: formattedDate,
        mealType,
        menu: cleanMenu,
        calories: row.CAL_INFO,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    console.log(`✅ ${meals.length}개의 급식 정보 파싱 완료`);
    return meals;
  } catch (error) {
    console.error('❌ NEIS API 급식 정보 조회 실패:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('급식 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
  }
};

/**
 * 급식 정보 조회 (NEIS API 직접 호출 - 캐싱 제거)
 */
export const getMeals = async (params: MealRequestParams): Promise<MealResponse> => {
  try {
    const { schoolId, startDate, endDate, mealType } = params;
    console.log('🔍 급식 정보 조회 시작:', params);

    // 1. 학교 정보 조회
    const schoolInfo = await getSchoolInfo(schoolId);
    if (!schoolInfo?.schoolCode) {
      console.error('❌ 학교 코드를 찾을 수 없음:', schoolInfo);
      throw new Error('학교 정보를 찾을 수 없습니다.');
    }

    // 2. NEIS API에서 직접 조회
    console.log('🌐 NEIS API에서 데이터 조회 중...');
    const neisData = await fetchMealsFromNeis(
      schoolInfo.schoolCode,
      schoolInfo.educationOfficeCode || '',
      startDate,
      endDate
    );
    
    // 3. schoolId 설정
    const mealsWithSchoolId = neisData.map(meal => ({
      ...meal,
      schoolId
    }));

    // 4. 필터링 (mealType이 지정된 경우)
    const filteredMeals = mealType 
      ? mealsWithSchoolId.filter(meal => meal.mealType === mealType)
      : mealsWithSchoolId;

    console.log(`✅ ${filteredMeals.length}개의 급식 정보 조회 완료`);

    return {
      success: true,
      data: filteredMeals,
      totalCount: filteredMeals.length
    };

  } catch (error) {
    console.error('급식 정보 조회 실패:', error);
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '급식 정보 조회에 실패했습니다.',
      totalCount: 0
    };
  }
};

/**
 * 주간 급식 정보 조회
 */
export const getWeeklyMealPlan = async (
  schoolId: string,
  weekStart: string
): Promise<WeeklyMealPlan> => {
  // 주간 끝 날짜 계산
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  const weekEnd = endDate.toISOString().split('T')[0];

  const response = await getMeals({
    schoolId,
    startDate: weekStart,
    endDate: weekEnd
  });

  const meals: WeeklyMealPlan['meals'] = {};

  // 날짜별로 급식 정보 그룹화
  response.data.forEach(meal => {
    if (!meals[meal.date]) {
      meals[meal.date] = {};
    }
    meals[meal.date][meal.mealType] = meal;
  });

  return {
    weekStart,
    weekEnd,
    meals
  };
};

/**
 * 오늘의 급식 정보 조회
 */
export const getTodayMeals = async (schoolId: string): Promise<MealResponse> => {
  const today = new Date().toISOString().split('T')[0];
  
  return getMeals({
    schoolId,
    startDate: today,
    endDate: today
  });
};

/**
 * 사용자 급식 설정 조회
 */
export const getMealSettings = async (userId: string): Promise<MealSettings | null> => {
  try {
    const settingsRef = doc(db, 'mealSettings', userId);
    const settingsDoc = await getDoc(settingsRef);

    if (settingsDoc.exists()) {
      return { id: settingsDoc.id, ...settingsDoc.data() } as MealSettings;
    }

    return null;
  } catch (error) {
    console.error('급식 설정 조회 실패:', error);
    return null;
  }
};

/**
 * 사용자 급식 설정 저장/업데이트
 */
export const updateMealSettings = async (
  userId: string,
  settings: Partial<MealSettings>
): Promise<boolean> => {
  try {
    const settingsRef = doc(db, 'mealSettings', userId);
    const settingsData = {
      ...settings,
      userId,
      updatedAt: serverTimestamp()
    };

    const existingDoc = await getDoc(settingsRef);
    
    if (existingDoc.exists()) {
      await updateDoc(settingsRef, settingsData);
    } else {
      await updateDoc(settingsRef, {
        ...settingsData,
        createdAt: serverTimestamp()
      });
    }

    return true;
  } catch (error) {
    console.error('급식 설정 저장 실패:', error);
    return false;
  }
};

/**
 * 급식 정보 캐시 삭제 (관리자용)
 */
export const clearMealCache = async (schoolId: string, date?: string): Promise<boolean> => {
  try {
    const mealsRef = collection(db, 'meals');
    let q = query(mealsRef, where('schoolId', '==', schoolId));

    if (date) {
      q = query(mealsRef, where('schoolId', '==', schoolId), where('date', '==', date));
    }

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error('급식 캐시 삭제 실패:', error);
    return false;
  }
};
