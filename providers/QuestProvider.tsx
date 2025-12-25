/**
 * 퀘스트 Provider (React Native App)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { QuestStep, UserQuestProgress } from '../types';
import { 
  initializeUserQuests, 
  getUserQuestProgress, 
  getCurrentQuestStep,
  trackQuestAction,
  setQuestCompletedCallback,
  QuestActionType,
  QUEST_GUIDES,
} from '../lib/quests/questService';
import { tutorialChain } from '../lib/quests/chains/tutorial';

interface QuestContextType {
  // 퀘스트 상태
  questProgress: UserQuestProgress | null;
  currentStep: QuestStep | null;
  currentProgress: number;
  currentTarget: number;
  isLoading: boolean;
  
  // 가이드 정보
  currentGuide: {
    howTo: string;
    where: string;
    tip?: string;
  } | null;
  
  // 액션
  trackAction: (actionType: QuestActionType, metadata?: { 
    boardId?: string; 
    isOtherSchool?: boolean; 
    reactionTime?: number; 
    tileGameMoves?: number;
    consecutiveDays?: number;
  }) => Promise<void>;
  refreshProgress: () => Promise<void>;
}

const QuestContext = createContext<QuestContextType | undefined>(undefined);

export function useQuest() {
  const context = useContext(QuestContext);
  if (context === undefined) {
    throw new Error('useQuest must be used within a QuestProvider');
  }
  return context;
}

interface QuestProviderProps {
  children: ReactNode;
}

export function QuestProvider({ children }: QuestProviderProps) {
  const { user } = useAuthStore();
  const [questProgress, setQuestProgress] = useState<UserQuestProgress | null>(null);
  const [currentStep, setCurrentStep] = useState<QuestStep | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentTarget, setCurrentTarget] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // 완료 모달 상태
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [completedStep, setCompletedStep] = useState<QuestStep | null>(null);
  const [completedRewards, setCompletedRewards] = useState<{ xp: number; badge?: string; title?: string } | null>(null);
  
  // 애니메이션
  const scaleAnim = useState(new Animated.Value(0))[0];
  const rotateAnim = useState(new Animated.Value(0))[0];
  
  // 현재 가이드
  const currentGuide = currentStep ? QUEST_GUIDES[currentStep.id] : null;
  
  // 퀘스트 완료 콜백 등록
  useEffect(() => {
    setQuestCompletedCallback((step, rewards) => {
      console.log('🎉 퀘스트 완료 콜백 호출:', step.title);
      setCompletedStep(step);
      setCompletedRewards(rewards);
      setShowCompletedModal(true);
      
      // 애니메이션 시작
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);
  
  // 퀘스트 진행 상태 로드
  const loadQuestProgress = useCallback(async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 퀘스트 진행 상태 조회 (없으면 초기화)
      let progress = await getUserQuestProgress(user.uid);
      if (!progress) {
        progress = await initializeUserQuests(user.uid);
      }
      
      setQuestProgress(progress);
      
      // 현재 단계 조회
      const current = await getCurrentQuestStep(user.uid);
      if (current) {
        setCurrentStep(current.step);
        setCurrentProgress(current.progress);
        setCurrentTarget(current.target);
      } else {
        // 튜토리얼 완료 상태
        setCurrentStep(null);
        setCurrentProgress(0);
        setCurrentTarget(0);
      }
    } catch (error) {
      console.error('❌ 퀘스트 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);
  
  // 초기 로드
  useEffect(() => {
    loadQuestProgress();
  }, [loadQuestProgress]);
  
  // 퀘스트 액션 추적
  const trackAction = useCallback(async (
    actionType: QuestActionType,
    metadata?: { 
      boardId?: string; 
      isOtherSchool?: boolean; 
      reactionTime?: number; 
      tileGameMoves?: number;
      consecutiveDays?: number;
    }
  ) => {
    if (!user?.uid) return;
    
    console.log(`📍 퀘스트 액션 추적: ${actionType}`, metadata);
    
    const result = await trackQuestAction(user.uid, actionType, user, metadata);
    
    if (result) {
      // 진행도 업데이트
      if (result.newProgress !== undefined) {
        setCurrentProgress(result.newProgress);
      }
      
      // 완료된 경우 다음 단계로 갱신
      if (result.completed) {
        await loadQuestProgress();
      }
    }
  }, [user?.uid, user, loadQuestProgress]);
  
  // 진행 상태 새로고침
  const refreshProgress = useCallback(async () => {
    await loadQuestProgress();
  }, [loadQuestProgress]);
  
  // 모달 닫기
  const closeModal = () => {
    scaleAnim.setValue(0);
    rotateAnim.setValue(0);
    setShowCompletedModal(false);
  };
  
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-180deg', '0deg'],
  });
  
  return (
    <QuestContext.Provider
      value={{
        questProgress,
        currentStep,
        currentProgress,
        currentTarget,
        isLoading,
        currentGuide,
        trackAction,
        refreshProgress,
      }}
    >
      {children}
      
      {/* 퀘스트 완료 모달 */}
      <Modal
        visible={showCompletedModal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [
                  { scale: scaleAnim },
                  { rotate: rotateInterpolate },
                ],
              },
            ]}
          >
            {/* 아이콘 */}
            <Text style={styles.celebrationEmoji}>🎉</Text>
            
            {/* 타이틀 */}
            <Text style={styles.modalTitle}>퀘스트 완료!</Text>
            
            {/* 퀘스트 정보 */}
            {completedStep && (
              <View style={styles.questInfo}>
                <Text style={styles.questIcon}>{completedStep.icon}</Text>
                <Text style={styles.questTitle}>{completedStep.title}</Text>
                <Text style={styles.questStory}>"{completedStep.storyText}"</Text>
              </View>
            )}
            
            {/* 보상 */}
            {completedRewards && (
              <View style={styles.rewardsContainer}>
                <Text style={styles.rewardsLabel}>획득한 보상</Text>
                <View style={styles.rewardsList}>
                  <View style={styles.rewardItem}>
                    <Text style={styles.rewardEmoji}>⭐</Text>
                    <Text style={styles.rewardText}>+{completedRewards.xp} XP</Text>
                  </View>
                  {completedRewards.badge && (
                    <View style={[styles.rewardItem, styles.badgeReward]}>
                      <Text style={styles.rewardEmoji}>🏅</Text>
                      <Text style={styles.rewardText}>배지</Text>
                    </View>
                  )}
                  {completedRewards.title && (
                    <View style={[styles.rewardItem, styles.titleReward]}>
                      <Text style={styles.rewardEmoji}>👑</Text>
                      <Text style={styles.rewardText}>{completedRewards.title}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            
            {/* 닫기 버튼 */}
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Text style={styles.closeButtonText}>확인</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </QuestContext.Provider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FEF3C7',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 16,
  },
  questInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  questIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  questTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  questStory: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  rewardsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  rewardsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  rewardsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  badgeReward: {
    backgroundColor: '#E9D5FF',
  },
  titleReward: {
    backgroundColor: '#FEF3C7',
  },
  rewardEmoji: {
    fontSize: 18,
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});







