import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { sendBroadcastNotification } from '@/lib/notifications';
import { NotificationType } from '@/types';

// 파스텔 그린 색상 팔레트
const pastelGreenColors = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

const notificationTypes: { value: NotificationType; label: string; description: string }[] = [
  { value: 'system', label: '시스템 알림', description: '시스템 공지사항 및 중요 알림' },
  { value: 'warning', label: '경고 알림', description: '사용자에게 경고 메시지 발송' },
  { value: 'like', label: '일반 알림', description: '일반적인 안내사항' },
  { value: 'follow', label: '이벤트 알림', description: '특별 이벤트나 프로모션 알림' },
];

const targetTypes = [
  { value: 'all', label: '모든 사용자', icon: 'people', description: '전체 사용자에게 발송' },
  { value: 'students', label: '학생만', icon: 'school', description: '학생 역할 사용자만' },
  { value: 'admins', label: '관리자만', icon: 'admin-panel-settings', description: '관리자 역할 사용자만' },
];

export default function AdminNotificationsScreen() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    sentCount: number;
    errors: string[];
  } | null>(null);
  
  const [formData, setFormData] = useState({
    type: 'system' as NotificationType,
    title: '',
    message: '',
    targetType: 'all' as 'all' | 'students' | 'admins',
  });

  // 관리자 권한 확인
  React.useEffect(() => {
    if (!user || user.role !== 'admin') {
      Alert.alert(
        '접근 권한 없음',
        '관리자만 접근할 수 있습니다.',
        [{ text: '확인', onPress: () => router.back() }]
      );
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      Alert.alert('입력 오류', '제목과 메시지를 모두 입력해주세요.');
      return;
    }

    Alert.alert(
      '알림 발송 확인',
      `${targetTypes.find(t => t.value === formData.targetType)?.label}에게 알림을 발송하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '발송', 
          style: 'default',
          onPress: async () => {
            setIsLoading(true);
            setLastResult(null);

            try {
              const result = await sendBroadcastNotification({
                type: formData.type,
                title: formData.title.trim(),
                message: formData.message.trim(),
                targetType: formData.targetType,
              });

              setLastResult(result);
              
              if (result.success) {
                Alert.alert('발송 완료', `${result.sentCount}명의 사용자에게 알림을 성공적으로 발송했습니다.`);
                setFormData({
                  type: 'system',
                  title: '',
                  message: '',
                  targetType: 'all',
                });
              } else {
                Alert.alert('일부 실패', `성공: ${result.sentCount}명, 실패: ${result.errors.length}건`);
              }
            } catch (error) {
              console.error('알림 발송 실패:', error);
              Alert.alert('오류', '알림 발송 중 오류가 발생했습니다.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // 관리자가 아닌 경우 빈 화면 반환
  if (!user || user.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="security" size={48} color={pastelGreenColors[300]} />
          <Text style={styles.accessDeniedText}>접근 권한이 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back" size={24} color={pastelGreenColors[600]} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="notifications" size={24} color={pastelGreenColors[600]} />
              <Text style={styles.headerTitle}>알림 설정</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            모든 사용자에게 중요한 알림을 발송하세요
          </Text>
        </View>

        {/* 알림 발송 폼 */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>알림 발송</Text>
          
          {/* 알림 타입 선택 */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>알림 타입</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowTypeModal(true)}
            >
              <View style={styles.selectContent}>
                <View>
                  <Text style={styles.selectText}>
                    {notificationTypes.find(t => t.value === formData.type)?.label}
                  </Text>
                  <Text style={styles.selectSubtext}>
                    {notificationTypes.find(t => t.value === formData.type)?.description}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={pastelGreenColors[500]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* 발송 대상 선택 */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>발송 대상</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowTargetModal(true)}
            >
              <View style={styles.selectContent}>
                <View style={styles.targetInfo}>
                  <MaterialIcons 
                    name={targetTypes.find(t => t.value === formData.targetType)?.icon as any} 
                    size={20} 
                    color={pastelGreenColors[600]} 
                  />
                  <View style={styles.targetText}>
                    <Text style={styles.selectText}>
                      {targetTypes.find(t => t.value === formData.targetType)?.label}
                    </Text>
                    <Text style={styles.selectSubtext}>
                      {targetTypes.find(t => t.value === formData.targetType)?.description}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={pastelGreenColors[500]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* 제목 입력 */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>알림 제목</Text>
            <TextInput
              style={styles.textInput}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="알림 제목을 입력하세요"
              maxLength={100}
              multiline={false}
            />
            <Text style={styles.charCount}>{formData.title.length}/100</Text>
          </View>

          {/* 메시지 입력 */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>알림 내용</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.message}
              onChangeText={(text) => setFormData(prev => ({ ...prev, message: text }))}
              placeholder="알림 내용을 입력하세요"
              maxLength={500}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{formData.message.length}/500</Text>
          </View>

          {/* 미리보기 */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>미리보기</Text>
            <View style={styles.previewContainer}>
              <View style={styles.previewNotification}>
                <View style={styles.previewIcon}>
                  <MaterialIcons name="notifications" size={16} color={pastelGreenColors[600]} />
                </View>
                <View style={styles.previewContent}>
                  <Text style={styles.previewTitle}>
                    {formData.title || '알림 제목'}
                  </Text>
                  <Text style={styles.previewMessage}>
                    {formData.message || '알림 내용이 여기에 표시됩니다.'}
                  </Text>
                  <View style={styles.previewMeta}>
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewBadgeText}>
                        {notificationTypes.find(t => t.value === formData.type)?.label}
                      </Text>
                    </View>
                    <Text style={styles.previewTime}>방금 전</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* 발송 버튼 */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!formData.title.trim() || !formData.message.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!formData.title.trim() || !formData.message.trim() || isLoading}
          >
            <MaterialIcons 
              name={isLoading ? "hourglass-empty" : "send"} 
              size={20} 
              color="white" 
            />
            <Text style={styles.sendButtonText}>
              {isLoading ? '발송 중...' : '알림 발송'}
            </Text>
          </TouchableOpacity>

          {/* 발송 결과 */}
          {lastResult && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                <MaterialIcons 
                  name={lastResult.success ? "check-circle" : "warning"} 
                  size={20} 
                  color={lastResult.success ? pastelGreenColors[600] : '#f59e0b'} 
                />
                <Text style={styles.resultTitle}>발송 결과</Text>
              </View>
              <View style={styles.resultStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{lastResult.sentCount}</Text>
                  <Text style={styles.statLabel}>성공</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#ef4444' }]}>{lastResult.errors.length}</Text>
                  <Text style={styles.statLabel}>실패</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 알림 타입 선택 모달 */}
      <Modal visible={showTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>알림 타입 선택</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <MaterialIcons name="close" size={24} color={pastelGreenColors[600]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {notificationTypes.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.modalItem,
                    formData.type === type.value && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, type: type.value }));
                    setShowTypeModal(false);
                  }}
                >
                  <View>
                    <Text style={styles.modalItemTitle}>{type.label}</Text>
                    <Text style={styles.modalItemDescription}>{type.description}</Text>
                  </View>
                  {formData.type === type.value && (
                    <MaterialIcons name="check" size={20} color={pastelGreenColors[600]} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 발송 대상 선택 모달 */}
      <Modal visible={showTargetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>발송 대상 선택</Text>
              <TouchableOpacity onPress={() => setShowTargetModal(false)}>
                <MaterialIcons name="close" size={24} color={pastelGreenColors[600]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {targetTypes.map((target) => (
                <Pressable
                  key={target.value}
                  style={[
                    styles.modalItem,
                    formData.targetType === target.value && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, targetType: target.value as any }));
                    setShowTargetModal(false);
                  }}
                >
                  <View style={styles.modalItemWithIcon}>
                    <MaterialIcons name={target.icon as any} size={20} color={pastelGreenColors[600]} />
                    <View>
                      <Text style={styles.modalItemTitle}>{target.label}</Text>
                      <Text style={styles.modalItemDescription}>{target.description}</Text>
                    </View>
                  </View>
                  {formData.targetType === target.value && (
                    <MaterialIcons name="check" size={20} color={pastelGreenColors[600]} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: pastelGreenColors[600],
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  headerSubtitle: {
    fontSize: 14,
    color: pastelGreenColors[600],
    marginTop: 4,
  },
  formContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelGreenColors[800],
    marginBottom: 8,
  },
  selectButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    borderRadius: 8,
    padding: 16,
  },
  selectContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    fontWeight: '500',
    color: pastelGreenColors[800],
  },
  selectSubtext: {
    fontSize: 12,
    color: pastelGreenColors[600],
    marginTop: 2,
  },
  targetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  targetText: {
    flex: 1,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: pastelGreenColors[800],
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: pastelGreenColors[500],
    textAlign: 'right',
    marginTop: 4,
  },
  previewContainer: {
    backgroundColor: pastelGreenColors[50],
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
    borderRadius: 8,
    padding: 16,
  },
  previewNotification: {
    flexDirection: 'row',
    gap: 12,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: pastelGreenColors[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelGreenColors[800],
    marginBottom: 4,
  },
  previewMessage: {
    fontSize: 14,
    color: pastelGreenColors[700],
    marginBottom: 8,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewBadge: {
    backgroundColor: pastelGreenColors[200],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewBadgeText: {
    fontSize: 10,
    color: pastelGreenColors[800],
    fontWeight: '500',
  },
  previewTime: {
    fontSize: 10,
    color: pastelGreenColors[500],
  },
  sendButton: {
    backgroundColor: pastelGreenColors[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  sendButtonDisabled: {
    backgroundColor: pastelGreenColors[300],
    opacity: 0.6,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: pastelGreenColors[800],
  },
  resultStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: pastelGreenColors[50],
    padding: 12,
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: pastelGreenColors[600],
  },
  statLabel: {
    fontSize: 12,
    color: pastelGreenColors[600],
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  modalContent: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[100],
  },
  modalItemSelected: {
    backgroundColor: pastelGreenColors[50],
  },
  modalItemWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: pastelGreenColors[800],
  },
  modalItemDescription: {
    fontSize: 12,
    color: pastelGreenColors[600],
    marginTop: 2,
  },
}); 