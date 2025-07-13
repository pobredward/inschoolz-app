import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { now } from '../utils/timeUtils';
import { getKoreanDateString } from '../utils/timeUtils';
import { User, UserAttendance, AttendanceLog } from '../types';
import { awardExperience, getSystemSettings } from './experience';

/**
 * 출석체크 관련 타입 정의
 */
interface AttendanceRecord {
  userId: string;
  attendances: Record<string, boolean>;
  streak: number;
  lastAttendance: number;
  monthlyLog: AttendanceLog;
}

// 타입 재export
export type { UserAttendance, AttendanceLog };

// 경험치 관련 상수는 시스템 설정에서 동적으로 가져옴
// const ATTENDANCE_XP = 10; // 제거됨 - 시스템 설정에서 가져옴
// const STREAK_7_XP = 50;   // 제거됨 - 시스템 설정에서 가져옴
// const STREAK_30_XP = 200; // 제거됨 - 시스템 설정에서 가져옴

/**
 * 한국 시간대 기준(UTC+9)으로 날짜 문자열 생성
 * 이렇게 함으로써 사용자가 어떤 시간대에 있든 한국 시간 기준으로 출석체크가 처리됨
 */
const getKoreanDateStringLocal = (): { todayStr: string, thisMonth: string } => {
  const todayStr = getKoreanDateString();
  const thisMonth = todayStr.substring(0, 7); // YYYY-MM 형태로 잘라냄
  
  return {
    todayStr,
    thisMonth
  };
};

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
    
    // 한국 시간 기준 날짜 문자열 가져오기
    const { todayStr } = getKoreanDateStringLocal();
    
    // 사용자 출석체크 데이터 조회
    const attendanceRef = doc(db, 'attendance', userId);
    const attendanceDoc = await getDoc(attendanceRef);
    
    if (!attendanceDoc.exists()) {
      // 출석체크 데이터가 없으면 새로 생성
      if (doCheck) {
        const newMonthlyLog: AttendanceLog = {
          [todayStr]: true
        };
        
        const newAttendance = {
          userId,
          attendances: {
            [todayStr]: true
          },
          streak: 1,
          lastAttendance: now(),
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
          lastAttendance: now(),
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
    const attendanceData = attendanceDoc.data();
    const attendances = attendanceData.attendances || {};
    let streak = attendanceData.streak || 0;
    const monthlyLog = attendanceData.monthlyLog || attendances; // 이전 데이터 호환성 유지
    
    // 오늘 출석체크 여부 확인
    const checkedToday = attendances[todayStr] === true;
    
    // 출석체크 요청인 경우 처리
    if (doCheck && !checkedToday) {
      // 어제 날짜 계산 (한국 시간 기준)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayYear = yesterday.getFullYear();
      const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
      const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
      
      // 이전 연속 출석 일수 저장 (경험치 보상 계산용)
      const prevStreak = streak;
      
      // 연속 출석 여부 확인
      if (attendances[yesterdayStr]) {
        streak += 1;
      } else {
        streak = 1;
      }
      
      // 출석체크 데이터 업데이트
      const updatedAttendances = {
        ...attendances,
        [todayStr]: true
      };
      
      // monthlyLog 업데이트
      const updatedMonthlyLog = {
        ...monthlyLog,
        [todayStr]: true
      };
      
      await updateDoc(attendanceRef, {
        attendances: updatedAttendances,
        streak,
        lastAttendance: now(),
        monthlyLog: updatedMonthlyLog
      });
      
      // 기본 출석 경험치 추가 - 시스템 설정 기반
      const expResult = await awardExperience(userId, 'attendance');
      let totalXp = expResult.expAwarded;
      
      // 연속 출석 보너스 계산
      const settings = await getSystemSettings();
      const streakBonus = calculateStreakBonus(streak, prevStreak, settings);
      
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
      const monthCount = Object.keys(updatedMonthlyLog).length;
      const totalCount = Object.keys(updatedAttendances).length;
      
      return {
        checkedToday: true,
        streak,
        totalCount,
        monthCount,
        lastAttendance: now(),
        monthlyLog: updatedMonthlyLog,
        expGained: totalXp,
        leveledUp: expResult.leveledUp,
        oldLevel: expResult.oldLevel,
        newLevel: expResult.newLevel
      };
    }
    
    // 출석체크 정보만 조회하는 경우
    const monthCount = Object.keys(monthlyLog).length;
    const totalCount = Object.keys(attendances).length;
    
    return {
      checkedToday,
      streak,
      totalCount,
      monthCount,
      lastAttendance: attendanceData.lastAttendance,
      monthlyLog
    };
    
  } catch (error) {
    console.error('출석체크 처리 오류:', error);
    throw error;
  }
}; 