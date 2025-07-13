import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';
import { 
  getSystemSettings, 
  checkDailyLimit, 
  awardExperience,
  calculateCurrentLevelProgress
} from './experience';

export interface ExperienceResult {
  success: boolean;
  expGained: number;
  leveledUp: boolean;
  oldLevel?: number;
  newLevel?: number;
  currentExp: number;
  expToNextLevel: number;
  remainingCount: number;
  totalDailyLimit: number;
  reason?: string;
}

/**
 * 게시글 작성 시 경험치 부여
 */
export const awardPostExperience = async (userId: string): Promise<ExperienceResult> => {
  try {
    // 일일 제한 확인
    const limitCheck = await checkDailyLimit(userId, 'posts');
    const settings = await getSystemSettings();
    
    if (!limitCheck.canEarnExp) {
      return {
        success: false,
        expGained: 0,
        leveledUp: false,
        currentExp: 0,
        expToNextLevel: 0,
        remainingCount: 0,
        totalDailyLimit: settings.dailyLimits.postsForReward,
        reason: '일일 게시글 경험치 한도 초과'
      };
    }

    // 경험치 부여 (활동 횟수 업데이트도 함께 처리됨)
    const expResult = await awardExperience(userId, 'post');
    
    if (!expResult.success) {
      return {
        success: false,
        expGained: 0,
        leveledUp: false,
        currentExp: 0,
        expToNextLevel: 0,
        remainingCount: limitCheck.limit - limitCheck.currentCount,
        totalDailyLimit: settings.dailyLimits.postsForReward,
        reason: expResult.reason
      };
    }

    // 활동 횟수 업데이트는 awardExperience 내부에서 처리됨

    // 사용자 데이터 가져오기
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as User;
    
    // 레벨 진행도 계산
    const levelProgress = calculateCurrentLevelProgress(userData.stats.totalExperience);

    return {
      success: true,
      expGained: expResult.expAwarded,
      leveledUp: expResult.leveledUp,
      oldLevel: expResult.oldLevel,
      newLevel: expResult.newLevel,
      currentExp: levelProgress.currentExp,
      expToNextLevel: levelProgress.currentLevelRequiredXp,
      remainingCount: limitCheck.limit - limitCheck.currentCount - 1,
      totalDailyLimit: settings.dailyLimits.postsForReward
    };

  } catch (error) {
    console.error('게시글 경험치 부여 실패:', error);
    return {
      success: false,
      expGained: 0,
      leveledUp: false,
      currentExp: 0,
      expToNextLevel: 0,
      remainingCount: 0,
      totalDailyLimit: 0,
      reason: '경험치 부여 중 오류 발생'
    };
  }
};

/**
 * 댓글 작성 시 경험치 부여
 */
export const awardCommentExperience = async (userId: string): Promise<ExperienceResult> => {
  try {
    // 일일 제한 확인
    const limitCheck = await checkDailyLimit(userId, 'comments');
    const settings = await getSystemSettings();
    
    if (!limitCheck.canEarnExp) {
      return {
        success: false,
        expGained: 0,
        leveledUp: false,
        currentExp: 0,
        expToNextLevel: 0,
        remainingCount: 0,
        totalDailyLimit: settings.dailyLimits.commentsForReward,
        reason: '일일 댓글 경험치 한도 초과'
      };
    }

    // 경험치 부여 (활동 횟수 업데이트도 함께 처리됨)
    const expResult = await awardExperience(userId, 'comment');
    
    if (!expResult.success) {
      return {
        success: false,
        expGained: 0,
        leveledUp: false,
        currentExp: 0,
        expToNextLevel: 0,
        remainingCount: limitCheck.limit - limitCheck.currentCount,
        totalDailyLimit: settings.dailyLimits.commentsForReward,
        reason: expResult.reason
      };
    }

    // 활동 횟수 업데이트는 awardExperience 내부에서 처리됨

    // 사용자 데이터 가져오기
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as User;
    
    // 레벨 진행도 계산
    const levelProgress = calculateCurrentLevelProgress(userData.stats.totalExperience);

    return {
      success: true,
      expGained: expResult.expAwarded,
      leveledUp: expResult.leveledUp,
      oldLevel: expResult.oldLevel,
      newLevel: expResult.newLevel,
      currentExp: levelProgress.currentExp,
      expToNextLevel: levelProgress.currentLevelRequiredXp,
      remainingCount: limitCheck.limit - limitCheck.currentCount - 1,
      totalDailyLimit: settings.dailyLimits.commentsForReward
    };

  } catch (error) {
    console.error('댓글 경험치 부여 실패:', error);
    return {
      success: false,
      expGained: 0,
      leveledUp: false,
      currentExp: 0,
      expToNextLevel: 0,
      remainingCount: 0,
      totalDailyLimit: 0,
      reason: '경험치 부여 중 오류 발생'
    };
  }
};

/**
 * 좋아요 시 경험치 부여 (제한 없음)
 */
export const awardLikeExperience = async (userId: string): Promise<ExperienceResult> => {
  try {
    // 경험치 부여
    const expResult = await awardExperience(userId, 'like');
    
    if (!expResult.success) {
      return {
        success: false,
        expGained: 0,
        leveledUp: false,
        currentExp: 0,
        expToNextLevel: 0,
        remainingCount: 0,
        totalDailyLimit: 0,
        reason: expResult.reason
      };
    }

    // 사용자 데이터 가져오기
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as User;
    
    // 레벨 진행도 계산
    const levelProgress = calculateCurrentLevelProgress(userData.stats.totalExperience);

    return {
      success: true,
      expGained: expResult.expAwarded,
      leveledUp: expResult.leveledUp,
      oldLevel: expResult.oldLevel,
      newLevel: expResult.newLevel,
      currentExp: levelProgress.currentExp,
      expToNextLevel: levelProgress.currentLevelRequiredXp,
      remainingCount: -1, // 무제한
      totalDailyLimit: -1 // 무제한
    };

  } catch (error) {
    console.error('좋아요 경험치 부여 실패:', error);
    return {
      success: false,
      expGained: 0,
      leveledUp: false,
      currentExp: 0,
      expToNextLevel: 0,
      remainingCount: 0,
      totalDailyLimit: 0,
      reason: '경험치 부여 중 오류 발생'
    };
  }
}; 