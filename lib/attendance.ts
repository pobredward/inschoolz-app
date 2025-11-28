import { doc, getDoc, updateDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserAttendance, AttendanceLog, FirebaseTimestamp } from '../types';
import { awardExperience, getSystemSettings } from './experience';
import { getKoreanDateString } from '../utils/timeUtils';

/**
 * 출석체크 관련 타입 정의
 */
interface AttendanceRecord {
  userId: string;
  attendances: Record<string, boolean>;
  streak: number;
  lastAttendance: FirebaseTimestamp;
  monthlyLog: AttendanceLog;
}

// 타입 재export
export type { UserAttendance, AttendanceLog };

// 경험치 관련 상수는 시스템 설정에서 동적으로 가져옴
// const ATTENDANCE_XP = 10; // 제거됨 - 시스템 설정에서 가져옴
// const STREAK_7_XP = 50;   // 제거됨 - 시스템 설정에서 가져옴
// const STREAK_30_XP = 200; // 제거됨 - 시스템 설정에서 가져옴

/**
 * 연속 출석 일수에 따른 추가 경험치 계산
 * @param streak 연속 출석 일수
 * @param prevStreak 이전 연속 출석 일수
 * @param settings 시스템 설정
 * @returns 추가 경험치
 */
const calculateStreakBonus = (streak: number, prevStreak: number, settings: { attendanceBonus?: { weeklyBonusXP: number } }): number => {
  let bonus = 0;
  
  // Firebase 설정에서 보너스 값 가져오기
  const weeklyBonusXP = settings.attendanceBonus?.weeklyBonusXP || 50;
  const monthlyBonusXP = 200; // 30일 보너스는 기본값 유지 (Firebase에 없음)
  
  // 7일 연속 출석 보너스
  if (streak >= 7 && prevStreak < 7) {
    bonus += weeklyBonusXP;
  }
  
  // 30일 연속 출석 보너스
  if (streak >= 30 && prevStreak < 30) {
    bonus += monthlyBonusXP;
  }
  
  return bonus;
};

/**
 * 사용자 출석 체크 정보 조회 및 출석체크 처리
 * @param userId 사용자 ID
 * @param doCheck 출석체크 수행 여부 (true인 경우 출석체크 처리)
 * @returns 출석체크 정보 및 레벨업 여부
 */
export const checkAttendance = async (
  userId: string,
  doCheck: boolean = false
): Promise<UserAttendance> => {
  try {
    // userId 유효성 검사
    if (!userId || userId.trim() === '') {
      throw new Error('유효하지 않은 사용자 ID입니다.');
    }
    
    // 한국 시간 기준 날짜 문자열 가져오기 (통일된 함수 사용)
    const todayStr = getKoreanDateString();
    
    // 사용자 출석체크 데이터 조회
    const attendanceRef = doc(db, 'attendance', userId);
    const attendanceDoc = await getDoc(attendanceRef);
    
    if (!attendanceDoc.exists()) {
      // 출석체크 데이터가 없으면 새로 생성
      if (doCheck) {
        const newMonthlyLog: AttendanceLog = {
          [todayStr]: true
        };
        
        const newAttendance: AttendanceRecord = {
          userId,
          attendances: {
            [todayStr]: true
          },
          streak: 1,
          lastAttendance: serverTimestamp(),
          monthlyLog: newMonthlyLog
        };
        
        await setDoc(attendanceRef, newAttendance);
        
        // 첫 출석 경험치 추가 - 시스템 설정 기반
        const expResult = await awardExperience(userId, 'attendance');
        
        return {
          checkedToday: true,
          streak: 1,
          totalCount: 1,
          monthCount: 1,
          lastAttendance: Timestamp.now(),
          monthlyLog: newMonthlyLog,
          expGained: expResult.expAwarded,
          leveledUp: expResult.leveledUp,
          oldLevel: expResult.oldLevel,
          newLevel: expResult.newLevel
        };
      } else {
        return {
          checkedToday: false,
          streak: 0,
          totalCount: 0,
          monthCount: 0,
          monthlyLog: {}
        };
      }
    }
    
    // 기존 출석체크 데이터 처리
    const existingData = attendanceDoc.data();
    const attendances = existingData?.attendances || {};
    let streak = existingData?.streak || 0;
    const monthlyLog = existingData?.monthlyLog || {};
    
    // 오늘 출석체크 여부 확인
    const checkedToday = attendances[todayStr] === true;
    
    // 출석체크 요청인 경우 처리
    if (doCheck && !checkedToday) {
      // 어제 날짜 계산 (한국 시간 기준)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getKoreanDateString(yesterday);
      
      // 이전 연속 출석 일수 저장 (경험치 보상 계산용)
      const prevStreak = streak;
      
      // 연속 출석 여부 확인
      if (attendances[yesterdayStr]) {
        streak += 1;
      } else {
        streak = 1; // 연속이 끊어진 경우
      }
      
      // 이번 달 출석 카운트
      const thisMonth = todayStr.substring(0, 7); // YYYY-MM
      const monthlyCount = monthlyLog[thisMonth] || 0;
      
      // 출석체크 업데이트
      await updateDoc(attendanceRef, {
        [`attendances.${todayStr}`]: true,
        streak: streak,
        lastAttendance: serverTimestamp(),
        [`monthlyLog.${thisMonth}`]: monthlyCount + 1
      });
      
      // 기본 출석 경험치 추가 - 시스템 설정 기반
      const expResult = await awardExperience(userId, 'attendance');
      let totalXp = expResult.expAwarded;
      
      // 연속 출석 보너스 계산
      const settings = await getSystemSettings();
      const streakBonus = calculateStreakBonus(streak, prevStreak, settings); // 현재 streak와 이전 streak를 비교하여 계산
      
      // 연속 출석 보너스가 있다면 추가 경험치 지급
      if (streakBonus > 0) {
        const streakExpResult = await awardExperience(userId, 'attendanceStreak', streakBonus);
        totalXp += streakExpResult.expAwarded;
      }
      
      // 사용자의 streak 통계도 업데이트
      await updateDoc(doc(db, 'users', userId), {
        'stats.streak': streak
      });
      
      // 월별 출석 일수 계산
      const monthCount = Object.keys(monthlyLog).length + 1;
      const totalCount = Object.keys(attendances).length + 1;
      
             return {
         checkedToday: true,
         streak,
         totalCount,
         monthCount,
         lastAttendance: serverTimestamp(),
         monthlyLog: { ...monthlyLog, [todayStr]: true },
         expGained: totalXp,
         leveledUp: expResult.leveledUp,
         oldLevel: expResult.oldLevel,
         newLevel: expResult.newLevel
       };
    }
    
    // 출석체크 정보만 조회하는 경우
    // 실제 연속 출석 여부 확인
    let actualStreak = streak;
    
    if (!checkedToday) {
      // 오늘 출석하지 않았다면 연속 출석이 아님
      actualStreak = 0;
    } else {
      // 오늘 출석했다면, 어제 출석했는지 확인하여 연속 출석인지 판단
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getKoreanDateString(yesterday);
      
      if (!attendances[yesterdayStr]) {
        // 어제 출석하지 않았다면 연속 출석이 아님 (오늘만 출석)
        actualStreak = 1;
      }
      // 어제 출석했다면 streak 값 유지 (이미 연속 출석)
    }
    
    const monthCount = Object.keys(monthlyLog).length;
    const totalCount = Object.keys(attendances).length;
    
    return {
      checkedToday,
      streak: actualStreak, // 실제 연속 출석 일수 반환
      totalCount,
      monthCount,
      lastAttendance: existingData?.lastAttendance || null,
      monthlyLog
    };
    
  } catch (error) {
    console.error('출석체크 처리 오류:', error);
    throw error;
  }
}; 