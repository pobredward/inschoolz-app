import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Board } from '@/types';
import { getBoardsByType } from '@/lib/boards';

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

  const renderBoardItem = ({ item }: { item: Board }) => (
    <TouchableOpacity 
      style={styles.boardItem}
      onPress={() => handleBoardSelect(item)}
    >
      <View style={styles.boardContent}>
        <Text style={styles.boardIcon}>{item.icon}</Text>
        <View style={styles.boardInfo}>
          <Text style={styles.boardName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.boardDescription}>{item.description}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

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
            <FlatList
              data={boards}
              renderItem={renderBoardItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  listContainer: {
    paddingVertical: 20,
  },
  boardItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  boardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  boardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  boardInfo: {
    flex: 1,
  },
  boardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  boardDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
}); 