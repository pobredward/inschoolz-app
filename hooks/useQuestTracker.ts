/**
 * 퀘스트 트래킹 훅 - 기존 액션에 퀘스트 진행도 연결 (React Native App)
 * 
 * 사용법:
 * const { trackProfileComplete, trackSchoolRegister, ... } = useQuestTracker();
 * 
 * // 프로필 저장 후
 * await trackProfileComplete();
 * 
 * // 게시글 작성 후
 * await trackCreatePost();
 */

import { useCallback } from 'react';
import { useQuest } from '../providers/QuestProvider';
import { useAuthStore } from '../store/authStore';

export function useQuestTracker() {
  const { trackAction, refreshProgress } = useQuest();
  const { user } = useAuthStore();
  
  /**
   * 닉네임 변경/설정 체크
   * - 호출 시점: 프로필 저장 시 닉네임이 변경되었을 때
   */
  const trackNicknameChange = useCallback(async () => {
    if (!user) return;
    await trackAction('nickname_change');
  }, [trackAction, user]);
  
  /**
   * 프로필 완성 체크 (레거시)
   * - 호출 시점: 프로필 저장 성공 후
   */
  const trackProfileComplete = useCallback(async () => {
    if (!user) return;
    await trackAction('profile_complete');
  }, [trackAction, user]);
  
  /**
   * 학교 등록 체크
   * - 호출 시점: 학교 정보 저장 성공 후
   */
  const trackSchoolRegister = useCallback(async () => {
    if (!user) return;
    await trackAction('school_register');
  }, [trackAction, user]);
  
  /**
   * 게시판 방문 체크
   * - 호출 시점: 게시판 페이지 진입 시
   * @param boardId 게시판 ID
   * @param isOtherSchool 다른 학교 게시판인지 여부
   */
  const trackVisitBoard = useCallback(async (boardId?: string, isOtherSchool?: boolean) => {
    if (!user) return;
    
    if (isOtherSchool) {
      await trackAction('visit_other_board', { boardId, isOtherSchool: true });
    } else {
      await trackAction('visit_board', { boardId });
    }
  }, [trackAction, user]);
  
  /**
   * 게시글 작성 체크
   * - 호출 시점: 게시글 작성 성공 후
   */
  const trackCreatePost = useCallback(async () => {
    if (!user) return;
    await trackAction('create_post');
  }, [trackAction, user]);
  
  /**
   * 댓글 작성 체크
   * - 호출 시점: 댓글 작성 성공 후
   */
  const trackCreateComment = useCallback(async () => {
    if (!user) return;
    await trackAction('create_comment');
  }, [trackAction, user]);
  
  /**
   * 좋아요 누르기 체크
   * - 호출 시점: 좋아요 성공 후
   */
  const trackGiveLike = useCallback(async () => {
    if (!user) return;
    await trackAction('give_like');
  }, [trackAction, user]);
  
  /**
   * 게임 플레이 체크
   * - 호출 시점: 게임 플레이 완료 후
   */
  const trackPlayGame = useCallback(async () => {
    if (!user) return;
    await trackAction('play_game');
  }, [trackAction, user]);
  
  /**
   * 출석체크 체크
   * - 호출 시점: 출석체크 성공 후
   * @param consecutiveDays 연속 출석 일수
   */
  const trackDailyAttendance = useCallback(async (consecutiveDays?: number) => {
    if (!user) return;
    
    // 일반 출석
    await trackAction('attendance');
    
    // 연속 출석 체크 (3일 이상)
    if (consecutiveDays && consecutiveDays >= 3) {
      await trackAction('consecutive_attendance');
    }
  }, [trackAction, user]);
  
  return {
    trackNicknameChange,
    trackProfileComplete,
    trackSchoolRegister,
    trackVisitBoard,
    trackCreatePost,
    trackCreateComment,
    trackGiveLike,
    trackPlayGame,
    trackDailyAttendance,
    refreshProgress,
  };
}

/**
 * 퀘스트 트래킹 유틸리티 함수들
 * Provider 외부에서 사용할 때 (서버 액션 등)
 */
export { trackQuestAction } from '../lib/quests/questService';

