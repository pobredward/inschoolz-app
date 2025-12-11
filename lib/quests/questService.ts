/**
 * 퀘스트 서비스 - 조건 체크 및 진행 상태 관리 (React Native App)
 */

import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp,
  increment 
} from 'firebase/firestore';
import { User, UserQuestProgress, QuestStep, QuestStatus, QuestChain } from '../../types';
import { tutorialChain } from './chains/tutorial';
import { newbieGrowthChain } from './chains/newbie-growth';

// 모든 퀘스트 체인 등록
export const questChains: Record<string, QuestChain> = {
  tutorial: tutorialChain,
  'newbie-growth': newbieGrowthChain,
};

// 체인 순서 정의 (순차적 진행)
export const chainOrder = ['tutorial', 'newbie-growth'];

// 퀘스트 액션 타입
export type QuestActionType = 
  | 'nickname_change'       // 닉네임 변경/설정
  | 'profile_complete'      // 프로필 완성 (레거시)
  | 'school_register'       // 학교 등록 (레거시)
  | 'favorite_school'       // 즐겨찾기 학교 등록
  | 'visit_board'           // 게시판 방문
  | 'create_post'           // 게시글 작성
  | 'create_comment'        // 댓글 작성
  | 'give_like'             // 좋아요 누르기
  | 'play_game'             // 게임 플레이
  | 'attendance'            // 출석체크
  | 'visit_other_board'     // 다른 게시판 방문
  | 'consecutive_attendance' // 연속 출석
  | 'visit_category'        // 특정 카테고리 방문
  | 'tile_game_clear';      // 타일 게임 클리어 (움직임 횟수 기반)

// 퀘스트 완료 콜백 타입
export type QuestCompletedCallback = (
  step: QuestStep,
  rewards: { xp: number; badge?: string; title?: string }
) => void;

// 전역 콜백 저장소
let onQuestCompleted: QuestCompletedCallback | null = null;

/**
 * 퀘스트 완료 콜백 등록
 */
export function setQuestCompletedCallback(callback: QuestCompletedCallback) {
  onQuestCompleted = callback;
}

/**
 * 사용자 퀘스트 진행 상태 초기화
 */
export async function initializeUserQuests(userId: string): Promise<UserQuestProgress> {
  const questRef = doc(db, 'quests', userId);
  const questDoc = await getDoc(questRef);
  
  if (questDoc.exists()) {
    return questDoc.data() as UserQuestProgress;
  }
  
  // 새 사용자 퀘스트 데이터 생성
  const initialProgress: UserQuestProgress = {
    userId,
    chains: {
      tutorial: {
        currentStep: 1,
        status: 'in_progress',
        startedAt: serverTimestamp() as Timestamp,
        stepProgress: {
          tutorial_1: {
            status: 'in_progress',
            progress: 0,
            target: 1,
          },
        },
      },
    },
    completedChains: [],
    earnedRewards: {
      badges: [],
      titles: [],
      frames: [],
      effects: [],
    },
    activeRewards: {},
    stats: {
      totalQuestsCompleted: 0,
      totalChainsCompleted: 0,
      totalXpEarned: 0,
    },
    updatedAt: serverTimestamp() as Timestamp,
    createdAt: serverTimestamp() as Timestamp,
  };
  
  await setDoc(questRef, initialProgress);
  console.log('✅ 퀘스트 초기화 완료:', userId);
  
  return initialProgress;
}

/**
 * 사용자 퀘스트 진행 상태 조회
 */
export async function getUserQuestProgress(userId: string): Promise<UserQuestProgress | null> {
  const questRef = doc(db, 'quests', userId);
  const questDoc = await getDoc(questRef);
  
  if (!questDoc.exists()) {
    return null;
  }
  
  return questDoc.data() as UserQuestProgress;
}

/**
 * 현재 진행 중인 퀘스트 단계 조회 (다중 체인 지원)
 */
export async function getCurrentQuestStep(userId: string): Promise<{
  chain: QuestChain;
  step: QuestStep;
  progress: number;
  target: number;
} | null> {
  const progress = await getUserQuestProgress(userId);
  
  if (!progress) return null;
  
  // 순서대로 체인 확인
  for (const chainId of chainOrder) {
    const chainProgress = progress.chains[chainId];
    const chain = questChains[chainId];
    
    if (!chain || !chainProgress) continue;
    
    // 진행 중인 체인 찾기
    if (chainProgress.status === 'in_progress') {
      const currentStepNum = chainProgress.currentStep || 1;
      const step = chain.steps.find(s => s.step === currentStepNum);
      
      if (!step) continue;
      
      const stepProgress = chainProgress.stepProgress[step.id];
      
      return {
        chain,
        step,
        progress: stepProgress?.progress || 0,
        target: step.objective.target,
      };
    }
  }
  
  return null;
}

/**
 * 닉네임 존재 여부 체크
 */
export function checkNicknameExists(user: User): boolean {
  const profile = user.profile;
  if (!profile) return false;
  
  return !!profile.userName && profile.userName.trim().length > 0;
}

/**
 * 프로필 완성도 체크 (레거시)
 */
export function checkProfileComplete(user: User): boolean {
  const profile = user.profile;
  if (!profile) return false;
  
  // 필수 프로필 필드 체크
  const hasUserName = !!profile.userName && profile.userName.trim().length > 0;
  const hasGender = !!profile.gender && profile.gender.trim().length > 0;
  const hasBirthYear = !!profile.birthYear && profile.birthYear > 1900;
  
  return hasUserName && hasGender && hasBirthYear;
}

/**
 * 학교 등록 체크
 */
export function checkSchoolRegistered(user: User): boolean {
  return !!user.school?.id && !!user.school?.name;
}

/**
 * 퀘스트 액션 처리 - 조건 체크 및 진행도 업데이트
 */
export async function trackQuestAction(
  userId: string,
  actionType: QuestActionType,
  user?: User,
  metadata?: {
    boardId?: string;
    isOtherSchool?: boolean;
    tileGameMoves?: number;
  }
): Promise<{
  completed: boolean;
  step?: QuestStep;
  newProgress?: number;
  target?: number;
  rewards?: { xp: number; badge?: string; title?: string };
} | null> {
  try {
    const progress = await getUserQuestProgress(userId);
    if (!progress) {
      console.log('❌ 퀘스트 진행 상태 없음, 초기화 필요');
      await initializeUserQuests(userId);
      return null;
    }
    
    // 현재 진행 중인 체인 찾기
    let activeChainId: string | null = null;
    let activeChain: QuestChain | null = null;
    let chainProgress: any = null;
    
    for (const chainId of chainOrder) {
      const cp = progress.chains[chainId];
      if (cp && cp.status === 'in_progress') {
        activeChainId = chainId;
        activeChain = questChains[chainId];
        chainProgress = cp;
        break;
      }
    }
    
    if (!activeChainId || !activeChain || !chainProgress) {
      console.log('ℹ️ 진행 중인 퀘스트 체인 없음');
      return null;
    }
    
    console.log(`🔍 진행 중인 체인: ${activeChain.name} (${activeChainId})`);
    
    const currentStepNum = chainProgress.currentStep || 1;
    const currentStep = activeChain.steps.find(s => s.step === currentStepNum);
    
    if (!currentStep) {
      console.log('❌ 현재 단계를 찾을 수 없음');
      return null;
    }
    
    // 현재 단계의 목표 타입과 액션 타입이 일치하는지 확인
    if (currentStep.objective.type !== actionType) {
      console.log(`ℹ️ 현재 단계(${currentStep.objective.type})와 액션(${actionType})이 일치하지 않음`);
      return null;
    }
    
    // 특수 조건 체크 - 닉네임 변경은 항상 통과 (변경 시 호출되므로)
    // nickname_change 액션은 닉네임이 저장될 때만 호출되므로 별도 체크 불필요
    
    if (actionType === 'school_register' && user) {
      if (!checkSchoolRegistered(user)) {
        console.log('ℹ️ 학교가 아직 등록되지 않음');
        return { completed: false, step: currentStep, newProgress: 0, target: 1 };
      }
    }
    
    if (actionType === 'visit_other_board' && !metadata?.isOtherSchool) {
      console.log('ℹ️ 자기 학교 게시판 방문 - 카운트 안함');
      return null;
    }
    
    // 타일 게임 클리어 조건 체크
    if (actionType === 'tile_game_clear' && currentStep.objective.type === 'tile_game_moves') {
      const maxMoves = currentStep.objective.metadata?.maxMoves || 10;
      const actualMoves = metadata?.tileGameMoves || 999;
      if (actualMoves > maxMoves) {
        console.log(`ℹ️ 타일 게임 움직임 ${actualMoves}번 > 목표 ${maxMoves}번 - 카운트 안함`);
        return null;
      }
      console.log(`✅ 타일 게임 ${actualMoves}번 클리어 - 목표 ${maxMoves}번 이하 달성!`);
    }
    
    // 🆕 커스텀 퀘스트 체크 (반응속도 게임 등)
    if (actionType === 'play_game' && currentStep.objective.type === 'custom') {
      const customCheck = currentStep.objective.customCheck;
      const reactionTime = metadata?.reactionTime;
      
      if (customCheck === 'reaction_game_300ms') {
        if (!reactionTime || reactionTime > 300) {
          console.log(`ℹ️ 반응속도 ${reactionTime}ms > 300ms - 카운트 안함`);
          return null;
        }
        console.log(`✅ 반응속도 ${reactionTime}ms - 300ms 이하 달성!`);
      } else if (customCheck === 'reaction_game_250ms') {
        if (!reactionTime || reactionTime > 250) {
          console.log(`ℹ️ 반응속도 ${reactionTime}ms > 250ms - 카운트 안함`);
          return null;
        }
        console.log(`✅ 반응속도 ${reactionTime}ms - 250ms 이하 달성!`);
      }
    }
    
    // 진행도 업데이트
    const stepProgressData = chainProgress.stepProgress[currentStep.id] || {
      status: 'in_progress' as QuestStatus,
      progress: 0,
      target: currentStep.objective.target,
    };
    
    const newProgress = stepProgressData.progress + 1;
    const target = currentStep.objective.target;
    const isCompleted = newProgress >= target;
    
    console.log(`📊 퀘스트 진행: ${currentStep.title} - ${newProgress}/${target}`);
    
    // Firestore 업데이트
    const questRef = doc(db, 'quests', userId);
    
    if (isCompleted) {
      // 단계 완료
      const nextStepNum = currentStepNum + 1;
      const isChainComplete = nextStepNum > activeChain.totalSteps;
      
      const updateData: Record<string, unknown> = {
        [`chains.${activeChainId}.stepProgress.${currentStep.id}.status`]: 'completed',
        [`chains.${activeChainId}.stepProgress.${currentStep.id}.progress`]: newProgress,
        [`chains.${activeChainId}.stepProgress.${currentStep.id}.completedAt`]: serverTimestamp(),
        'stats.totalQuestsCompleted': increment(1),
        'stats.totalXpEarned': increment(currentStep.rewards.xp),
        updatedAt: serverTimestamp(),
      };
      
      if (isChainComplete) {
        // 체인 완료
        updateData[`chains.${activeChainId}.status`] = 'completed';
        updateData[`chains.${activeChainId}.completedAt`] = serverTimestamp();
        
        // completedChains 배열에 추가
        const completedChainsList = [...(progress.completedChains || []), activeChainId];
        updateData['completedChains'] = completedChainsList;
        updateData['stats.totalChainsCompleted'] = increment(1);
        updateData['stats.totalXpEarned'] = increment(activeChain.completionRewards.xp);
        
        // 완료 보상 추가
        if (activeChain.completionRewards.badge) {
          updateData['earnedRewards.badges'] = [...(progress.earnedRewards?.badges || []), activeChain.completionRewards.badge];
        }
        if (activeChain.completionRewards.title) {
          updateData['earnedRewards.titles'] = [...(progress.earnedRewards?.titles || []), activeChain.completionRewards.title];
        }
        if (activeChain.completionRewards.frame) {
          updateData['earnedRewards.frames'] = [...(progress.earnedRewards?.frames || []), activeChain.completionRewards.frame];
        }
        
        // 🆕 다음 체인 자동 해금
        const currentChainIndex = chainOrder.indexOf(activeChainId);
        const nextChainId = chainOrder[currentChainIndex + 1];
        
        if (nextChainId && questChains[nextChainId]) {
          const nextChain = questChains[nextChainId];
          const firstStep = nextChain.steps[0];
          
          console.log(`✨ 다음 체인 자동 해금: ${nextChain.name} (${nextChainId})`);
          
          updateData[`chains.${nextChainId}`] = {
            currentStep: 1,
            status: 'in_progress',
            startedAt: serverTimestamp(),
            stepProgress: {
              [firstStep.id]: {
                status: 'in_progress',
                progress: 0,
                target: firstStep.objective.target,
              },
            },
          };
        }
      } else {
        // 다음 단계로 진행
        updateData[`chains.${activeChainId}.currentStep`] = nextStepNum;
        
        const nextStep = activeChain.steps.find(s => s.step === nextStepNum);
        if (nextStep) {
          updateData[`chains.${activeChainId}.stepProgress.${nextStep.id}`] = {
            status: 'in_progress',
            progress: 0,
            target: nextStep.objective.target,
          };
        }
      }
      
      // 단계 보상 추가
      if (currentStep.rewards.badge) {
        updateData['earnedRewards.badges'] = [currentStep.rewards.badge];
      }
      if (currentStep.rewards.title) {
        updateData['earnedRewards.titles'] = [currentStep.rewards.title];
      }
      
      await updateDoc(questRef, updateData);
      
      console.log(`🎉 퀘스트 완료: ${currentStep.title}`);
      
      // 사용자 경험치 지급
      await addQuestXP(userId, currentStep.rewards.xp);
      
      // 체인 완료 시 추가 보상 경험치 지급
      if (isChainComplete) {
        await addQuestXP(userId, activeChain.completionRewards.xp);
        console.log(`🎊 체인 완료 보너스: +${activeChain.completionRewards.xp} XP`);
      }
      
      // 콜백 호출
      if (onQuestCompleted) {
        onQuestCompleted(currentStep, currentStep.rewards);
      }
      
      return {
        completed: true,
        step: currentStep,
        newProgress,
        target,
        rewards: currentStep.rewards,
      };
    } else {
      // 진행도만 업데이트
      await updateDoc(questRef, {
        [`chains.${activeChainId}.stepProgress.${currentStep.id}.progress`]: newProgress,
        updatedAt: serverTimestamp(),
      });
      
      return {
        completed: false,
        step: currentStep,
        newProgress,
        target,
      };
    }
  } catch (error) {
    console.error('❌ 퀘스트 액션 처리 오류:', error);
    return null;
  }
}

/**
 * 사용자 경험치 추가 (퀘스트 보상)
 */
export async function addQuestXP(userId: string, xp: number): Promise<void> {
  try {
    const { calculateLevelFromTotalExp, getExpRequiredForNextLevel, CUMULATIVE_REQUIREMENTS } = await import('../experience');
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('❌ 사용자 문서 없음');
      return;
    }
    
    const userData = userDoc.data();
    const currentTotalExp = userData.stats?.totalExperience || 0;
    const newTotalExp = currentTotalExp + xp;
    
    // 새로운 레벨 계산
    const newLevel = calculateLevelFromTotalExp(newTotalExp);
    const levelStartExp = CUMULATIVE_REQUIREMENTS[newLevel] || 0;
    const newCurrentExp = newTotalExp - levelStartExp;
    const newCurrentLevelRequiredXp = getExpRequiredForNextLevel(newLevel);
    
    // Firestore 업데이트
    await updateDoc(userRef, {
      'stats.totalExperience': newTotalExp,
      'stats.currentExp': newCurrentExp,
      'stats.level': newLevel,
      'stats.currentLevelRequiredXp': newCurrentLevelRequiredXp,
    });
    
    console.log(`✅ 경험치 ${xp} 추가됨 (${currentTotalExp} → ${newTotalExp})`);
    console.log(`📊 레벨: ${userData.stats?.level || 1} → ${newLevel}`);
  } catch (error) {
    console.error('❌ 경험치 추가 오류:', error);
  }
}

/**
 * 각 단계별 구체적인 가이드 텍스트
 */
export const QUEST_GUIDES: Record<string, {
  howTo: string;        // 어떻게 하는지
  where: string;        // 어디서 하는지
  tip?: string;         // 팁
}> = {
  tutorial_1: {
    howTo: '닉네임을 입력하고 저장하세요',
    where: '하단 탭 → 마이페이지 → 프로필 수정',
    tip: '닉네임은 다른 친구들에게 보여지는 이름이에요!',
  },
  tutorial_2: {
    howTo: '학교를 검색하고 별(⭐) 버튼을 눌러 즐겨찾기에 추가하세요',
    where: '마이페이지 → 즐겨찾기 학교 관리',
    tip: '즐겨찾기한 학교의 게시판을 빠르게 확인할 수 있어요!',
  },
  tutorial_3: {
    howTo: '학교 게시판에 들어가서 글을 읽어보세요',
    where: '하단 탭 → 게시판 → 우리 학교',
    tip: '어떤 이야기들이 오가는지 구경해보세요!',
  },
  tutorial_4: {
    howTo: '게시판에서 새 글 작성 버튼을 눌러 글을 작성하세요',
    where: '게시판 → 우측 하단 + 버튼',
    tip: '자기소개나 질문을 올려보는 건 어때요?',
  },
  tutorial_5: {
    howTo: '다른 친구들의 글에 댓글을 달아보세요',
    where: '게시글 → 하단 댓글 입력',
    tip: '따뜻한 댓글은 모두를 행복하게 해요 😊',
  },
  tutorial_6: {
    howTo: '마음에 드는 글이나 댓글에 좋아요를 눌러보세요',
    where: '게시글/댓글 옆 하트 아이콘',
    tip: '좋아요를 받으면 작성자도 기분이 좋아져요!',
  },
  tutorial_7: {
    howTo: '미니게임을 플레이해보세요',
    where: '하단 탭 → 게임',
    tip: '게임으로 경험치도 얻고 순위에도 도전해보세요!',
  },
  tutorial_8: {
    howTo: '출석체크 버튼을 눌러 오늘의 출석을 완료하세요',
    where: '하단 탭 → 홈 → 출석체크',
    tip: '매일 출석하면 연속 출석 보상을 받을 수 있어요!',
  },
  tutorial_9: {
    howTo: '다른 학교나 지역 게시판을 방문해보세요',
    where: '게시판 → 다른 학교/지역 탭',
    tip: '다른 학교 친구들은 어떤 이야기를 할까요?',
  },
  tutorial_10: {
    howTo: '3일 연속으로 출석체크를 완료하세요',
    where: '홈 → 출석체크 (매일)',
    tip: '꾸준함이 최고의 무기! 화이팅! 💪',
  },
};
