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
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBoardsByType, getPostsByBoardType } from '../../../../lib/boards';
import { getBlockedUserIds } from '../../../../lib/users';
import { BlockedUserContent } from '../../../../components/ui/BlockedUserContent';
import { Board, BoardType, Post } from '../../../../types';
import { useAuthStore } from '../../../../store/authStore';
import PostListItem from '../../../../components/PostListItem';
import { toTimestamp } from '../../../../utils/timeUtils';

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
function CustomHeader({ title, onBack, insets }: { 
  title: string; 
  onBack: () => void;
  insets?: { top: number; bottom: number; left: number; right: number };
}) {
  return (
    <View style={[
      styles.header,
      Platform.OS === 'android' && insets && { paddingTop: insets.top + 8 }
    ]}>
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="arrow-back" size={20} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

// 정렬 타입 및 옵션 추가
type SortOption = 'latest' | 'popular' | 'views' | 'comments';

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'views', label: '조회순' },
  { value: 'comments', label: '댓글순' }
];

const { width } = Dimensions.get('window');

export default function BoardScreen() {
  const router = useRouter();
  const { type, boardCode } = useLocalSearchParams();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('latest'); // 정렬 상태 추가
  const [showSortSelector, setShowSortSelector] = useState(false); // 정렬 모달 상태 추가

  // 차단된 사용자 목록 로드
  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const blockedIds = await getBlockedUserIds(user.uid);
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단된 사용자 목록 로드 실패:', error);
    }
  }, [user?.uid]);

  // 차단 해제 시 상태 업데이트
  const handleUnblock = useCallback((userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  }, []);

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
      let postsWithPreview = postsData.map(post => ({
        ...post,
        previewContent: post.content ? parseContentText(post.content).slice(0, 150) : '',
        boardName: foundBoard.name
      }));

      // 정렬 적용
      postsWithPreview = postsWithPreview.sort((a, b) => {
        switch (sortBy) {
          case 'latest':
            return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
          case 'popular':
            return (b.stats?.likeCount || 0) - (a.stats?.likeCount || 0);
          case 'views':
            return (b.stats?.viewCount || 0) - (a.stats?.viewCount || 0);
          case 'comments':
            return (b.stats?.commentCount || 0) - (a.stats?.commentCount || 0);
          default:
            return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
        }
      });
      
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

  // 사용자 정보 변경 시 차단된 사용자 목록 로드
  useEffect(() => {
    if (user?.uid) {
      loadBlockedUsers();
    }
  }, [user?.uid, loadBlockedUsers]);

  // 화면이 포커스될 때마다 게시글 목록 및 차단 목록 새로고침 (게시글 상세에서 돌아온 경우)
  useFocusEffect(
    useCallback(() => {
      // 차단 목록 새로고침
      if (user?.uid) {
        loadBlockedUsers();
      }
      // 초기 로드가 아닌 경우에만 게시글 새로고침 (뒤로가기 등으로 돌아온 경우)
      if (posts.length > 0) {
        loadBoardAndPosts();
      }
    }, [posts.length, user?.uid, loadBlockedUsers])
  );

  // sortBy가 변경될 때마다 다시 로드
  useEffect(() => {
    if (board) {
      loadBoardAndPosts();
    }
  }, [sortBy]);

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

  // 정렬 변경 핸들러
  const handleSortChange = (newSortBy: SortOption) => {
    setSortBy(newSortBy);
    setShowSortSelector(false);
  };

  // 정렬 선택 모달 렌더링
  const renderSortModal = () => (
    <Modal
      visible={showSortSelector}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSortSelector(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSortSelector(false)}
      >
        <View style={styles.sortModal}>
          <View style={styles.sortModalHeader}>
            <Text style={styles.sortModalTitle}>정렬 방식</Text>
            <TouchableOpacity onPress={() => setShowSortSelector(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.activeSortOption
              ]}
              onPress={() => handleSortChange(option.value as SortOption)}
            >
              <Text style={[
                styles.sortOptionText,
                sortBy === option.value && styles.activeSortOptionText
              ]}>
                {option.label}
              </Text>
              {sortBy === option.value && (
                <Ionicons name="checkmark" size={20} color="#10B981" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // 정렬 헤더 렌더링
  const renderSortHeader = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.postCount}>총 {posts.length}개</Text>
      <TouchableOpacity 
        style={styles.sortButton}
        onPress={() => setShowSortSelector(true)}
      >
        <Text style={styles.sortText}>
          {SORT_OPTIONS.find(option => option.value === sortBy)?.label}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.safeArea}>
          <CustomHeader 
            title={`${boardInfo.name} - ${getTypeDisplayName(type as string)}`} 
            onBack={() => router.back()} 
            insets={insets}
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
          insets={insets}
        />
        
        {renderSortHeader()}
        
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
              posts.map((post) => {
                // 차단된 사용자인지 확인
                const isBlocked = post.authorId && blockedUserIds.has(post.authorId);
                
                if (isBlocked && post.authorId) {
                  return (
                    <BlockedUserContent
                      key={post.id}
                      blockedUserId={post.authorId}
                      blockedUserName={post.authorInfo?.displayName || '사용자'}
                      contentType="post"
                      onUnblock={() => handleUnblock(post.authorId!)}
                    >
                      <PostListItem
                        post={post}
                        onPress={handlePostPress}
                        showBadges={true}
                        typeBadgeText={getTypeDisplayName(type as string)}
                        boardBadgeText={boardInfo.name}
                      />
                    </BlockedUserContent>
                  );
                }

                return (
                  <PostListItem
                    key={post.id}
                    post={post}
                    onPress={handlePostPress}
                    showBadges={true}
                    typeBadgeText={getTypeDisplayName(type as string)}
                    boardBadgeText={boardInfo.name}
                  />
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      
      {/* 정렬 선택 모달 */}
      {renderSortModal()}
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
  
  // 정렬 관련 스타일 추가
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  postCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    fontSize: 14,
    color: '#374151',
    marginRight: 4,
  },
  
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: width * 0.8,
    maxWidth: 300,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activeSortOption: {
    backgroundColor: '#F0FDF4',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  activeSortOptionText: {
    color: '#10B981',
    fontWeight: '500',
  },
}); 