import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { sendBroadcastNotification, searchUsers, searchSchools } from '@/lib/notifications';
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
  { value: 'general', label: '일반 알림', description: '일반적인 안내사항' },
  { value: 'event', label: '이벤트 알림', description: '특별 이벤트나 프로모션 알림' },
];

type TargetType = 'all' | 'specific_users' | 'specific_school';

interface SelectedUser {
  id: string;
  realName: string;
  userName: string;
  schoolName?: string;
}

interface SelectedSchool {
  id: string;
  name: string;
  address?: string;
  type?: string;
}

export default function AdminNotificationsScreen() {
  const { user } = useAuthStore();
  
  // 기본 폼 데이터
  const [notificationType, setNotificationType] = useState<NotificationType>('system');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // 모달 상태
  const [showTypeModal, setShowTypeModal] = useState(false);
  
  // 사용자 검색 관련
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SelectedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // 학교 검색 관련
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [schoolSearchResults, setSchoolSearchResults] = useState<SelectedSchool[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SelectedSchool | null>(null);
  const [isSearchingSchools, setIsSearchingSchools] = useState(false);

  const [result, setResult] = useState<{
    success: boolean;
    sentCount: number;
    errors: string[];
  } | null>(null);

  // 관리자 권한 확인
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      Alert.alert(
        '접근 권한 없음',
        '관리자만 접근할 수 있습니다.',
        [{ text: '확인', onPress: () => router.back() }]
      );
    }
  }, [user]);

  // 사용자 검색 (웹과 동일한 로직)
  const handleUserSearch = async () => {
    const query = userSearchQuery.trim();
    if (!query) return;
    
    setIsSearchingUsers(true);
    try {
      const results = await searchUsers(query);
      setUserSearchResults(results);
      if (results.length === 0) {
        Alert.alert('검색 결과', '검색 결과가 없습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '사용자 검색 중 오류가 발생했습니다.');
      console.error('사용자 검색 오류:', error);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // 학교 검색 (웹과 동일한 로직)
  const handleSchoolSearch = async () => {
    const query = schoolSearchQuery.trim();
    if (query.length < 2) {
      Alert.alert('검색 오류', '학교명을 2글자 이상 입력해주세요.');
      return;
    }
    
    setIsSearchingSchools(true);
    try {
      const results = await searchSchools(query);
      setSchoolSearchResults(results);
      if (results.length === 0) {
        Alert.alert('검색 결과', '검색 결과가 없습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '학교 검색 중 오류가 발생했습니다.');
      console.error('학교 검색 오류:', error);
    } finally {
      setIsSearchingSchools(false);
    }
  };

  // 사용자 선택
  const handleUserSelect = (user: SelectedUser) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  // 사용자 선택 해제
  const handleUserRemove = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  // 학교 선택
  const handleSchoolSelect = (school: SelectedSchool) => {
    setSelectedSchool(school);
    setSchoolSearchQuery('');
    setSchoolSearchResults([]);
  };

  // 대상 타입 변경
  const handleTargetTypeChange = (type: TargetType) => {
    setTargetType(type);
    setSelectedUsers([]);
    setSelectedSchool(null);
    setUserSearchQuery('');
    setSchoolSearchQuery('');
    setUserSearchResults([]);
    setSchoolSearchResults([]);
  };

  // 알림 발송
  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('입력 오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }

    if (targetType === 'specific_users' && selectedUsers.length === 0) {
      Alert.alert('선택 오류', '알림을 받을 사용자를 선택해주세요.');
      return;
    }

    if (targetType === 'specific_school' && !selectedSchool) {
      Alert.alert('선택 오류', '알림을 받을 학교를 선택해주세요.');
      return;
    }

    const getTargetDescription = () => {
      switch (targetType) {
        case 'all': return '모든 사용자';
        case 'specific_users': return `선택된 ${selectedUsers.length}명의 사용자`;
        case 'specific_school': return `${selectedSchool?.name}을(를) 즐겨찾기한 사용자`;
        default: return '모든 사용자';
      }
    };

    Alert.alert(
      '알림 발송 확인',
      `${getTargetDescription()}에게 알림을 발송하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '발송', 
          style: 'default',
          onPress: async () => {
            setIsLoading(true);
            setResult(null);

            try {
              const data = {
                type: notificationType,
                title: title.trim(),
                message: message.trim(),
                targetType,
                ...(targetType === 'specific_users' && {
                  targetUserIds: selectedUsers.map(u => u.id)
                }),
                ...(targetType === 'specific_school' && {
                  targetSchoolId: selectedSchool?.id
                })
              };

              const response = await sendBroadcastNotification(data);
              setResult(response);
              
              if (response.success) {
                Alert.alert('발송 완료', `알림이 성공적으로 발송되었습니다! (${response.sentCount}명)`);
                setTitle('');
                setMessage('');
                setSelectedUsers([]);
                setSelectedSchool(null);
              } else {
                Alert.alert('일부 실패', `성공: ${response.sentCount}명, 실패: ${response.errors.length}건`);
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

  const getTargetTypeLabel = (type: TargetType) => {
    switch (type) {
      case 'all': return '모든 사용자';
      case 'specific_users': return '특정 사용자';
      case 'specific_school': return '특정 학교';
      default: return '모든 사용자';
    }
  };

  const getTargetDescription = () => {
    switch (targetType) {
      case 'all': 
        return '모든 사용자에게 알림을 발송합니다.';
      case 'specific_users': 
        return `선택된 ${selectedUsers.length}명의 사용자에게 알림을 발송합니다.`;
      case 'specific_school': 
        return selectedSchool 
          ? `${selectedSchool.name}을(를) 즐겨찾기한 사용자들에게 알림을 발송합니다.`
          : '선택된 학교를 즐겨찾기한 사용자들에게 알림을 발송합니다.';
      default: 
        return '';
    }
  };

  // 관리자가 아닌 경우
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
      {/* 헤더 */}
      <View style={styles.header}>
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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 알림 타입 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림 타입</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowTypeModal(true)}
          >
            <Text style={styles.selectorText}>
              {notificationTypes.find(t => t.value === notificationType)?.label || '알림 타입 선택'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={pastelGreenColors[600]} />
          </TouchableOpacity>
        </View>

        {/* 발송 대상 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>발송 대상</Text>
          <View style={styles.targetTypeContainer}>
            {(['all', 'specific_users', 'specific_school'] as TargetType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.targetTypeButton,
                  targetType === type && styles.targetTypeButtonActive
                ]}
                onPress={() => handleTargetTypeChange(type)}
              >
                <MaterialIcons 
                  name={
                    type === 'all' ? 'people' : 
                    type === 'specific_users' ? 'person' : 'school'
                  } 
                  size={20} 
                  color={targetType === type ? 'white' : pastelGreenColors[600]} 
                />
                <Text style={[
                  styles.targetTypeButtonText,
                  targetType === type && styles.targetTypeButtonTextActive
                ]}>
                  {getTargetTypeLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.targetDescription}>
            {getTargetDescription()}
          </Text>
        </View>

        {/* 특정 사용자 검색 및 선택 */}
        {targetType === 'specific_users' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>사용자 검색 및 선택</Text>
            
            {/* 검색 입력 */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                placeholder="사용자 이름 또는 아이디로 검색..."
                placeholderTextColor={pastelGreenColors[400]}
                onSubmitEditing={handleUserSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  (!userSearchQuery.trim() || isSearchingUsers) && styles.searchButtonDisabled
                ]}
                onPress={handleUserSearch}
                disabled={!userSearchQuery.trim() || isSearchingUsers}
              >
                {isSearchingUsers ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialIcons name="search" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>

            {/* 검색 결과 */}
            {userSearchResults.length > 0 && (
              <View style={styles.searchResults}>
                <Text style={styles.searchResultsTitle}>검색 결과</Text>
                <FlatList
                  data={userSearchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => handleUserSelect(item)}
                    >
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>{item.realName}</Text>
                        <Text style={styles.searchResultDetail}>@{item.userName}</Text>
                        {item.schoolName && (
                          <Text style={styles.searchResultSchool}>{item.schoolName}</Text>
                        )}
                      </View>
                      <MaterialIcons name="add" size={20} color={pastelGreenColors[600]} />
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
            
            {/* 선택된 사용자 */}
            {selectedUsers.length > 0 && (
              <View style={styles.selectedContainer}>
                <Text style={styles.selectedTitle}>선택된 사용자 ({selectedUsers.length}명)</Text>
                {selectedUsers.map((user) => (
                  <View key={user.id} style={styles.selectedItem}>
                    <View style={styles.selectedItemInfo}>
                      <Text style={styles.selectedItemName}>{user.realName}</Text>
                      <Text style={styles.selectedItemDetail}>@{user.userName}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleUserRemove(user.id)}>
                      <MaterialIcons name="close" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 특정 학교 검색 및 선택 */}
        {targetType === 'specific_school' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>학교 검색 및 선택</Text>
            
            {/* 검색 입력 */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={schoolSearchQuery}
                onChangeText={setSchoolSearchQuery}
                placeholder="학교명으로 검색 (2글자 이상 입력 후 검색)"
                placeholderTextColor={pastelGreenColors[400]}
                onSubmitEditing={handleSchoolSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  (schoolSearchQuery.trim().length < 2 || isSearchingSchools) && styles.searchButtonDisabled
                ]}
                onPress={handleSchoolSearch}
                disabled={schoolSearchQuery.trim().length < 2 || isSearchingSchools}
              >
                {isSearchingSchools ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialIcons name="search" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.searchHint}>
              💡 앞글자가 일치하는 학교가 우선 표시됩니다. 주소로 같은 이름의 학교를 구별할 수 있습니다.
            </Text>

            {/* 검색 결과 */}
            {schoolSearchResults.length > 0 && (
              <View style={styles.searchResults}>
                <Text style={styles.searchResultsTitle}>검색 결과</Text>
                <FlatList
                  data={schoolSearchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => handleSchoolSelect(item)}
                    >
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>{item.name}</Text>
                        {item.address && (
                          <Text style={styles.searchResultDetail}>{item.address}</Text>
                        )}
                        {item.type && (
                          <Text style={styles.searchResultSchool}>{item.type}</Text>
                        )}
                      </View>
                      <MaterialIcons name="add" size={20} color={pastelGreenColors[600]} />
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
            
            {/* 선택된 학교 */}
            {selectedSchool && (
              <View style={styles.selectedContainer}>
                <Text style={styles.selectedTitle}>선택된 학교</Text>
                <View style={styles.selectedItem}>
                  <View style={styles.selectedItemInfo}>
                    <Text style={styles.selectedItemName}>{selectedSchool.name}</Text>
                    {selectedSchool.address && (
                      <Text style={styles.selectedItemDetail}>{selectedSchool.address}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setSelectedSchool(null)}>
                    <MaterialIcons name="close" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 제목 입력 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제목</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="알림 제목을 입력하세요"
            maxLength={100}
            placeholderTextColor={pastelGreenColors[400]}
          />
          <Text style={styles.characterCount}>{title.length}/100</Text>
        </View>

        {/* 내용 입력 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내용</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="알림 내용을 입력하세요"
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor={pastelGreenColors[400]}
          />
          <Text style={styles.characterCount}>{message.length}/500</Text>
        </View>

        {/* 발송 버튼 */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!title.trim() || !message.trim() || isLoading) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!title.trim() || !message.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="white" />
              <Text style={styles.submitButtonText}>알림 발송</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 발송 결과 */}
        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>📊 발송 결과</Text>
            <View style={styles.resultStats}>
              <View style={styles.resultStatItem}>
                <Text style={styles.resultStatNumber}>{result.sentCount}</Text>
                <Text style={styles.resultStatLabel}>성공</Text>
              </View>
              <View style={styles.resultStatItem}>
                <Text style={[styles.resultStatNumber, { color: '#ef4444' }]}>{result.errors.length}</Text>
                <Text style={[styles.resultStatLabel, { color: '#ef4444' }]}>실패</Text>
              </View>
            </View>
            {result.errors.length > 0 && (
              <View style={styles.resultErrors}>
                <Text style={styles.resultErrorTitle}>⚠️ 오류 목록</Text>
                <ScrollView style={styles.resultErrorList} nestedScrollEnabled>
                  {result.errors.map((error, index) => (
                    <Text key={index} style={styles.resultErrorText}>• {error}</Text>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 알림 타입 선택 모달 */}
      <Modal
        visible={showTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>알림 타입 선택</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {notificationTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.modalOption,
                    notificationType === type.value && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setNotificationType(type.value);
                    setShowTypeModal(false);
                  }}
                >
                  <View>
                    <Text style={styles.modalOptionTitle}>{type.label}</Text>
                    <Text style={styles.modalOptionDescription}>{type.description}</Text>
                  </View>
                  {notificationType === type.value && (
                    <MaterialIcons name="check" size={20} color={pastelGreenColors[600]} />
                  )}
                </TouchableOpacity>
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
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  selectorText: {
    fontSize: 16,
    color: '#374151',
  },
  targetTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  targetTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    borderRadius: 8,
    backgroundColor: 'white',
  },
  targetTypeButtonActive: {
    backgroundColor: pastelGreenColors[600],
    borderColor: pastelGreenColors[600],
  },
  targetTypeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: pastelGreenColors[600],
    textAlign: 'center',
  },
  targetTypeButtonTextActive: {
    color: 'white',
  },
  targetDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: 'white',
  },
  searchButton: {
    backgroundColor: pastelGreenColors[600],
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  searchButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  searchHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 16,
  },
  searchResults: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    maxHeight: 240,
    marginBottom: 12,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#f9fafb',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  searchResultDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  searchResultSchool: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  selectedContainer: {
    marginTop: 12,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: pastelGreenColors[50],
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  selectedItemDetail: {
    fontSize: 12,
    color: '#6b7280',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: pastelGreenColors[600],
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  resultContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  resultStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  resultStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  resultStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pastelGreenColors[600],
  },
  resultStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  resultErrors: {
    marginTop: 12,
  },
  resultErrorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  resultErrorList: {
    maxHeight: 120,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 8,
  },
  resultErrorText: {
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 16,
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
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: pastelGreenColors[50],
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  modalOptionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
}); 