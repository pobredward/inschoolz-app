import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getBoardsByType, getPostsByBoardType } from '../../../../lib/boards';
import { Board, BoardType, Post } from '../../../../types';
import { useAuthStore } from '../../../../store/authStore';
import PostListItem from '../../../../components/PostListItem';

// 기본 텍스트 처리 함수
const parseContentText = (content: string) => {
  if (!content) return '';
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
};

const truncateText = (text: string, maxLength: number = 100) => {
  if (!text) return '';
  const cleanText = parseContentText(text);
  if (cleanText.length <= maxLength) return cleanText;
  return cleanText.substring(0, maxLength) + '...';
};

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

interface BoardInfo {
  name: string;
  description: string;
  icon: string;
}

// 커스텀 헤더 컴포넌트
function CustomHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="arrow-back" size={20} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

export default function BoardScreen() {
  const router = useRouter();
  const { type, boardCode } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadBoardAndPosts = async () => {
    try {
      setLoading(true);
      
      // 게시판 정보 가져오기
      const boards = await getBoardsByType(type as BoardType);
      const foundBoard = boards.find((b: Board) => b.code === boardCode);
      
      if (!foundBoard) {
        Alert.alert('오류', '게시판을 찾을 수 없습니다.');
        router.back();
        return;
      }
      
      setBoard(foundBoard);
      
      // 게시글 목록 가져오기
      let postsData: Post[] = [];
      
      if (type === 'school' && user?.school?.id) {
        postsData = await getPostsByBoardType(
          type as BoardType,
          boardCode as string,
          20,
          user.school.id
        );
      } else if (type === 'regional' && user?.regions?.sido && user?.regions?.sigungu) {
        postsData = await getPostsByBoardType(
          type as BoardType,
          boardCode as string,
          20,
          undefined,
          { sido: user.regions.sido, sigungu: user.regions.sigungu }
        );
      } else {
        postsData = await getPostsByBoardType(
          type as BoardType,
          boardCode as string,
          20
        );
      }
      
      // 게시글에 미리보기 내용 추가
      const postsWithPreview = postsData.map(post => ({
        ...post,
        previewContent: post.content ? parseContentText(post.content).slice(0, 150) : '',
        boardName: foundBoard.name
      }));
      
      setPosts(postsWithPreview);
      
    } catch (error) {
      console.error('게시판 데이터 로드 실패:', error);
      Alert.alert('오류', '게시판 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBoardAndPosts();
    setRefreshing(false);
  };

  const getBoardInfo = (boardCode: string): BoardInfo => {
    if (board) {
      return {
        name: board.name,
        description: board.description || '',
        icon: board.icon
      };
    }
    
    // 기본값
    const boardMap: Record<string, BoardInfo> = {
      'free': { name: '자유게시판', description: '자유롭게 이야기해요', icon: '💬' },
      'study': { name: '공부', description: '학습 관련 정보를 공유해요', icon: '📚' },
      'career': { name: '진로', description: '진로와 취업 정보를 나눠요', icon: '🎯' },
      'club': { name: '동아리', description: '동아리 활동을 공유해요', icon: '🎭' },
      'food': { name: '맛집', description: '맛있는 곳을 추천해요', icon: '🍕' },
      'sports': { name: '스포츠', description: '운동과 스포츠 이야기', icon: '⚽' },
      'game': { name: '게임', description: '게임 이야기를 나눠요', icon: '🎮' },
      'music': { name: '음악', description: '음악을 공유하고 이야기해요', icon: '🎵' },
      'movie': { name: '영화/드라마', description: '영상 콘텐츠를 추천해요', icon: '🎬' },
      'fashion': { name: '패션/뷰티', description: '스타일과 뷰티 팁을 공유해요', icon: '👗' },
      'travel': { name: '여행', description: '여행 경험을 공유해요', icon: '✈️' },
      'life': { name: '일상', description: '소소한 일상을 공유해요', icon: '☕' },
    };
    return boardMap[boardCode as string] || { name: '게시판', description: '', icon: '📋' };
  };

  useEffect(() => {
    loadBoardAndPosts();
  }, [type, boardCode, user]);

  // 화면이 포커스될 때마다 게시글 목록 새로고침 (게시글 상세에서 돌아온 경우)
  useFocusEffect(
    useCallback(() => {
      // 초기 로드가 아닌 경우에만 새로고침 (뒤로가기 등으로 돌아온 경우)
      if (posts.length > 0) {
        loadBoardAndPosts();
      }
    }, [posts.length])
  );
  useFocusEffect(
    useCallback(() => {
      // 초기 로드가 아닌 경우에만 새로고침 (뒤로가기 등으로 돌아온 경우)
      if (posts.length > 0) {
        loadBoardAndPosts();
      }
    }, [posts.length])
  );

  const handlePostPress = (post: Post & { boardName?: string; previewContent?: string }) => {
    router.push(`/board/${type}/${boardCode}/${post.id}`);
  };

  const handleWritePress = () => {
    router.push(`/board/${type}/${boardCode}/write`);
  };

  const getTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      'national': '전국',
      'regional': '지역',
      'school': '학교',
    };
    return typeMap[type as string] || type;
  };

  const boardInfo = getBoardInfo(boardCode as string);

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.safeArea}>
          <CustomHeader 
            title={`${boardInfo.name} - ${getTypeDisplayName(type as string)}`} 
            onBack={() => router.back()} 
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={pastelGreenColors[500]} />
            <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <CustomHeader 
          title={`${boardInfo.name} - ${getTypeDisplayName(type as string)}`} 
          onBack={() => router.back()} 
        />
        <ScrollView 
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 게시판 헤더 */}
          <View style={styles.boardHeader}>
            <View style={styles.boardIconContainer}>
              <Text style={styles.boardIcon}>{boardInfo.icon}</Text>
            </View>
            <View style={styles.boardInfoContainer}>
              <Text style={styles.boardName}>{boardInfo.name}</Text>
              <Text style={styles.boardDescription}>{boardInfo.description}</Text>
              <Text style={styles.boardType}>{getTypeDisplayName(type as string)} 커뮤니티</Text>
            </View>
          </View>

          {/* 글쓰기 버튼 */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.writeButton} onPress={handleWritePress}>
              <Text style={styles.writeButtonText}>✏️ 글쓰기</Text>
            </TouchableOpacity>
          </View>

          {/* 게시글 목록 */}
          <View style={styles.postList}>
            {posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>아직 게시글이 없습니다.</Text>
                <Text style={styles.emptySubText}>첫 번째 글을 작성해보세요!</Text>
              </View>
            ) : (
              posts.map((post) => (
                <PostListItem
                  key={post.id}
                  post={post}
                  onPress={handlePostPress}
                  showBadges={true}
                  typeBadgeText={getTypeDisplayName(type as string)}
                  boardBadgeText={boardInfo.name}
                />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 0,
    shadowOpacity: 0,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  boardIconContainer: {
    width: 50,
    height: 50,
    backgroundColor: pastelGreenColors[100],
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  boardIcon: {
    fontSize: 24,
  },
  boardInfoContainer: {
    flex: 1,
  },
  boardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  boardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  boardType: {
    fontSize: 12,
    color: pastelGreenColors[600],
    fontWeight: '500',
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  writeButton: {
    backgroundColor: pastelGreenColors[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  writeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  postList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    color: '#9ca3af',
  },
}); 