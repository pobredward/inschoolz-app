import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReportType, ReportReason } from '../../types';
import { createReport } from '../../lib/reports';
import { useAuthStore } from '../../store/authStore';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ReportType;
  targetContent?: string;
  postId?: string;
  onSuccess: () => void;
  boardCode?: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

// 신고 사유 옵션
const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam', label: '스팸/도배', description: '반복적인 광고성 게시물이나 도배' },
  { value: 'inappropriate', label: '부적절한 내용', description: '커뮤니티 규칙에 맞지 않는 내용' },
  { value: 'harassment', label: '괴롭힘/욕설', description: '다른 사용자를 괴롭히거나 욕설' },
  { value: 'fake', label: '허위정보', description: '거짓 정보나 가짜 뉴스' },
  { value: 'copyright', label: '저작권 침해', description: '무단 복제나 저작권 위반' },
  { value: 'privacy', label: '개인정보 노출', description: '개인정보나 사생활 침해' },
  { value: 'violence', label: '폭력적 내용', description: '폭력적이거나 위험한 내용' },
  { value: 'sexual', label: '성적 내용', description: '부적절한 성적 내용' },
  { value: 'hate', label: '혐오 발언', description: '차별이나 혐오를 조장하는 내용' },
  { value: 'other', label: '기타', description: '위에 해당하지 않는 기타 사유' },
];

export function ReportModal({
  visible,
  onClose,
  targetId,
  targetType,
  targetContent,
  postId,
  onSuccess,
  boardCode,
  schoolId,
  regions,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('inappropriate');
  const [customReason, setCustomReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      Alert.alert('오류', '기타 사유를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createReport({
        reason: selectedReason,
        customReason: selectedReason === 'other' ? customReason : undefined,
        description: description.trim() || undefined,
        targetId,
        targetType,
        targetContent,
        postId: targetType === 'comment' ? postId : undefined,
        reporterId: user.uid,
        reporterInfo: {
          displayName: user.profile?.userName || '사용자',
          profileImageUrl: user.profile?.profileImageUrl,
        },
        boardCode,
        schoolId,
        regions,
      });

      Alert.alert('완료', '신고가 접수되었습니다.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('신고 제출 실패:', error);
      Alert.alert('오류', '신고 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetTypeName = () => {
    switch (targetType) {
      case 'post':
        return '게시글';
      case 'comment':
        return '댓글';
      case 'user':
        return '사용자';
      default:
        return '내용';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{getTargetTypeName()} 신고</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 신고 사유 선택 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>신고 사유를 선택해주세요</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={[
                  styles.reasonItem,
                  selectedReason === reason.value && styles.reasonItemSelected,
                ]}
                onPress={() => setSelectedReason(reason.value)}
              >
                <View style={styles.reasonItemContent}>
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reason.value && styles.reasonLabelSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  <Text style={styles.reasonDescription}>{reason.description}</Text>
                </View>
                {selectedReason === reason.value && (
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* 기타 사유 입력 */}
          {selectedReason === 'other' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>기타 사유</Text>
              <TextInput
                style={styles.textInput}
                placeholder="신고 사유를 입력해주세요"
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                maxLength={100}
              />
              <Text style={styles.characterCount}>{customReason.length}/100</Text>
            </View>
          )}

          {/* 상세 설명 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>상세 설명 (선택사항)</Text>
            <TextInput
              style={[styles.textInput, styles.descriptionInput]}
              placeholder="신고 내용에 대한 상세한 설명을 입력해주세요"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
            />
            <Text style={styles.characterCount}>{description.length}/500</Text>
          </View>

          {/* 24시간 내 처리 안내 */}
          <View style={styles.infoSection}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>!</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>신고 처리 안내</Text>
              <Text style={styles.infoText}>
                모든 신고는 <Text style={styles.boldText}>24시간 이내</Text>에 검토되며, 처리 결과는 알림으로 안내됩니다.
              </Text>
            </View>
          </View>

          {/* 경고 문구 */}
          <View style={styles.warningSection}>
            <Text style={styles.warningText}>
              허위 신고는 제재 대상이 될 수 있습니다. 신중히 신고해주세요.
            </Text>
          </View>
        </ScrollView>

        {/* 버튼 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>신고하기</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 8,
  },
  reasonItemSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  reasonItemContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  reasonLabelSelected: {
    color: '#10b981',
  },
  reasonDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    minHeight: 40,
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: '#4b5563',
  },
  boldText: {
    fontWeight: 'bold',
  },

  warningSection: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  characterCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
}); 