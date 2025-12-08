import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useQuest } from '../../providers/QuestProvider';
import { tutorialChain } from '../../lib/quests/chains/tutorial';
import { QUEST_GUIDES } from '../../lib/quests/questService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_SIZE = 60;
const PREVIEW_CARD_WIDTH = SCREEN_WIDTH - 40;

export default function FloatingQuestButton() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentStep, currentProgress, currentTarget, questProgress, currentGuide } = useQuest();
  
  const [showPreview, setShowPreview] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // 현재 단계 번호
  const currentStepNum = questProgress?.chains?.tutorial?.currentStep || 1;
  const isCompleted = questProgress?.chains?.tutorial?.status === 'completed';
  const progressPercent = currentTarget > 0 ? (currentProgress / currentTarget) * 100 : 0;
  
  // 드래그 위치 상태
  const pan = useState(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - BUTTON_SIZE - 20,
      y: SCREEN_HEIGHT / 2 - BUTTON_SIZE / 2,
    })
  )[0];
  
  // 펄스 애니메이션
  const pulseAnim = useState(new Animated.Value(1))[0];
  
  useEffect(() => {
    setIsVisible(true);
  }, [user?.uid]);
  
  useEffect(() => {
    if (!isCompleted) {
      // 펄스 애니메이션
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isCompleted]);
  
  // 드래그 핸들러
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.setOffset({
        x: (pan.x as any)._value,
        y: (pan.y as any)._value,
      });
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gesture) => {
      pan.flattenOffset();
      
      const finalX = Math.max(
        0,
        Math.min((pan.x as any)._value, SCREEN_WIDTH - BUTTON_SIZE)
      );
      const finalY = Math.max(
        0,
        Math.min((pan.y as any)._value, SCREEN_HEIGHT - BUTTON_SIZE - 100)
      );
      
      const distance = Math.sqrt(gesture.dx * gesture.dx + gesture.dy * gesture.dy);
      
      if (distance < 10) {
        handleButtonClick();
        return;
      }
      
      Animated.spring(pan, {
        toValue: { x: finalX, y: finalY },
        useNativeDriver: false,
      }).start();
    },
  });
  
  const handleViewDetails = () => {
    setShowPreview(false);
    router.push('/quests/tutorial');
  };
  
  const handleButtonClick = () => {
    if (user) {
      setShowPreview(true);
    } else {
      router.push('/login');
    }
  };
  
  // 로그인하지 않은 경우
  if (!user) {
    const loginPanResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        
        const finalX = Math.max(
          0,
          Math.min((pan.x as any)._value, SCREEN_WIDTH - BUTTON_SIZE)
        );
        const finalY = Math.max(
          0,
          Math.min((pan.y as any)._value, SCREEN_HEIGHT - BUTTON_SIZE - 100)
        );
        
        const distance = Math.sqrt(gesture.dx * gesture.dx + gesture.dy * gesture.dy);
        
        if (distance < 10) {
          router.push('/login');
          return;
        }
        
        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
        }).start();
      },
    });
    
    return (
      <Animated.View
        style={[
          styles.floatingButton,
          {
            left: pan.x,
            top: pan.y,
          },
        ]}
        {...loginPanResponder.panHandlers}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={[styles.button, { backgroundColor: '#9CA3AF' }]}>
            <Text style={styles.buttonIcon}>🎓</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>?</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    );
  }
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <>
      {/* Floating Button */}
      <Animated.View
        style={[
          styles.floatingButton,
          {
            left: pan.x,
            top: pan.y,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={{ transform: [{ scale: isCompleted ? 1 : pulseAnim }] }}>
          <View style={[
            styles.button, 
            { 
              backgroundColor: isCompleted 
                ? '#F59E0B' 
                : (currentStep?.color || '#3B82F6') 
            }
          ]}>
            <Text style={styles.buttonIcon}>
              {isCompleted ? '🎊' : (currentStep?.icon || '🎓')}
            </Text>
            <View style={[
              styles.badge,
              isCompleted && { backgroundColor: '#10B981' }
            ]}>
              <Text style={styles.badgeText}>
                {isCompleted ? '✓' : currentStepNum}
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
      
      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreview(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPreview(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.previewCard}>
              {/* 헤더 */}
              <View style={styles.previewHeader}>
                <Text style={styles.chainIcon}>🎓</Text>
                <View style={styles.headerText}>
                  <Text style={styles.chainName}>인스쿨즈 입학기</Text>
                  <Text style={styles.stepCounter}>
                    {isCompleted ? '완료!' : `${currentStepNum} / ${tutorialChain.totalSteps} 단계`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowPreview(false)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {isCompleted ? (
                // 완료 상태
                <View style={styles.completedSection}>
                  <Text style={styles.completedEmoji}>🎊</Text>
                  <Text style={styles.completedTitle}>축하합니다!</Text>
                  <Text style={styles.completedText}>
                    인스쿨즈 입학기를 모두 완료했어요!
                  </Text>
                </View>
              ) : currentStep ? (
                // 진행 중인 퀘스트
                <View style={styles.currentQuest}>
                  {/* 현재 단계 */}
                  <View style={styles.questHeader}>
                    <View 
                      style={[
                        styles.questIconContainer,
                        { backgroundColor: (currentStep.color || '#3B82F6') + '20' }
                      ]}
                    >
                      <Text style={styles.questIcon}>{currentStep.icon}</Text>
                    </View>
                    <View style={styles.questInfo}>
                      <Text style={styles.questTitle}>{currentStep.title}</Text>
                      <Text style={styles.questDescription}>
                        {currentStep.description}
                      </Text>
                    </View>
                  </View>
                  
                  {/* 스토리 */}
                  <View style={styles.storyBox}>
                    <Text style={styles.storyText}>
                      "{currentStep.storyText}"
                    </Text>
                  </View>
                  
                  {/* 구체적 가이드 */}
                  {currentGuide && (
                    <View style={styles.guideBox}>
                      <Text style={styles.guideLabel}>📍 어떻게 하나요?</Text>
                      <Text style={styles.guideText}>{currentGuide.howTo}</Text>
                      <Text style={styles.guideLocation}>
                        <Text style={styles.guideLocationLabel}>위치: </Text>
                        {currentGuide.where}
                      </Text>
                      {currentGuide.tip && (
                        <Text style={styles.guideTip}>
                          💡 팁: {currentGuide.tip}
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {/* 진행도 */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>진행도</Text>
                      <Text style={styles.progressValue}>
                        {currentProgress} / {currentTarget}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progressPercent}%`,
                            backgroundColor: currentStep.color || '#3B82F6',
                          },
                        ]}
                      />
                    </View>
                  </View>
                  
                  {/* 보상 */}
                  <View style={styles.rewardsSection}>
                    <Text style={styles.rewardsLabel}>🎁 완료 시 보상</Text>
                    <View style={styles.rewardsList}>
                      <View style={styles.rewardItem}>
                        <Text style={styles.rewardIcon}>⭐</Text>
                        <Text style={styles.rewardText}>+{currentStep.rewards.xp} XP</Text>
                      </View>
                      {currentStep.rewards.badge && (
                        <View style={[styles.rewardItem, styles.badgeReward]}>
                          <Text style={styles.rewardIcon}>🏅</Text>
                          <Text style={styles.rewardText}>배지</Text>
                        </View>
                      )}
                      {currentStep.rewards.title && (
                        <View style={[styles.rewardItem, styles.titleReward]}>
                          <Text style={styles.rewardIcon}>👑</Text>
                          <Text style={styles.rewardText}>{currentStep.rewards.title}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                // 로딩 상태
                <View style={styles.loadingSection}>
                  <Text style={styles.loadingEmoji}>⏳</Text>
                  <Text style={styles.loadingText}>퀘스트 로딩 중...</Text>
                </View>
              )}
              
              {/* 액션 버튼들 */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.closeButton]}
                  onPress={() => setShowPreview(false)}
                >
                  <Text style={styles.closeButtonText}>닫기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.detailButton]}
                  onPress={handleViewDetails}
                >
                  <Text style={styles.detailButtonText}>전체 보기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    zIndex: 9999,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCard: {
    width: PREVIEW_CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chainIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  chainName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  stepCounter: {
    fontSize: 14,
    color: '#6B7280',
  },
  closeIcon: {
    fontSize: 20,
    color: '#9CA3AF',
    padding: 5,
  },
  completedSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  completedEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  completedText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  currentQuest: {
    marginBottom: 10,
  },
  questHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  questIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  questIcon: {
    fontSize: 24,
  },
  questInfo: {
    flex: 1,
  },
  questTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  questDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  storyBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  storyText: {
    fontSize: 14,
    color: '#4338CA',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  guideBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  guideLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 8,
  },
  guideText: {
    fontSize: 14,
    color: '#B45309',
    marginBottom: 6,
    lineHeight: 20,
  },
  guideLocation: {
    fontSize: 12,
    color: '#B45309',
  },
  guideLocationLabel: {
    fontWeight: '600',
  },
  guideTip: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 6,
    fontStyle: 'italic',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  rewardsSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
  },
  rewardsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  rewardsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  rewardIcon: {
    fontSize: 16,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#F3F4F6',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailButton: {
    backgroundColor: '#3B82F6',
  },
  detailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
