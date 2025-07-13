import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ExperienceModalProps {
  visible: boolean;
  onClose: () => void;
  data: {
    expGained: number;
    activityType: 'post' | 'comment' | 'like';
    leveledUp: boolean;
    oldLevel?: number;
    newLevel?: number;
    currentExp: number;
    expToNextLevel: number;
    remainingCount: number;
    totalDailyLimit: number;
    reason?: string;
  };
}

const activityLabels = {
  post: '게시글 작성',
  comment: '댓글 작성',
  like: '좋아요'
};

const activityIcons = {
  post: 'flash' as const,
  comment: 'star' as const,
  like: 'heart' as const
};

export const ExperienceModal: React.FC<ExperienceModalProps> = ({
  visible,
  onClose,
  data
}) => {
  const progressPercentage = (data.currentExp / data.expToNextLevel) * 100;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Ionicons 
              name={data.leveledUp ? 'trophy' : activityIcons[data.activityType]} 
              size={24} 
              color={data.leveledUp ? '#F59E0B' : '#10B981'} 
            />
            <Text style={styles.headerTitle}>
              {data.leveledUp ? '레벨업!' : '경험치 획득'}
            </Text>
          </View>

          {/* 경험치 획득 정보 */}
          <View style={styles.expSection}>
            <Text style={styles.expAmount}>+{data.expGained} XP</Text>
            <Text style={styles.expDescription}>
              {activityLabels[data.activityType]}으로 경험치를 획득했습니다!
            </Text>
          </View>

          {/* 레벨업 정보 */}
          {data.leveledUp && data.oldLevel && data.newLevel && (
            <View style={styles.levelUpSection}>
              <View style={styles.levelUpHeader}>
                <Ionicons name="trophy" size={20} color="#F59E0B" />
                <Text style={styles.levelUpText}>
                  레벨 {data.oldLevel} → {data.newLevel}
                </Text>
              </View>
              <Text style={styles.levelUpDescription}>
                축하합니다! 레벨이 올랐습니다!
              </Text>
            </View>
          )}

          {/* 현재 레벨 진행도 */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                레벨 {data.newLevel || data.oldLevel || 1} 진행도
              </Text>
              <Text style={styles.progressText}>
                {data.currentExp} / {data.expToNextLevel} XP
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(progressPercentage, 100)}%` }
                ]} 
              />
            </View>
          </View>

          {/* 남은 횟수 정보 */}
          <View style={styles.limitSection}>
            <View style={styles.limitHeader}>
              <Text style={styles.limitTitle}>
                오늘 {activityLabels[data.activityType]} 경험치
              </Text>
              <View style={styles.limitBadge}>
                <Text style={styles.limitBadgeText}>
                  {data.remainingCount}/{data.totalDailyLimit} 남음
                </Text>
              </View>
            </View>
            {data.remainingCount === 0 && (
              <Text style={styles.limitWarning}>
                오늘의 {activityLabels[data.activityType]} 경험치 한도를 모두 사용했습니다.
              </Text>
            )}
          </View>

          {/* 확인 버튼 */}
          <TouchableOpacity style={styles.confirmButton} onPress={onClose}>
            <Text style={styles.confirmButtonText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginLeft: 8,
  },
  expSection: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  expAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  expDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  levelUpSection: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  levelUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelUpText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B45309',
    marginLeft: 8,
  },
  levelUpDescription: {
    fontSize: 14,
    color: '#D97706',
    textAlign: 'center',
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
  progressTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  limitSection: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitTitle: {
    fontSize: 14,
    color: '#1D4ED8',
    flex: 1,
  },
  limitBadge: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  limitBadgeText: {
    fontSize: 12,
    color: '#2563EB',
  },
  limitWarning: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 