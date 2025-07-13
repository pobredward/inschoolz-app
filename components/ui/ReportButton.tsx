import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReportType } from '../../types';
import { ReportModal } from './ReportModal';
import { hasUserReported, checkReportSpam } from '../../lib/reports';
import { useAuthStore } from '../../store/authStore';

interface ReportButtonProps {
  targetId: string;
  targetType: ReportType;
  targetContent?: string;
  postId?: string;
  style?: any;
  textStyle?: any;
  showIcon?: boolean;
  boardCode?: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

export function ReportButton({
  targetId,
  targetType,
  targetContent,
  postId,
  style,
  textStyle,
  showIcon = true,
  boardCode,
  schoolId,
  regions,
}: ReportButtonProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();

  // 이미 신고했는지 확인
  useEffect(() => {
    const checkReported = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const reported = await hasUserReported(user.uid, targetId, targetType);
        setHasReported(reported);
      } catch (error) {
        console.error('신고 확인 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkReported();
  }, [user, targetId, targetType]);

  const handleReportClick = async () => {
    if (!user) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    if (hasReported) {
      Alert.alert('알림', '이미 신고한 내용입니다.');
      return;
    }

    // 신고 스팸 방지 검사
    try {
      const spamCheck = await checkReportSpam(user.uid);
      if (!spamCheck.canReport) {
        const timeMessage = spamCheck.remainingTime 
          ? ` (${spamCheck.remainingTime}${spamCheck.remainingTime > 60 ? '시간' : '분'} 후 다시 시도 가능)`
          : '';
        Alert.alert('알림', `${spamCheck.reason}${timeMessage}`);
        return;
      }
    } catch (error) {
      console.error('신고 스팸 검사 실패:', error);
      // 검사 실패 시에도 신고 허용
    }

    setIsModalVisible(true);
  };

  const handleReportSuccess = () => {
    setHasReported(true);
    setIsModalVisible(false);
  };

  const getButtonText = () => {
    if (isLoading) return '확인 중...';
    if (hasReported) return '신고됨';
    return '신고';
  };

  const getButtonStyle = () => {
    if (hasReported) {
      return [styles.button, styles.reportedButton, style];
    }
    return [styles.button, style];
  };

  const getTextStyle = () => {
    if (hasReported) {
      return [styles.buttonText, styles.reportedButtonText, textStyle];
    }
    return [styles.buttonText, textStyle];
  };

  return (
    <>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handleReportClick}
        disabled={hasReported || isLoading}
      >
        {showIcon && (
          <Ionicons
            name={hasReported ? "alert-circle" : "flag"}
            size={12}
            color={hasReported ? "#f59e0b" : "#ef4444"}
            style={styles.icon}
          />
        )}
        <Text style={getTextStyle()}>{getButtonText()}</Text>
      </TouchableOpacity>

      <ReportModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        targetId={targetId}
        targetType={targetType}
        targetContent={targetContent}
        postId={postId}
        onSuccess={handleReportSuccess}
        boardCode={boardCode}
        schoolId={schoolId}
        regions={regions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  reportedButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  reportedButtonText: {
    color: '#f59e0b',
  },
  icon: {
    marginRight: 4,
  },
}); 