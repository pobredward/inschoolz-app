import { doc, getDoc, updateDoc, serverTimestamp, increment, collection, query, where, orderBy, limit, getDocs, FieldValue, getCountFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { User, SystemSettings } from '../types';

// 레벨별 필요 경험치 (1→2레벨 10exp, 2→3레벨 20exp, 오름차순)
// 각 레벨에서 다음 레벨로 가기 위해 필요한 경험치
export const LEVEL_REQUIREMENTS = {
  1: 10,   // 1레벨 → 2레벨
  2: 20,   // 2레벨 → 3레벨
  3: 30,   // 3레벨 → 4레벨
  4: 40,   // 4레벨 → 5레벨
  5: 50,   // 5레벨 → 6레벨
  6: 60,   // 6레벨 → 7레벨
  7: 70,   // 7레벨 → 8레벨
  8: 80,   // 8레벨 → 9레벨
  9: 90,   // 9레벨 → 10레벨
  10: 100, // 10레벨 → 11레벨
  11: 110, // 11레벨 → 12레벨
  12: 120, // 12레벨 → 13레벨
  13: 130,
  14: 140,
  15: 150,
  16: 160,
  17: 170,
  18: 180,
  19: 190,
  20: 200
};

// 레벨별 누적 경험치 (총 경험치로 레벨 계산용)
export const CUMULATIVE_REQUIREMENTS = {
  1: 0,    // 1레벨 시작
  2: 10,   // 1→2레벨 10exp
  3: 30,   // 10 + 20 = 30
  4: 60,   // 30 + 30 = 60
  5: 100,  // 60 + 40 = 100
  6: 150,  // 100 + 50 = 150
  7: 210,  // 150 + 60 = 210
  8: 280,  // 210 + 70 = 280
  9: 360,  // 280 + 80 = 360
  10: 450, // 360 + 90 = 450
  11: 550, // 450 + 100 = 550
  12: 660, // 550 + 110 = 660
  13: 780, // 660 + 120 = 780
  14: 910, // 780 + 130 = 910
  15: 1050, // 910 + 140 = 1050
  16: 1200, // 1050 + 150 = 1200
  17: 1360, // 1200 + 160 = 1360
  18: 1530, // 1360 + 170 = 1530
  19: 1710, // 1530 + 180 = 1710
  20: 1900  // 1710 + 190 = 1900
};

/**
 * 시스템 설정 가져오기
 */
let cachedSystemSettings: SystemSettings | null = null;

export const getSystemSettings = async (): Promise<SystemSettings> => {
  if (cachedSystemSettings) {
    return cachedSystemSettings;
  }
  
  try {
    // Firebase의 실제 experienceSettings 문서 읽기
    const experienceSettingsDoc = await getDoc(doc(db, 'system', 'experienceSettings'));
    
    if (experienceSettingsDoc.exists()) {
      const firebaseSettings = experienceSettingsDoc.data();
      
      // Firebase 구조를 코드 구조로 변환
      cachedSystemSettings = {
        experience: {
          postReward: firebaseSettings.community?.postXP || 10,
          commentReward: firebaseSettings.community?.commentXP || 5,
          likeReward: firebaseSettings.community?.likeXP || 1,
          attendanceReward: firebaseSettings.attendance?.dailyXP || 5,
          attendanceStreakReward: firebaseSettings.attendance?.streakBonus || 10,
          referralReward: 50,
          levelRequirements: LEVEL_REQUIREMENTS
        },
        dailyLimits: {
          postsForReward: firebaseSettings.community?.dailyPostLimit || 3,
          commentsForReward: firebaseSettings.community?.dailyCommentLimit || 5,
          gamePlayCount: firebaseSettings.games?.reactionGame?.dailyLimit || 5
        },
        gameSettings: {
          reactionGame: {
            rewardThreshold: 500, // 기본값 유지 (thresholds 배열로 대체됨)
            rewardAmount: 15,
            thresholds: [
              { minScore: 100, xpReward: 15 },
              { minScore: 200, xpReward: 10 },
              { minScore: 300, xpReward: 5 }
            ]
          },
          tileGame: {
            rewardThreshold: 800, // 기본값 유지 (thresholds 배열로 대체됨)
            rewardAmount: 20,
            thresholds: [
              { minScore: 50, xpReward: 5 },
              { minScore: 100, xpReward: 10 },
              { minScore: 150, xpReward: 15 }
            ]
          },
          flappyBird: {
            rewardThreshold: 10,
            rewardAmount: 25
          }
        },
        ads: {
          rewardedVideo: {
            gameExtraPlays: 3,
            cooldownMinutes: 30
          }
        },
        appVersion: {
          current: '1.0.0',
          minimum: '1.0.0',
          forceUpdate: false
        },
        maintenance: {
          isActive: false
        },
        // Firebase 설정 추가
        attendanceBonus: {
          weeklyBonusXP: firebaseSettings.attendance?.weeklyBonusXP || 50,
          streakBonus: firebaseSettings.attendance?.streakBonus || 5
        }
      };
      
      return cachedSystemSettings;
    }
  } catch (error) {
    console.error('시스템 설정 로드 실패:', error);
  }
  
  // 기본값 반환
  return {
    experience: {
      postReward: 10,
      commentReward: 5,
      likeReward: 1,
      attendanceReward: 5,
      attendanceStreakReward: 10,
      referralReward: 50,
      levelRequirements: LEVEL_REQUIREMENTS
    },
    dailyLimits: {
      postsForReward: 3,
      commentsForReward: 5,
      gamePlayCount: 5
    },
    gameSettings: {
      reactionGame: {
        rewardThreshold: 500,
        rewardAmount: 15,
        thresholds: [
          { minScore: 100, xpReward: 15 },
          { minScore: 200, xpReward: 10 },
          { minScore: 300, xpReward: 5 }
        ]
      },
      tileGame: {
        rewardThreshold: 800,
        rewardAmount: 20,
        thresholds: [
          { minScore: 50, xpReward: 5 },
          { minScore: 100, xpReward: 10 },
          { minScore: 150, xpReward: 15 }
        ]
      },
      flappyBird: {
        rewardThreshold: 10,
        rewardAmount: 25
      }
    },
    ads: {
      rewardedVideo: {
        gameExtraPlays: 3,
        cooldownMinutes: 30
      }
    },
    appVersion: {
      current: '1.0.0',
      minimum: '1.0.0',
      forceUpdate: false
    },
    maintenance: {
      isActive: false
    },
    attendanceBonus: {
      weeklyBonusXP: 50,
      streakBonus: 5
    }
  };
};

/**
 * 레벨에 따른 필요 경험치 계산 (시스템 설정 기반)
 */
export const calculateRequiredExpForLevel = async (targetLevel: number): Promise<number> => {
  const settings = await getSystemSettings();
  return settings.experience.levelRequirements[targetLevel] || (targetLevel - 1) * targetLevel * 5;
};

/**
 * 현재 레벨에서 다음 레벨로 가기 위한 필요 경험치
 */
export const calculateExpToNextLevel = async (currentLevel: number): Promise<number> => {
  const currentLevelExp = await calculateRequiredExpForLevel(currentLevel);
  const nextLevelExp = await calculateRequiredExpForLevel(currentLevel + 1);
  return nextLevelExp - currentLevelExp;
};

/**
 * 총 경험치에서 현재 레벨 계산
 */
export const calculateLevelFromTotalExp = (totalExp: number): number => {
  let level = 1;
  for (const [levelStr, requiredExp] of Object.entries(CUMULATIVE_REQUIREMENTS)) {
    const levelNum = parseInt(levelStr);
    if (totalExp >= requiredExp) {
      level = levelNum;
    } else {
      break;
    }
  }
  return level;
};

/**
 * 현재 레벨에서 다음 레벨로 가기 위해 필요한 경험치
 */
export const getExpRequiredForNextLevel = (currentLevel: number): number => {
  return LEVEL_REQUIREMENTS[currentLevel as keyof typeof LEVEL_REQUIREMENTS] || (currentLevel * 10);
};

/**
 * 현재 레벨에서의 경험치 진행률 계산
 */
export const calculateCurrentLevelProgress = (totalExp: number): {
  level: number;
  currentExp: number;
  expToNextLevel: number;
  currentLevelRequiredXp: number;
  progressPercentage: number;
} => {
  const level = calculateLevelFromTotalExp(totalExp);
  const currentLevelStartExp = CUMULATIVE_REQUIREMENTS[level as keyof typeof CUMULATIVE_REQUIREMENTS] || 0;
  const currentExp = totalExp - currentLevelStartExp;
  const currentLevelRequiredXp = getExpRequiredForNextLevel(level);
  const expToNextLevel = currentLevelRequiredXp - currentExp;
  
  const progressPercentage = Math.min(100, Math.floor((currentExp / currentLevelRequiredXp) * 100));
  
  return {
    level,
    currentExp,
    expToNextLevel: Math.max(0, expToNextLevel),
    currentLevelRequiredXp,
    progressPercentage
  };
};

/**
 * 레벨업 체크 및 처리
 */
export const checkLevelUp = (currentLevel: number, currentExp: number, currentLevelRequiredXp: number): {
  shouldLevelUp: boolean;
  newLevel: number;
  newCurrentExp: number;
  newCurrentLevelRequiredXp: number;
} => {
  let newLevel = currentLevel;
  let newCurrentExp = currentExp;
  let newCurrentLevelRequiredXp = currentLevelRequiredXp;
  let shouldLevelUp = false;
  
  // 레벨업 조건: 현재 경험치가 필요 경험치보다 크거나 같을 때
  while (newCurrentExp >= newCurrentLevelRequiredXp) {
    shouldLevelUp = true;
    newCurrentExp -= newCurrentLevelRequiredXp; // 레벨업 후 남은 경험치
    newLevel++;
    newCurrentLevelRequiredXp = getExpRequiredForNextLevel(newLevel);
  }
  
  return {
    shouldLevelUp,
    newLevel,
    newCurrentExp,
    newCurrentLevelRequiredXp
  };
};

/**
 * 일일 활동 제한 확인
 */
export const checkDailyLimit = async (userId: string, activityType: 'posts' | 'comments' | 'games'): Promise<{
  canEarnExp: boolean;
  currentCount: number;
  limit: number;
  resetTime: Date;
}> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }
  
  const userData = userDoc.data() as User;
  const settings = await getSystemSettings();
  
  const today = new Date().toISOString().split('T')[0];
  const activityLimits = (userData as any).activityLimits; // 임시로 any 타입 사용
  
  // 오늘 첫 활동이거나 날짜가 바뀐 경우
  if (!activityLimits || activityLimits.lastResetDate !== today) {
    const resetTime = new Date();
    resetTime.setHours(23, 59, 59, 999); // 오늘 자정
    
    return {
      canEarnExp: true,
      currentCount: 0,
      limit: settings.dailyLimits[activityType === 'posts' ? 'postsForReward' : 
                                   activityType === 'comments' ? 'commentsForReward' : 'gamePlayCount'],
      resetTime
    };
  }
  
  // 현재 카운트 확인
  let currentCount = 0;
  let limit = 0;
  
  if (activityType === 'posts') {
    currentCount = activityLimits.dailyCounts.posts || 0;
    limit = settings.dailyLimits.postsForReward;
  } else if (activityType === 'comments') {
    currentCount = activityLimits.dailyCounts.comments || 0;
    limit = settings.dailyLimits.commentsForReward;
  } else if (activityType === 'games') {
    const gamesCounts = activityLimits.dailyCounts.games || {};
    currentCount = (gamesCounts.flappyBird || 0) + (gamesCounts.reactionGame || 0) + (gamesCounts.tileGame || 0);
    limit = settings.dailyLimits.gamePlayCount;
  }
  
  const resetTime = new Date();
  resetTime.setHours(23, 59, 59, 999);
  
  return {
    canEarnExp: currentCount < limit,
    currentCount,
    limit,
    resetTime
  };
};

/**
 * 활동 카운트 업데이트 (단순화된 버전)
 * 접속 시점에 이미 리셋되었으므로 단순히 카운트만 증가
 */
export const updateActivityCount = async (userId: string, activityType: 'posts' | 'comments', gameType?: 'flappyBird' | 'reactionGame' | 'tileGame'): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) return;
  
  // 활동 카운트 증가만 수행 (날짜 체크 불필요)
  const updateData: Record<string, FieldValue> = {};
  
  if (activityType === 'posts') {
    updateData[`activityLimits.dailyCounts.posts`] = increment(1);
  } else if (activityType === 'comments') {
    updateData[`activityLimits.dailyCounts.comments`] = increment(1);
  }
  
  if (gameType) {
    updateData[`activityLimits.dailyCounts.games.${gameType}`] = increment(1);
  }
  
  await updateDoc(userRef, updateData);
};

/**
 * 경험치 지급 함수
 */
export const awardExperience = async (
  userId: string, 
  activityType: 'post' | 'comment' | 'like' | 'attendance' | 'attendanceStreak' | 'referral' | 'game',
  amount?: number,
  gameType?: 'flappyBird' | 'reactionGame' | 'tileGame',
  gameScore?: number
): Promise<{
  success: boolean;
  expAwarded: number;
  leveledUp: boolean;
  oldLevel?: number;
  newLevel?: number;
  reason?: string;
}> => {
  try {
    const settings = await getSystemSettings();
    let expToAward = 0;
    let shouldCheckLimit = true;
    let activityLimitType: 'posts' | 'comments' | 'games' | null = null;
    
    // 활동 타입별 경험치 계산
    switch (activityType) {
      case 'post':
        expToAward = settings.experience.postReward;
        activityLimitType = 'posts';
        break;
      case 'comment':
        expToAward = settings.experience.commentReward;
        activityLimitType = 'comments';
        break;
      case 'like':
        expToAward = settings.experience.likeReward;
        shouldCheckLimit = false; // 좋아요는 제한 없음
        break;
      case 'attendance':
        expToAward = settings.experience.attendanceReward;
        shouldCheckLimit = false;
        break;
      case 'attendanceStreak':
        expToAward = settings.experience.attendanceStreakReward;
        shouldCheckLimit = false;
        break;
      case 'referral':
        expToAward = settings.experience.referralReward;
        shouldCheckLimit = false;
        break;
      case 'game':
        if (!gameType) return { success: false, expAwarded: 0, leveledUp: false, reason: '게임 타입이 필요합니다.' };
        
        const gameSettings = settings.gameSettings[gameType];
        if (gameScore && gameScore >= gameSettings.rewardThreshold) {
          expToAward = gameSettings.rewardAmount;
          activityLimitType = 'games';
        } else {
          return { success: false, expAwarded: 0, leveledUp: false, reason: '기준 점수에 도달하지 못했습니다.' };
        }
        break;
      default:
        expToAward = amount || 0;
        shouldCheckLimit = false;
    }
    
    // 일일 제한 확인
    if (shouldCheckLimit && activityLimitType) {
      const limitCheck = await checkDailyLimit(userId, activityLimitType);
      if (!limitCheck.canEarnExp) {
        return { 
          success: false, 
          expAwarded: 0, 
          leveledUp: false, 
          reason: `일일 제한에 도달했습니다. (${limitCheck.currentCount}/${limitCheck.limit})` 
        };
      }
    }
    
    // 경험치 업데이트
    const result = await updateUserExperience(userId, expToAward);
    
    // 활동 카운트 업데이트
    if (activityLimitType === 'posts') {
      await updateActivityCount(userId, 'posts');
    } else if (activityLimitType === 'comments') {
      await updateActivityCount(userId, 'comments');
    } else if (activityType === 'game' && gameType) {
      await updateActivityCount(userId, 'posts', gameType); // 게임의 경우 임시로 posts 타입 사용하고 gameType 전달
    }
    
    return {
      success: true,
      expAwarded: expToAward,
      leveledUp: result.leveledUp,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel
    };
    
  } catch (error) {
    console.error('경험치 지급 실패:', error);
    return { success: false, expAwarded: 0, leveledUp: false, reason: '경험치 지급 중 오류가 발생했습니다.' };
  }
};

/**
 * 사용자 경험치 데이터 동기화 (기존 데이터 마이그레이션용)
 */
export const syncUserExperienceData = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data() as User;
    
    // totalExperience를 기준으로 정확한 레벨과 현재 경험치 계산
    const totalExp = userData.stats?.totalExperience || 0;
    const progress = calculateCurrentLevelProgress(totalExp);
    
    // 데이터 동기화
    await updateDoc(userRef, {
      'stats.totalExperience': totalExp,
      // 'stats.experience': totalExp, // experience 필드 제거
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      'updatedAt': serverTimestamp()
    });
    
    console.log(`✅ 사용자 ${userId}의 경험치 데이터가 동기화되었습니다.`);
    console.log(`- 총 경험치: ${totalExp}, 레벨: ${progress.level}, 현재 경험치: ${progress.currentExp}/${progress.currentLevelRequiredXp}`);
  } catch (error) {
    console.error('경험치 데이터 동기화 오류:', error);
  }
};

/**
 * 사용자 경험치 업데이트 및 레벨업 처리 (완전히 새로운 로직)
 */
export const updateUserExperience = async (
  userId: string, 
  xp: number
): Promise<{ 
  leveledUp: boolean; 
  oldLevel?: number; 
  newLevel?: number; 
  userData?: User 
}> => {
  if (!xp) return { leveledUp: false };
  
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data() as User;
    const currentLevel = userData.stats?.level || 1;
    const totalExperience = userData.stats?.totalExperience || 0;
    
    // 새로운 총 경험치 계산
    const newTotalExperience = totalExperience + xp;
    
    // 새로운 총 경험치 기준으로 레벨과 현재 경험치 계산
    const progress = calculateCurrentLevelProgress(newTotalExperience);
    
    // 데이터 업데이트
    const updateData = {
      'stats.totalExperience': newTotalExperience,
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      // 'stats.experience': newTotalExperience, // experience 필드 제거
      'updatedAt': serverTimestamp()
    };
    
    await updateDoc(userRef, updateData);
    
    const leveledUp = progress.level > currentLevel;
    
    if (leveledUp) {
      console.log(`🎉 사용자 ${userId}가 레벨 ${currentLevel}에서 레벨 ${progress.level}로 레벨업했습니다!`);
    }
    
    console.log(`✨ 사용자 ${userId}에게 ${xp} 경험치가 추가되었습니다. (총 ${newTotalExperience}XP, 레벨 ${progress.level}, 현재 ${progress.currentExp}/${progress.currentLevelRequiredXp})`);
    
    // 업데이트된 사용자 데이터 조회
    const updatedUserDoc = await getDoc(userRef);
    const updatedUserData = updatedUserDoc.data() as User;
    
    return { 
      leveledUp: leveledUp, 
      oldLevel: currentLevel, 
      newLevel: progress.level, 
      userData: updatedUserData 
    };
    
  } catch (error) {
    console.error('경험치 업데이트 실패:', error);
    throw error;
  }
};

/**
 * 랭킹 데이터 조회
 */
export const getRankingData = async (
  type: 'global' | 'school' | 'region',
  schoolId?: string,
  sido?: string,
  sigungu?: string,
  limitCount: number = 100
): Promise<Array<{
  rank: number;
  userId: string;
  displayName: string;
  schoolName?: string;
  level: number;
  totalExperience: number;
  profileImageUrl?: string;
}>> => {
  try {
    let usersQuery;
    
    if (type === 'school' && schoolId) {
      usersQuery = query(
        collection(db, 'users'),
        where('school.id', '==', schoolId),
        orderBy('stats.totalExperience', 'desc'),
        limit(limitCount)
      );
    } else if (type === 'region' && sido) {
      if (sigungu) {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu),
          orderBy('stats.totalExperience', 'desc'),
          limit(limitCount)
        );
      } else {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          orderBy('stats.totalExperience', 'desc'),
          limit(limitCount)
        );
      }
    } else {
      // 전체 랭킹
      usersQuery = query(
        collection(db, 'users'),
        orderBy('stats.totalExperience', 'desc'),
        limit(limitCount)
      );
    }
    
    const querySnapshot = await getDocs(usersQuery);
    const rankingData: Array<{
      rank: number;
      userId: string;
      displayName: string;
      schoolName?: string;
      level: number;
      totalExperience: number;
      profileImageUrl?: string;
    }> = [];
    
    querySnapshot.docs.forEach((doc, index) => {
      const userData = doc.data() as User;
      rankingData.push({
        rank: index + 1,
        userId: doc.id,
        displayName: userData.profile.userName,
        schoolName: userData.school?.name,
        level: userData.stats?.level || 1,
        totalExperience: userData.stats?.totalExperience || 0,
        profileImageUrl: userData.profile.profileImageUrl
      });
    });
    
    return rankingData;
  } catch (error) {
    console.error('랭킹 데이터 조회 실패:', error);
    return [];
  }
};

/**
 * 사용자의 현재 랭킹 조회
 */
export const getUserRank = async (
  userId: string,
  type: 'global' | 'school' | 'region',
  schoolId?: string,
  sido?: string,
  sigungu?: string
): Promise<number | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    
    const userData = userDoc.data() as User;
    const userExp = userData.stats?.totalExperience || 0;
    
    let usersQuery;
    
    if (type === 'school' && schoolId) {
      usersQuery = query(
        collection(db, 'users'),
        where('school.id', '==', schoolId),
        where('stats.totalExperience', '>', userExp)
      );
    } else if (type === 'region' && sido) {
      if (sigungu) {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          where('regions.sigungu', '==', sigungu),
          where('stats.totalExperience', '>', userExp)
        );
      } else {
        usersQuery = query(
          collection(db, 'users'),
          where('regions.sido', '==', sido),
          where('stats.totalExperience', '>', userExp)
        );
      }
    } else {
      // 전체 랭킹
      usersQuery = query(
        collection(db, 'users'),
        where('stats.totalExperience', '>', userExp)
      );
    }
    
    const querySnapshot = await getDocs(usersQuery);
    return querySnapshot.size + 1; // 자신보다 높은 사람 수 + 1 = 자신의 순위
    
  } catch (error) {
    console.error('사용자 랭킹 조회 실패:', error);
    return null;
  }
};

/**
 * 관리자용 경험치 설정 관리 API
 */

// 경험치 설정 타입 정의
export interface ExperienceSettings {
  community: {
    postXP: number;
    commentXP: number;
    likeXP: number;
    dailyPostLimit: number;
    dailyCommentLimit: number;
    dailyLikeLimit: number;
  };
  games: {
    reactionGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
    tileGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
  };

  attendance: {
    dailyXP: number;
    streakBonus: number;
    weeklyBonusXP: number;
  };
  
  referral: {
    referrerXP: number;    // 추천인(A)이 받는 경험치
    refereeXP: number;     // 추천받은 사람(B)이 받는 경험치
    enabled: boolean;      // 추천인 시스템 활성화 여부
  };
}

/**
 * 관리자용 경험치 설정 조회
 */
export const getExperienceSettings = async (): Promise<ExperienceSettings> => {
  try {
    const settingsDoc = await getDoc(doc(db, 'system', 'experienceSettings'));
    
    if (settingsDoc.exists()) {
      return settingsDoc.data() as ExperienceSettings;
    } else {
      // 기본 설정 반환
      const defaultSettings: ExperienceSettings = {
        community: {
          postXP: 10,
          commentXP: 5,
          likeXP: 1,
          dailyPostLimit: 3,
          dailyCommentLimit: 5,
          dailyLikeLimit: 50,
        },
        games: {
          reactionGame: {
            enabled: true,
            dailyLimit: 5,
            thresholds: [
              { minScore: 100, xpReward: 15 },
              { minScore: 200, xpReward: 10 },
              { minScore: 300, xpReward: 5 },
            ],
          },
          tileGame: {
            enabled: true,
            dailyLimit: 5,
            thresholds: [
              { minScore: 50, xpReward: 5 },
              { minScore: 100, xpReward: 10 },
              { minScore: 150, xpReward: 15 },
            ],
          },
        },

        attendance: {
          dailyXP: 10,
          streakBonus: 5,
          weeklyBonusXP: 50,
        },
        
        referral: {
          referrerXP: 30,     // 추천인이 받는 경험치 (기본값)
          refereeXP: 20,      // 추천받은 사람이 받는 경험치 (기본값)
          enabled: true,      // 추천인 시스템 활성화
        },
      };
      
      // 기본 설정을 Firestore에 저장 (문서가 없으면 생성)
      await updateDoc(doc(db, 'system', 'experienceSettings'), {
        ...defaultSettings,
        updatedAt: serverTimestamp()
      });
      return defaultSettings;
    }
  } catch (error) {
    console.error('경험치 설정 조회 오류:', error);
    throw new Error('경험치 설정을 가져오는 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 경험치 설정 업데이트
 */
export const updateExperienceSettings = async (settings: ExperienceSettings): Promise<void> => {
  try {
    // setDoc을 사용하여 문서가 없으면 생성, 있으면 업데이트
    await updateDoc(doc(db, 'system', 'experienceSettings'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    
    // 캐시 무효화
    cachedSystemSettings = null;
  } catch (error) {
    console.error('경험치 설정 업데이트 오류:', error);
    throw new Error('경험치 설정 업데이트 중 오류가 발생했습니다.');
  }
};

/**
 * 관리자용 통계 데이터 조회
 */
export const getAdminStats = async (): Promise<{
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalComments: number;
  pendingReports: number;
  totalExperience: number;
}> => {
  try {
    // 사용자 수 계산
    const usersSnapshot = await getCountFromServer(collection(db, 'users'));
    const totalUsers = usersSnapshot.data().count;

    // 활성 사용자 수 계산 (최근 30일 내 활동)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const activeUsersQuery = query(
      collection(db, 'users'),
      where('lastActiveAt', '>=', thirtyDaysAgo)
    );
    const activeUsersSnapshot = await getCountFromServer(activeUsersQuery);
    const activeUsers = activeUsersSnapshot.data().count;

    // 게시글 수 계산
    const postsSnapshot = await getCountFromServer(collection(db, 'posts'));
    const totalPosts = postsSnapshot.data().count;

    // 댓글 수 계산 (모든 게시글의 comments 서브컬렉션 합계)
    let totalComments = 0;
    const postsQuerySnapshot = await getDocs(collection(db, 'posts'));
    for (const postDoc of postsQuerySnapshot.docs) {
      const commentsSnapshot = await getCountFromServer(collection(db, 'posts', postDoc.id, 'comments'));
      totalComments += commentsSnapshot.data().count;
    }

    // 신고 건수 계산 (처리되지 않은 신고)
    let pendingReports = 0;
    for (const postDoc of postsQuerySnapshot.docs) {
      const reportsQuery = query(
        collection(db, 'posts', postDoc.id, 'reports'),
        where('status', '==', 'pending')
      );
      const reportsSnapshot = await getCountFromServer(reportsQuery);
      pendingReports += reportsSnapshot.data().count;
    }

    // 총 경험치 계산 (모든 사용자의 누적 경험치 합계)
    const usersQuerySnapshot = await getDocs(collection(db, 'users'));
    let totalExperience = 0;
    usersQuerySnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userXP = userData.stats?.totalExperience || 0;
      totalExperience += userXP;
    });

    return {
      totalUsers,
      activeUsers,
      totalPosts,
      totalComments,
      pendingReports,
      totalExperience,
    };
  } catch (error) {
    console.error('관리자 통계 조회 오류:', error);
    throw new Error('통계 데이터를 가져오는 중 오류가 발생했습니다.');
  }
}; 

/**
 * 시스템 설정 캐시 무효화
 * 관리자가 설정을 변경했을 때 호출
 */
export const invalidateSystemSettingsCache = (): void => {
  cachedSystemSettings = null;
}; 

/**
 * 게임 랭킹 데이터 조회
 */
export const getGameRankings = async (gameType: 'reactionGame' | 'tileGame' | 'flappyBird', period: 'daily' | 'weekly' | 'all' = 'all'): Promise<any[]> => {
  try {
    const rankingRef = collection(db, 'gameRankings');
    const rankingQuery = query(
      rankingRef,
      where('gameType', '==', gameType),
      where('period', '==', period),
      orderBy('score', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(rankingQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('게임 랭킹 조회 오류:', error);
    return [];
  }
};

/**
 * 사용자 랭킹 조회
 */
export const getUserRanking = async (userId: string): Promise<{ rank: number; totalUsers: number } | null> => {
  try {
    const usersRef = collection(db, 'users');
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) return null;
    
    const userTotalExp = userDoc.data().stats?.totalExperience || 0;
    
    // 현재 사용자보다 높은 경험치를 가진 사용자 수 계산
    const higherExpQuery = query(
      usersRef,
      where('stats.totalExperience', '>', userTotalExp)
    );
    
    const higherExpSnapshot = await getCountFromServer(higherExpQuery);
    const rank = higherExpSnapshot.data().count + 1;
    
    // 전체 사용자 수
    const totalUsersSnapshot = await getCountFromServer(usersRef);
    const totalUsers = totalUsersSnapshot.data().count;
    
    return { rank, totalUsers };
  } catch (error) {
    console.error('사용자 랭킹 조회 오류:', error);
    return null;
  }
};

/**
 * 상위 랭킹 사용자 조회
 */
export const getTopRankedUsers = async (limitCount: number = 10): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const topUsersQuery = query(
      usersRef,
      orderBy('stats.totalExperience', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(topUsersQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as User));
  } catch (error) {
    console.error('상위 랭킹 사용자 조회 오류:', error);
    return [];
  }
}; 

/**
 * 홈 화면용 통계 데이터 조회
 */
export const getHomeStats = async (): Promise<{
  totalUsers: number;
  todayPosts: number;
  onlineUsers: number;
  totalPosts: number;
}> => {
  try {
    // 사용자 수 계산
    const usersSnapshot = await getCountFromServer(collection(db, 'users'));
    const totalUsers = usersSnapshot.data().count;

    // 오늘 작성된 게시글 수 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPostsQuery = query(
      collection(db, 'posts'),
      where('createdAt', '>=', today.getTime()),
      where('status.isDeleted', '==', false)
    );
    const todayPostsSnapshot = await getCountFromServer(todayPostsQuery);
    const todayPosts = todayPostsSnapshot.data().count;

    // 온라인 사용자 수 계산 (최근 5분 내 활동)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const onlineUsersQuery = query(
      collection(db, 'users'),
      where('lastActiveAt', '>=', fiveMinutesAgo)
    );
    const onlineUsersSnapshot = await getCountFromServer(onlineUsersQuery);
    const onlineUsers = onlineUsersSnapshot.data().count;

    // 전체 게시글 수 계산
    const postsSnapshot = await getCountFromServer(collection(db, 'posts'));
    const totalPosts = postsSnapshot.data().count;

    return {
      totalUsers,
      todayPosts,
      onlineUsers,
      totalPosts,
    };
  } catch (error) {
    console.error('홈 통계 조회 오류:', error);
    throw new Error('홈 통계 데이터를 가져오는 중 오류가 발생했습니다.');
  }
}; 

/**
 * 사용자 접속 시 일일 활동 제한 자동 리셋
 * 00시 정각 이후 첫 접속 시 activityLimits를 모두 0으로 초기화
 */
export const resetDailyActivityLimits = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn('사용자 문서를 찾을 수 없습니다:', userId);
      return;
    }
    
    const userData = userDoc.data() as User;
    const today = new Date().toISOString().split('T')[0];
    
    // 활동 제한 데이터 확인
    const activityLimits = userData.activityLimits;
    
    // 새로운 날이거나 데이터가 없으면 리셋
    if (!activityLimits || activityLimits.lastResetDate !== today) {
      console.log('일일 활동 제한 리셋 실행:', { userId, today, lastResetDate: activityLimits?.lastResetDate });
      
      const resetData = {
        'activityLimits.lastResetDate': today,
        'activityLimits.dailyCounts.posts': 0,
        'activityLimits.dailyCounts.comments': 0,
        'activityLimits.dailyCounts.games.flappyBird': 0,
        'activityLimits.dailyCounts.games.reactionGame': 0,
        'activityLimits.dailyCounts.games.tileGame': 0,
        'activityLimits.dailyCounts.adViewedCount': 0,
        // adRewards는 날짜별로 별도 관리되므로 리셋하지 않음
      };
      
      await updateDoc(userRef, resetData);
      console.log('일일 활동 제한 리셋 완료:', userId);
    }
  } catch (error) {
    console.error('일일 활동 제한 리셋 오류:', error);
  }
}; 

/**
 * 특정 사용자의 경험치 데이터를 총 경험치 기준으로 재계산 및 동기화
 */
export const fixUserExperienceData = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data() as User;
    
    // totalExperience를 기준으로 정확한 레벨과 현재 경험치 계산
    const totalExp = userData.stats?.totalExperience || (userData.stats as any)?.experience || 0;
    const progress = calculateCurrentLevelProgress(totalExp);
    
    // 데이터 동기화
    await updateDoc(userRef, {
      'stats.totalExperience': totalExp,
      // 'stats.experience': totalExp, // experience 필드 제거
      'stats.level': progress.level,
      'stats.currentExp': progress.currentExp,
      'stats.currentLevelRequiredXp': progress.currentLevelRequiredXp,
      'updatedAt': serverTimestamp()
    });
    
    console.log(`✅ 사용자 ${userId}의 경험치 데이터가 수정되었습니다.`);
    console.log(`- 총 경험치: ${totalExp}XP`);
    console.log(`- 레벨: ${progress.level}`);
    console.log(`- 현재 경험치: ${progress.currentExp}/${progress.currentLevelRequiredXp}`);
  } catch (error) {
    console.error('경험치 데이터 수정 오류:', error);
    throw error;
  }
}; 