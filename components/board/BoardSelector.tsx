import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getBoardsByType } from '../../lib/boards';
import { Board } from '../../types';

interface BoardSelectorProps {
  isVisible: boolean;
  onClose: () => void;
  type: 'national' | 'regional' | 'school';
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

const { width: screenWidth } = Dimensions.get('window');

export default function BoardSelector({ 
  isVisible, 
  onClose, 
  type, 
  schoolId, 
  regions 
}: BoardSelectorProps) {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadBoards();
    }
  }, [isVisible, type]);

  const loadBoards = async () => {
    setLoading(true);
    try {
      const boardList = await getBoardsByType(type);
      setBoards(boardList);
    } catch (error) {
      console.error('게시판 목록 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBoardSelect = (board: Board) => {
    onClose();
    
    // 게시판 타입에 따라 적절한 URL로 이동
    let writeUrl = '';
    
    switch (type) {
      case 'national':
        writeUrl = `/board/national/${board.code}/write`;
        break;
      case 'regional':
        writeUrl = `/board/regional/${board.code}/write`;
        break;
      case 'school':
        writeUrl = `/board/school/${board.code}/write`;
        break;
    }
    
    if (writeUrl) {
      router.push(writeUrl as any);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'national':
        return '전국 게시판 선택';
      case 'regional':
        return '지역 게시판 선택';
      case 'school':
        return '학교 게시판 선택';
      default:
        return '게시판 선택';
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>{getTitle()}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* 게시판 목록 */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>게시판 목록을 불러오는 중...</Text>
            </View>
          ) : boards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>사용 가능한 게시판이 없습니다.</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.badgeContainer}
            >
              <View style={styles.badgeWrapper}>
                {boards.map((board) => (
                  <TouchableOpacity
                    key={board.id}
                    style={styles.badge}
                    onPress={() => handleBoardSelect(board)}
                  >
                    <Text style={styles.badgeText}>{board.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* 푸터 */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  badgeContainer: {
    paddingVertical: 20,
  },
  badgeWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
}); 