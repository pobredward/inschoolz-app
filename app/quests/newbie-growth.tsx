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
import { newbieGrowthChain } from '../../lib/quests/chains/newbie-growth';
import { QuestStep, UserQuestProgress } from '../../types';

export default function NewbieGrowthQuestPage() {
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
        const updatedSteps = newbieGrowthChain.steps.map(step => {
          const chainProgress = userProgress.chains['newbie-growth'];
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
    
    const chainProgress = progress.chains['newbie-growth'];
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const progressPercent = (completedSteps / newbieGrowthChain.totalSteps) * 100;
    
    return (
      <View style={styles.overallProgress}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>전체 진행도</Text>
          <Text style={styles.progressText}>
            {completedSteps} / {newbieGrowthChain.totalSteps}
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        
        {chainProgress?.status === 'completed' && (
          <View style={styles.completionBanner}>
            <Text style={styles.completionIcon}>🎉</Text>
            <View style={styles.completionText}>
              <Text style={styles.completionTitle}>체인 완료!</Text>
              <Text style={styles.completionSubtitle}>축하합니다! 새내기를 졸업했어요!</Text>
            </View>
          </View>
        )}
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
    const guide = QUEST_GUIDES[step.objective.type];
    
    return (
      <View key={step.id} style={[
        styles.stepCard,
        isInProgress && styles.stepCardActive,
        isLocked && styles.stepCardLocked,
      ]}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepNumber,
            isCompleted && styles.stepNumberCompleted,
            isInProgress && styles.stepNumberActive,
            isLocked && styles.stepNumberLocked,
          ]}>
            <Text style={[
              styles.stepNumberText,
              (isInProgress || isCompleted) && styles.stepNumberTextActive,
            ]}>
              {isCompleted ? '✓' : (step.icon || step.step)}
            </Text>
          </View>
          
          <View style={styles.stepInfo}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepLabel}>{step.step}단계</Text>
              {isInProgress && <View style={styles.badge}><Text style={styles.badgeText}>진행 중</Text></View>}
              {isCompleted && <View style={styles.badgeCompleted}><Text style={styles.badgeTextCompleted}>완료</Text></View>}
              {isLocked && <View style={styles.badgeLocked}><Text style={styles.badgeTextLocked}>🔒 잠김</Text></View>}
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
            <Text style={styles.stepStory}>{step.storyText}</Text>
          </View>
        </View>
        
        {/* 진행도 바 */}
        {!isCompleted && !isLocked && (
          <View style={styles.stepProgressContainer}>
            <View style={styles.stepProgressHeader}>
              <Text style={styles.stepProgressLabel}>진행도</Text>
              <Text style={styles.stepProgressText}>{progressValue} / {targetValue}</Text>
            </View>
            <View style={styles.stepProgressBar}>
              <View style={[styles.stepProgressBarFill, { width: `${Math.min(stepProgressPercent, 100)}%` }]} />
            </View>
          </View>
        )}
        
        {/* 보상 */}
        <View style={styles.rewards}>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardIcon}>⭐</Text>
            <Text style={styles.rewardText}>+{step.rewards.xp} XP</Text>
          </View>
          {step.rewards.badge && (
            <View style={styles.rewardItem}>
              <Text style={styles.rewardIcon}>🏅</Text>
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
        
        {/* 가이드 */}
        {isInProgress && guide && (
          <View style={styles.guideContainer}>
            <Text style={styles.guideIcon}>💡</Text>
            <Text style={styles.guideText}>{guide}</Text>
          </View>
        )}
      </View>
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>퀘스트 정보 불러오는 중...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 뒤로</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerIcon}>{newbieGrowthChain.icon}</Text>
          <View>
            <Text style={styles.headerTitle}>{newbieGrowthChain.name}</Text>
            <Text style={styles.headerSubtitle}>{newbieGrowthChain.description}</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderProgressBar()}
        
        {steps.map((step, index) => renderStep(step, index))}
        
        {/* 체인 완료 보상 */}
        {progress?.chains['newbie-growth']?.status !== 'completed' && (
          <View style={styles.chainRewards}>
            <Text style={styles.chainRewardsTitle}>🎁 체인 완료 보상</Text>
            <View style={styles.chainRewardsGrid}>
              <View style={styles.chainRewardItem}>
                <Text style={styles.chainRewardIcon}>⭐</Text>
                <Text style={styles.chainRewardText}>+{newbieGrowthChain.completionRewards.xp} XP</Text>
              </View>
              {newbieGrowthChain.completionRewards.badge && (
                <View style={styles.chainRewardItem}>
                  <Text style={styles.chainRewardIcon}>🏅</Text>
                  <Text style={styles.chainRewardText}>{newbieGrowthChain.completionRewards.badge}</Text>
                </View>
              )}
              {newbieGrowthChain.completionRewards.title && (
                <View style={styles.chainRewardItem}>
                  <Text style={styles.chainRewardIcon}>👑</Text>
                  <Text style={styles.chainRewardText}>{newbieGrowthChain.completionRewards.title}</Text>
                </View>
              )}
              {newbieGrowthChain.completionRewards.frame && (
                <View style={styles.chainRewardItem}>
                  <Text style={styles.chainRewardIcon}>🖼️</Text>
                  <Text style={styles.chainRewardText}>{newbieGrowthChain.completionRewards.frame}</Text>
                </View>
              )}
              {newbieGrowthChain.completionRewards.items && newbieGrowthChain.completionRewards.items.length > 0 && (
                <View style={styles.chainRewardItem}>
                  <Text style={styles.chainRewardIcon}>📦</Text>
                  <Text style={styles.chainRewardText}>{newbieGrowthChain.completionRewards.items.length}개 상자</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '500',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  overallProgress: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 6,
  },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  completionIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  completionText: {
    flex: 1,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
  },
  completionSubtitle: {
    fontSize: 13,
    color: '#047857',
    marginTop: 2,
  },
  stepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  stepCardActive: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  stepCardLocked: {
    opacity: 0.5,
  },
  stepHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberCompleted: {
    backgroundColor: '#D1FAE5',
  },
  stepNumberActive: {
    backgroundColor: '#10B981',
  },
  stepNumberLocked: {
    backgroundColor: '#E5E7EB',
  },
  stepNumberText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepNumberTextActive: {
    color: '#ffffff',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#047857',
  },
  badgeCompleted: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeTextCompleted: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  badgeLocked: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeTextLocked: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  stepStory: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  stepProgressContainer: {
    marginTop: 12,
  },
  stepProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepProgressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  stepProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  stepProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  stepProgressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  rewards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  rewardIcon: {
    fontSize: 14,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  guideContainer: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  guideIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  guideText: {
    flex: 1,
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  chainRewards: {
    backgroundColor: '#D1FAE5',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  chainRewardsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 12,
  },
  chainRewardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chainRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  chainRewardIcon: {
    fontSize: 16,
  },
  chainRewardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
});
