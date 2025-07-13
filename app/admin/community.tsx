import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { Board, BoardType } from '@/types';
import { getAllBoards, createBoard, updateBoard, deleteBoard, toggleBoardStatus } from '@/lib/boards';

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

interface BoardFormData {
  name: string;
  description: string;
  icon: string;
  type: BoardType;
  code: string;
  isActive: boolean;
  isPublic: boolean;
  order: number;
  accessLevel: {
    read: 'all' | 'member' | 'verified';
    write: 'all' | 'member' | 'verified';
  };
  settings: {
    allowAnonymous: boolean;
    allowAttachment: boolean;
    maxAttachmentSize: number;
  };
}

const defaultBoardForm: BoardFormData = {
  name: '',
  description: '',
  icon: 'forum',
  type: 'national',
  code: '',
  isActive: true,
  isPublic: true,
  order: 0,
  accessLevel: {
    read: 'all',
    write: 'all',
  },
  settings: {
    allowAnonymous: true,
    allowAttachment: true,
    maxAttachmentSize: 10,
  },
};

export default function CommunityManagementScreen() {
  const { user } = useAuthStore();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [formData, setFormData] = useState<BoardFormData>(defaultBoardForm);
  const [selectedBoardType, setSelectedBoardType] = useState<BoardType>('national');

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

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadBoards();
    }
  }, [user]);

  const loadBoards = async () => {
    try {
      setIsLoading(true);
      const boardsData = await getAllBoards();
      setBoards(boardsData);
    } catch (error) {
      console.error('게시판 로드 실패:', error);
      Alert.alert('오류', '게시판 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData(defaultBoardForm);
    setEditingBoard(null);
    setShowAddModal(true);
  };

  const openEditModal = (board: Board) => {
    setFormData({
      name: board.name,
      description: board.description || '',
      icon: board.icon,
      type: board.type,
      code: board.code,
      isActive: board.isActive,
      isPublic: board.isPublic,
      order: board.order,
      accessLevel: board.accessLevel,
      settings: board.settings || defaultBoardForm.settings,
    });
    setEditingBoard(board);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingBoard(null);
    setFormData(defaultBoardForm);
  };

  const saveBoard = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      Alert.alert('오류', '게시판 이름과 코드를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      
      if (editingBoard) {
        await updateBoard(editingBoard.id, formData);
        setBoards(prev => prev.map(board => 
          board.id === editingBoard.id 
            ? { ...board, ...formData, updatedAt: Date.now() }
            : board
        ));
        Alert.alert('성공', '게시판이 수정되었습니다.');
      } else {
        const newBoard = await createBoard(formData);
        setBoards(prev => [...prev, newBoard]);
        Alert.alert('성공', '게시판이 생성되었습니다.');
      }
      
      closeModal();
    } catch (error) {
      console.error('게시판 저장 실패:', error);
      Alert.alert('오류', '게시판 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBoardHandler = async (board: Board) => {
    Alert.alert(
      '게시판 삭제',
      `"${board.name}" 게시판을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
                  try {
        setIsLoading(true);
        await deleteBoard(board.id);
        setBoards(prev => prev.filter(b => b.id !== board.id));
        Alert.alert('성공', '게시판이 삭제되었습니다.');
      } catch (error) {
              console.error('게시판 삭제 실패:', error);
              Alert.alert('오류', '게시판 삭제에 실패했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggleBoardStatusHandler = async (board: Board) => {
    try {
      setIsLoading(true);
      await toggleBoardStatus(board.id, !board.isActive);
      setBoards(prev => prev.map(b => 
        b.id === board.id ? { ...b, isActive: !b.isActive } : b
      ));
    } catch (error) {
      console.error('게시판 상태 변경 실패:', error);
      Alert.alert('오류', '게시판 상태 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBoards = boards.filter(board => board.type === selectedBoardType);

  const getBoardTypeLabel = (type: BoardType) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type;
    }
  };

  const getAccessLevelLabel = (level: string) => {
    switch (level) {
      case 'all': return '전체';
      case 'member': return '회원';
      case 'verified': return '인증회원';
      default: return level;
    }
  };

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
          <MaterialIcons name="forum" size={24} color={pastelGreenColors[600]} />
          <Text style={styles.headerTitle}>커뮤니티 관리</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddModal}
        >
          <MaterialIcons name="add" size={20} color="white" />
          <Text style={styles.addButtonText}>추가</Text>
        </TouchableOpacity>
      </View>

      {/* 게시판 타입 필터 */}
      <View style={styles.filterContainer}>
        {(['national', 'regional', 'school'] as BoardType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterButton,
              selectedBoardType === type && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedBoardType(type)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedBoardType === type && styles.filterButtonTextActive,
              ]}
            >
              {getBoardTypeLabel(type)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 게시판 목록 */}
      <ScrollView style={styles.scrollView}>
        {filteredBoards.map((board) => (
          <View key={board.id} style={styles.boardCard}>
            <View style={styles.boardHeader}>
              <View style={styles.boardInfo}>
                <View style={styles.boardTitleRow}>
                  <MaterialIcons name={board.icon as any} size={20} color={pastelGreenColors[600]} />
                  <Text style={styles.boardName}>{board.name}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: board.isActive ? pastelGreenColors[100] : '#fee2e2' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: board.isActive ? pastelGreenColors[700] : '#dc2626' }
                    ]}>
                      {board.isActive ? '활성' : '비활성'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.boardDescription}>{board.description}</Text>
                <Text style={styles.boardCode}>코드: {board.code}</Text>
              </View>
              <View style={styles.boardActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => toggleBoardStatusHandler(board)}
                >
                  <MaterialIcons 
                    name={board.isActive ? 'visibility-off' : 'visibility'} 
                    size={18} 
                    color={pastelGreenColors[600]} 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openEditModal(board)}
                >
                  <MaterialIcons name="edit" size={18} color={pastelGreenColors[600]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => deleteBoardHandler(board)}
                >
                  <MaterialIcons name="delete" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.boardStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{board.stats?.postCount || 0}</Text>
                <Text style={styles.statLabel}>게시글</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{board.stats?.memberCount || 0}</Text>
                <Text style={styles.statLabel}>멤버</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{board.stats?.todayPostCount || 0}</Text>
                <Text style={styles.statLabel}>오늘</Text>
              </View>
            </View>

            <View style={styles.boardSettings}>
              <Text style={styles.settingText}>
                읽기: {getAccessLevelLabel(board.accessLevel.read)} | 
                쓰기: {getAccessLevelLabel(board.accessLevel.write)}
              </Text>
              <Text style={styles.settingText}>
                익명: {board.settings?.allowAnonymous ? '허용' : '금지'} | 
                첨부: {board.settings?.allowAttachment ? '허용' : '금지'}
              </Text>
            </View>
          </View>
        ))}

        {filteredBoards.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="forum" size={48} color={pastelGreenColors[300]} />
            <Text style={styles.emptyText}>
              {getBoardTypeLabel(selectedBoardType)} 게시판이 없습니다
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 게시판 추가/수정 모달 */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingBoard ? '게시판 수정' : '게시판 추가'}
            </Text>
            <TouchableOpacity
              onPress={saveBoard}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.6 : 1 }}
            >
              <Text style={styles.modalSaveText}>저장</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* 기본 정보 */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>기본 정보</Text>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>게시판 이름 *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                  placeholder="게시판 이름을 입력하세요"
                  placeholderTextColor={pastelGreenColors[400]}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>설명</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="게시판 설명을 입력하세요"
                  placeholderTextColor={pastelGreenColors[400]}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>게시판 코드</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.code}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, code: text }))}
                  placeholder="게시판 코드 (영문)"
                  placeholderTextColor={pastelGreenColors[400]}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>게시판 타입</Text>
                <View style={styles.radioGroup}>
                  {(['national', 'region', 'school'] as BoardType[]).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.radioOption}
                      onPress={() => setFormData(prev => ({ ...prev, type: type }))}
                    >
                      <MaterialIcons
                        name={formData.type === type ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={pastelGreenColors[600]}
                      />
                      <Text style={styles.radioLabel}>{getBoardTypeLabel(type)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>순서</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.order.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, order: parseInt(text) || 0 }))}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={pastelGreenColors[400]}
                />
              </View>

              <View style={styles.switchField}>
                <Text style={styles.formLabel}>활성화</Text>
                <Switch
                  value={formData.isActive}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value }))}
                  trackColor={{ false: pastelGreenColors[200], true: pastelGreenColors[400] }}
                  thumbColor={formData.isActive ? pastelGreenColors[600] : '#f4f3f4'}
                />
              </View>
            </View>

            {/* 접근 권한 */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>접근 권한</Text>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>읽기 권한</Text>
                <View style={styles.radioGroup}>
                  {['all', 'member', 'verified'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={styles.radioOption}
                      onPress={() => setFormData(prev => ({
                        ...prev,
                        accessLevel: { ...prev.accessLevel, read: level as any }
                      }))}
                    >
                      <MaterialIcons
                        name={formData.accessLevel.read === level ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={pastelGreenColors[600]}
                      />
                      <Text style={styles.radioLabel}>{getAccessLevelLabel(level)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>쓰기 권한</Text>
                <View style={styles.radioGroup}>
                  {['all', 'member', 'verified'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={styles.radioOption}
                      onPress={() => setFormData(prev => ({
                        ...prev,
                        accessLevel: { ...prev.accessLevel, write: level as any }
                      }))}
                    >
                      <MaterialIcons
                        name={formData.accessLevel.write === level ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={pastelGreenColors[600]}
                      />
                      <Text style={styles.radioLabel}>{getAccessLevelLabel(level)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* 게시판 설정 */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>게시판 설정</Text>
              
              <View style={styles.switchField}>
                <Text style={styles.formLabel}>익명 글 허용</Text>
                <Switch
                  value={formData.settings.allowAnonymous}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, allowAnonymous: value }
                  }))}
                  trackColor={{ false: pastelGreenColors[200], true: pastelGreenColors[400] }}
                  thumbColor={formData.settings.allowAnonymous ? pastelGreenColors[600] : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchField}>
                <Text style={styles.formLabel}>첨부파일 허용</Text>
                <Switch
                  value={formData.settings.allowAttachment}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, allowAttachment: value }
                  }))}
                  trackColor={{ false: pastelGreenColors[200], true: pastelGreenColors[400] }}
                  thumbColor={formData.settings.allowAttachment ? pastelGreenColors[600] : '#f4f3f4'}
                />
              </View>

              {formData.settings.allowAttachment && (
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>최대 첨부파일 크기 (MB)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.settings.maxAttachmentSize.toString()}
                    onChangeText={(text) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, maxAttachmentSize: parseInt(text) || 10 }
                    }))}
                    placeholder="10"
                    keyboardType="numeric"
                    placeholderTextColor={pastelGreenColors[400]}
                  />
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pastelGreenColors[500],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: pastelGreenColors[500],
    borderColor: pastelGreenColors[500],
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: pastelGreenColors[600],
  },
  filterButtonTextActive: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  boardCard: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
    overflow: 'hidden',
  },
  boardHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  boardInfo: {
    flex: 1,
  },
  boardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  boardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  boardDescription: {
    fontSize: 14,
    color: pastelGreenColors[600],
    marginBottom: 4,
  },
  boardCode: {
    fontSize: 12,
    color: pastelGreenColors[500],
    fontFamily: 'monospace',
  },
  boardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: pastelGreenColors[50],
  },
  boardStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[700],
  },
  statLabel: {
    fontSize: 12,
    color: pastelGreenColors[500],
  },
  boardSettings: {
    padding: 16,
    backgroundColor: pastelGreenColors[50],
    borderTopWidth: 1,
    borderTopColor: pastelGreenColors[200],
  },
  settingText: {
    fontSize: 12,
    color: pastelGreenColors[600],
    marginBottom: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: pastelGreenColors[500],
    textAlign: 'center',
  },
  // 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  modalCancelText: {
    fontSize: 16,
    color: pastelGreenColors[600],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  modalSaveText: {
    fontSize: 16,
    color: pastelGreenColors[600],
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  formSection: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
    overflow: 'hidden',
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    padding: 16,
    backgroundColor: pastelGreenColors[50],
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  formField: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[100],
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: pastelGreenColors[700],
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: pastelGreenColors[800],
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[100],
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioLabel: {
    fontSize: 14,
    color: pastelGreenColors[700],
  },
}); 