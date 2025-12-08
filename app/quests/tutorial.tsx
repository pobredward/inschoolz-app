import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { getUserQuestProgress, QUEST_GUIDES } from '../../lib/quests/questService';
import { tutorialChain } from '../../lib/quests/chains/tutorial';
import { QuestStep, UserQuestProgress } from '../../types';

export default function TutorialQuestPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserQuestProgress | null>(null);
  const [steps, setSteps] = useState<QuestStep[]>([]);
  
  useEffect(() => {
    loadQuestData();
  }, [user?.uid]);
  
  const loadQuestData = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const userProgress = await getUserQuestProgress(user.uid);
      
      if (userProgress) {
        setProgress(userProgress);
        
        // 단계별 진행도 업데이트
        const updatedSteps = tutorialChain.steps.map(step => {
          const chainProgress = userProgress.chains.tutorial;
          const stepProgress = chainProgress?.stepProgress[step.id];
          
          if (stepProgress) {
            return {
              ...step,
              objective: {
                ...step.objective,
                current: stepProgress.progress,
              },
              status: stepProgress.status,
            };
          }
          
          return step;
        });
        
        setSteps(updatedSteps);
      }
    } catch (error) {
      console.error('퀘스트 데이터 로드 오류:', error);
      Alert.alert('오류', '퀘스트 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  const renderProgressBar = () => {
    if (!progress) return null;
    
    const chainProgress = progress.chains.tutorial;
    const currentStepNum = chainProgress?.currentStep || 0;
    const progressPercent = (currentStepNum / tutorialChain.totalSteps) * 100;
    
    return (
      <View style={styles.overallProgress}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>전체 진행도</Text>
          <Text style={styles.progressText}>
            {currentStepNum} / {tutorialChain.totalSteps}
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>
    );
  };
  
  const renderStep = (step: QuestStep, index: number) => {
    const isCompleted = step.status === 'completed';
    const isInProgress = step.status === 'in_progress';
    const isAvailable = step.status === 'available' || step.status === 'in_progress';
    const isLocked = step.status === 'locked';
    
    const progressValue = step.objective.current || 0;
    const targetValue = step.objective.target;
    const stepProgressPercent = (progressValue / targetValue) * 100;
    
    // 가이드 정보
    const guide = QUEST_GUIDES[step.id];
    
    return (
      <View
        key={step.id}
        style={[
          styles.stepCard,
          isCompleted && styles.stepCardCompleted,
          isInProgress && styles.stepCardInProgress,
          isLocked && styles.stepCardLocked,
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
            {isLocked && (
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedBadgeText}>🔒</Text>
              </View>
            )}
          </View>
          
          <View style={styles.stepInfo}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepNumber}>단계 {step.step}</Text>
              {isCompleted && <Text style={styles.completedLabel}>완료</Text>}
              {isAvailable && !isCompleted && <Text style={styles.inProgressLabel}>진행 중</Text>}
              {isLocked && <Text style={styles.lockedLabel}>잠김</Text>}
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        </View>
        
        {/* 스토리 텍스트 */}
        <View style={styles.storySection}>
          <Text style={styles.storyText}>"{step.storyText}"</Text>
        </View>
        
        {/* 구체적인 가이드 (진행 중인 경우만) */}
        {isInProgress && guide && (
          <View style={styles.guideSection}>
            <View style={styles.guideHeader}>
              <Text style={styles.guideEmoji}>📍</Text>
              <Text style={styles.guideTitle}>어떻게 하나요?</Text>
            </View>
            <Text style={styles.guideHowTo}>{guide.howTo}</Text>
            <Text style={styles.guideWhere}>
              <Text style={styles.guideWhereLabel}>📌 위치: </Text>
              {guide.where}
            </Text>
            {guide.tip && (
              <Text style={styles.guideTip}>
                <Text style={styles.guideTipLabel}>💡 팁: </Text>
                {guide.tip}
              </Text>
            )}
          </View>
        )}
        
        {/* 진행도 바 (완료되지 않은 경우만) */}
        {!isCompleted && isAvailable && (
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
  
  const renderCompletionRewards = () => {
    const chainProgress = progress?.chains.tutorial;
    const isCompleted = chainProgress?.status === 'completed';
    
    return (
      <View style={[styles.completionCard, isCompleted && styles.completionCardCompleted]}>
        <Text style={styles.completionTitle}>
          {isCompleted ? '🎉 체인 완료!' : '🏆 완료 보상'}
        </Text>
        <Text style={styles.completionDescription}>
          {isCompleted
            ? '축하합니다! 인스쿨즈 입학기를 완료했습니다!'
            : '모든 단계를 완료하면 다음 보상을 받을 수 있습니다:'}
        </Text>
        
        <View style={styles.completionRewardsList}>
          <View style={styles.completionRewardItem}>
            <Text style={styles.completionRewardIcon}>⭐</Text>
            <Text style={styles.completionRewardText}>
              {tutorialChain.completionRewards.xp} XP
            </Text>
          </View>
          
          {tutorialChain.completionRewards.badge && (
            <View style={styles.completionRewardItem}>
              <Text style={styles.completionRewardIcon}>🎖️</Text>
              <Text style={styles.completionRewardText}>
                {tutorialChain.completionRewards.badge}
              </Text>
            </View>
          )}
          
          {tutorialChain.completionRewards.title && (
            <View style={styles.completionRewardItem}>
              <Text style={styles.completionRewardIcon}>👑</Text>
              <Text style={styles.completionRewardText}>
                칭호: {tutorialChain.completionRewards.title}
              </Text>
            </View>
          )}
          
          {tutorialChain.completionRewards.frame && (
            <View style={styles.completionRewardItem}>
              <Text style={styles.completionRewardIcon}>🖼️</Text>
              <Text style={styles.completionRewardText}>
                {tutorialChain.completionRewards.frame}
              </Text>
            </View>
          )}
          
          {tutorialChain.completionRewards.items && tutorialChain.completionRewards.items.length > 0 && (
            <View style={styles.completionRewardItem}>
              <Text style={styles.completionRewardIcon}>📦</Text>
              <Text style={styles.completionRewardText}>
                {tutorialChain.completionRewards.items.join(', ')}
              </Text>
            </View>
          )}
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
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>{tutorialChain.icon}</Text>
          <View>
            <Text style={styles.headerTitle}>{tutorialChain.name}</Text>
            <Text style={styles.headerDescription}>{tutorialChain.description}</Text>
          </View>
        </View>
      </View>
      
      {/* 컨텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 전체 진행도 */}
        {renderProgressBar()}
        
        {/* 퀘스트 단계들 */}
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => renderStep(step, index))}
        </View>
        
        {/* 완료 보상 */}
        {renderCompletionRewards()}
        
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
    paddingTop: 50,
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
    gap: 12,
  },
  headerIcon: {
    fontSize: 48,
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
  overallProgress: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 6,
  },
  stepsContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  stepCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stepCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  stepCardInProgress: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  stepCardLocked: {
    opacity: 0.6,
  },
  stepHeader: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  stepIconContainer: {
    position: 'relative',
  },
  stepIcon: {
    fontSize: 48,
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
  lockedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
  },
  lockedBadgeText: {
    fontSize: 16,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  storySection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  storyText: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  guideSection: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guideEmoji: {
    fontSize: 16,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
  },
  guideHowTo: {
    fontSize: 14,
    color: '#B45309',
    marginBottom: 8,
    lineHeight: 20,
  },
  guideWhere: {
    fontSize: 12,
    color: '#D97706',
    marginBottom: 4,
  },
  guideWhereLabel: {
    fontWeight: '600',
  },
  guideTip: {
    fontSize: 12,
    color: '#D97706',
  },
  guideTipLabel: {
    fontWeight: '600',
  },
  stepProgressSection: {
    marginBottom: 16,
  },
  stepProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepProgressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  stepProgressValue: {
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  rewardsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  rewardIcon: {
    fontSize: 14,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  completionCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  completionCardCompleted: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderStyle: 'solid',
  },
  completionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  completionDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  completionRewardsList: {
    gap: 12,
  },
  completionRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  completionRewardIcon: {
    fontSize: 24,
  },
  completionRewardText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
});

