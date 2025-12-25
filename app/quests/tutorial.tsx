import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  getUserQuestProgress, 
  QUEST_GUIDES, 
  questChains, 
  chainOrder,
} from '../../lib/quests/questService';
import { QuestStep, UserQuestProgress } from '../../types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function TutorialQuestPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserQuestProgress | null>(null);
  const [expandedChains, setExpandedChains] = useState<string[]>([]);
  
  useEffect(() => {
    loadQuestData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  
  const loadQuestData = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const userProgress = await getUserQuestProgress(user.uid);
      
      console.log('📊 퀘스트 진행 상황:', {
        chains: userProgress?.chains,
        chainOrder,
      });
      
      if (userProgress) {
        setProgress(userProgress);
        
        // 진행 중인 체인 찾기
        const activeChainId = getActiveChainId(userProgress);
        console.log('🎯 활성 체인:', activeChainId);
        setExpandedChains([activeChainId]);
        
        // 자동 해금 체크
        await checkAndUnlockNextChain(userProgress);
      }
    } catch (error) {
      console.error('퀘스트 데이터 로드 오류:', error);
      Alert.alert('오류', '퀘스트 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  const getActiveChainId = (questProgress: UserQuestProgress) => {
    // 진행 중인 체인 찾기
    for (const chainId of chainOrder) {
      const chainProgress = questProgress.chains[chainId];
      if (chainProgress && chainProgress.status === 'in_progress') {
        console.log('✅ 진행 중인 체인 발견:', chainId);
        return chainId;
      }
    }
    
    // 진행 중인 체인이 없으면 첫 번째 체인 반환 (보통은 tutorial)
    console.log('⚠️ 진행 중인 체인 없음, 첫 번째 체인 반환:', chainOrder[0]);
    return chainOrder[0];
  };
  
  const checkAndUnlockNextChain = async (questProgress: UserQuestProgress) => {
    if (!user?.uid) return;
    
    const tutorialProgress = questProgress.chains.tutorial;
    const newbieProgress = questProgress.chains['newbie-growth'];
    
    console.log('🔍 자동 해금 체크:', {
      tutorial: tutorialProgress?.status,
      'newbie-growth': newbieProgress?.status,
    });
    
    if (tutorialProgress?.status === 'completed' && !newbieProgress) {
      console.log('🔓 tutorial 완료됨, newbie-growth 자동 생성 중...');
      
      try {
        const nextChain = questChains['newbie-growth'];
        const firstStep = nextChain.steps[0];
        
        const questRef = doc(db, 'quests', user.uid);
        await updateDoc(questRef, {
          [`chains.newbie-growth`]: {
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
          },
          updatedAt: serverTimestamp(),
        });
        
        console.log('✅ newbie-growth 체인 생성 완료!');
        
        // 상태 새로고침
        await loadQuestData();
      } catch (error) {
        console.error('❌ newbie-growth 생성 오류:', error);
      }
    }
  };
  
  const toggleChain = (chainId: string) => {
    setExpandedChains(prev =>
      prev.includes(chainId)
        ? prev.filter(id => id !== chainId)
        : [...prev, chainId]
    );
  };
  
  const renderChainCard = (chainId: string) => {
    const chain = questChains[chainId];
    
    if (!chain) {
      console.error(`❌ 체인 정의를 찾을 수 없음: ${chainId}`);
      return null;
    }
    
    const chainProgress = progress?.chains[chainId];
    const isExpanded = expandedChains.includes(chainId);
    const isActive = chainProgress?.status === 'in_progress';
    const isCompleted = chainProgress?.status === 'completed';
    const isLocked = !chainProgress || chainProgress.status === 'locked';
    
    console.log(`🔖 체인 렌더링 [${chainId}]:`, {
      chainName: chain.name,
      status: chainProgress?.status || 'undefined',
      isActive,
      isCompleted,
      isLocked,
      isExpanded,
      hasProgress: !!chainProgress,
    });
    
    // 완료된 단계 수 계산
    const completedSteps = chain.steps.filter(step => {
      const stepProgress = chainProgress?.stepProgress[step.id];
      return stepProgress?.status === 'completed';
    }).length;
    
    const currentStepNum = chainProgress?.currentStep || 0;
    const progressPercent = (currentStepNum / chain.totalSteps) * 100;
    
    return (
      <View
        key={chainId}
        style={[
          styles.chainCard,
          isActive && styles.chainCardActive,
          isCompleted && styles.chainCardCompleted,
        ]}
      >
        {/* 체인 헤더 */}
        <TouchableOpacity
          onPress={() => !isLocked && toggleChain(chainId)}
          disabled={isLocked}
          style={styles.chainHeader}
        >
          <View style={styles.chainIconContainer}>
            <Text style={[styles.chainIcon, isLocked && styles.lockedIcon]}>
              {isLocked ? '🔒' : chain.icon}
            </Text>
          </View>
          
          <View style={styles.chainInfo}>
            <View style={styles.chainTitleRow}>
              <Text style={styles.chainTitle}>{chain.name}</Text>
              {isActive && <Text style={styles.chainBadgeActive}>진행 중</Text>}
              {isCompleted && <Text style={styles.chainBadgeCompleted}>완료</Text>}
              {isLocked && <Text style={styles.chainBadgeLocked}>잠김</Text>}
            </View>
            <Text style={styles.chainDescription}>{chain.description}</Text>
            
            {/* 진행도 바 */}
            {!isLocked && (
              <>
                <View style={styles.chainProgressHeader}>
                  <Text style={styles.chainProgressLabel}>진행도</Text>
                  <Text style={styles.chainProgressValue}>
                    {completedSteps} / {chain.totalSteps}
                  </Text>
                </View>
                <View style={styles.chainProgressBar}>
                  <View
                    style={[
                      styles.chainProgressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: isCompleted ? '#10B981' : '#3B82F6',
                      },
                    ]}
                  />
                </View>
              </>
            )}
          </View>
          
          {!isLocked && (
            <Text style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}>
              ▼
            </Text>
          )}
        </TouchableOpacity>
        
        {/* 체인 상세 (펼쳤을 때) */}
        {isExpanded && !isLocked && (
          <View style={styles.chainContent}>
            {/* 퀘스트 단계들 */}
            <View style={styles.stepsContainer}>
              {chain.steps.map((step) => renderStep(step, chainProgress))}
            </View>
            
            {/* 완료 보상 */}
            <View style={[
              styles.completionCard,
              isCompleted && styles.completionCardCompleted
            ]}>
              <Text style={styles.completionTitle}>
                {isCompleted ? '🎉 체인 완료 보상' : '🏆 완료 시 획득 가능'}
              </Text>
              <View style={styles.completionRewardsList}>
                <View style={styles.completionRewardItem}>
                  <Text style={styles.completionRewardIcon}>⭐</Text>
                  <Text style={styles.completionRewardText}>
                    {chain.completionRewards.xp} XP
                  </Text>
                </View>
                {chain.completionRewards.title && (
                  <View style={styles.completionRewardItem}>
                    <Text style={styles.completionRewardIcon}>👑</Text>
                    <Text style={styles.completionRewardText}>
                      칭호: {chain.completionRewards.title}
                    </Text>
                  </View>
                )}
                {chain.completionRewards.badge && (
                  <View style={styles.completionRewardItem}>
                    <Text style={styles.completionRewardIcon}>🎖️</Text>
                    <Text style={styles.completionRewardText}>
                      배지: {chain.completionRewards.badge}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };
  
  const renderStep = (step: QuestStep, chainProgress: UserQuestProgress['chains'][string]) => {
    const stepProgress = chainProgress?.stepProgress[step.id];
    const isCompleted = stepProgress?.status === 'completed';
    const isInProgress = stepProgress?.status === 'in_progress';
    const isLocked = !stepProgress || stepProgress.status === 'locked';
    
    const progressValue = stepProgress?.progress || 0;
    const targetValue = step.objective.target;
    const stepProgressPercent = targetValue > 0 ? (progressValue / targetValue) * 100 : 0;
    
    // 가이드 정보
    const guide = QUEST_GUIDES[step.id];
    
    if (isLocked) {
      return (
        <View key={step.id} style={styles.stepCardLocked}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepIcon}>🔒</Text>
            <View style={styles.stepInfo}>
              <Text style={styles.stepNumber}>단계 {step.step}</Text>
              <Text style={styles.lockedLabel}>잠김</Text>
            </View>
          </View>
        </View>
      );
    }
    
    return (
      <View
        key={step.id}
        style={[
          styles.stepCard,
          isCompleted && styles.stepCardCompleted,
          isInProgress && styles.stepCardInProgress,
        ]}
      >
        {/* 단계 헤더 */}
        <View style={styles.stepHeader}>
          <View style={styles.stepIconContainer}>
            <Text style={styles.stepIcon}>{step.icon || '🎯'}</Text>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>✓</Text>
              </View>
            )}
          </View>
          
          <View style={styles.stepInfo}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepNumber}>단계 {step.step}</Text>
              {isCompleted && <Text style={styles.completedLabel}>완료</Text>}
              {isInProgress && <Text style={styles.inProgressLabel}>진행 중</Text>}
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        </View>
        
        {/* 진행 중인 경우 추가 정보 */}
        {isInProgress && (
          <View style={styles.inProgressSection}>
            {/* 스토리 텍스트 */}
            <View style={styles.storySection}>
              <Text style={styles.storyText}>&quot;{step.storyText}&quot;</Text>
            </View>
            
            {/* 가이드 */}
            {guide && (
              <View style={styles.guideSection}>
                <View style={styles.guideHeader}>
                  <Text style={styles.guideEmoji}>📍</Text>
                  <Text style={styles.guideTitle}>어떻게 하나요?</Text>
                </View>
                <Text style={styles.guideHowTo}>{guide.howTo}</Text>
              </View>
            )}
            
            {/* 진행도 바 */}
            <View style={styles.stepProgressSection}>
              <View style={styles.stepProgressHeader}>
                <Text style={styles.stepProgressLabel}>진행도</Text>
                <Text style={styles.stepProgressValue}>
                  {progressValue} / {targetValue}
                </Text>
              </View>
              <View style={styles.stepProgressBar}>
                <View
                  style={[
                    styles.stepProgressFill,
                    { 
                      width: `${stepProgressPercent}%`,
                      backgroundColor: step.color || '#3B82F6',
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}
        
        {/* 보상 섹션 */}
        <View style={styles.rewardsSection}>
          <Text style={styles.rewardsTitle}>보상</Text>
          <View style={styles.rewardsList}>
            <View style={styles.rewardItem}>
              <Text style={styles.rewardIcon}>⭐</Text>
              <Text style={styles.rewardText}>{step.rewards.xp} XP</Text>
            </View>
            {step.rewards.badge && (
              <View style={styles.rewardItem}>
                <Text style={styles.rewardIcon}>🎖️</Text>
                <Text style={styles.rewardText}>배지</Text>
              </View>
            )}
            {step.rewards.title && (
              <View style={styles.rewardItem}>
                <Text style={styles.rewardIcon}>👑</Text>
                <Text style={styles.rewardText}>{step.rewards.title}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>퀘스트 불러오는 중...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>🎮</Text>
          <View>
            <Text style={styles.headerTitle}>퀘스트</Text>
            <Text style={styles.headerDescription}>모든 퀘스트 체인을 확인하세요</Text>
          </View>
        </View>
      </View>
      
      {/* 컨텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.chainsContainer}>
          {chainOrder.map(chainId => renderChainCard(chainId))}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: 'white',
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 28,
    color: '#3B82F6',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 48,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  chainsContainer: {
    padding: 20,
  },
  chainCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  chainCardActive: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  chainCardCompleted: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  chainHeader: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  chainIconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chainIcon: {
    fontSize: 48,
  },
  lockedIcon: {
    opacity: 0.5,
  },
  chainInfo: {
    flex: 1,
  },
  chainTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 8,
  },
  chainBadgeActive: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chainBadgeCompleted: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chainBadgeLocked: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chainDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  chainProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chainProgressLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  chainProgressValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  chainProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chainProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  expandIcon: {
    fontSize: 18,
    color: '#6B7280',
    marginLeft: 8,
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  chainContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepsContainer: {
    marginBottom: 12,
  },
  stepCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  stepCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  stepCardInProgress: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  stepCardLocked: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    opacity: 0.6,
  },
  stepHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  stepIcon: {
    fontSize: 40,
  },
  completedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#10B981',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  completedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  inProgressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  lockedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  inProgressSection: {
    // gap 제거: React Native 호환성
  },
  storySection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  storyText: {
    fontSize: 13,
    color: '#4B5563',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  guideSection: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  guideEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400E',
  },
  guideHowTo: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
  },
  stepProgressSection: {
    marginTop: 4,
  },
  stepProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepProgressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  stepProgressValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  stepProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  stepProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  rewardsSection: {
    marginTop: 12,
  },
  rewardsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  rewardsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4, // 음수 마진으로 간격 조정
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    margin: 4, // 각 아이템에 마진 추가
  },
  rewardIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  completionCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  completionCardCompleted: {
    backgroundColor: '#FEF3C7',
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  completionRewardsList: {
    // gap 제거
  },
  completionRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  completionRewardIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  completionRewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
});
