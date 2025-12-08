import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { initializeUserQuests } from '../lib/quests/questService';

/**
 * 사용자 로그인 시 퀘스트 자동 초기화 훅
 */
export function useQuestInitializer() {
  const { user } = useAuthStore();
  
  useEffect(() => {
    const initQuests = async () => {
      if (user?.uid) {
        try {
          console.log('🎮 퀘스트 초기화 시도:', user.uid);
          await initializeUserQuests(user.uid);
          console.log('✅ 퀘스트 초기화 완료');
        } catch (error) {
          console.error('❌ 퀘스트 초기화 오류:', error);
        }
      }
    };
    
    initQuests();
  }, [user?.uid]);
}

