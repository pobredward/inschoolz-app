import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// 기본 유틸리티 함수들
const formatRelativeTime = (timestamp: any) => {
  const date = new Date(timestamp?.seconds * 1000 || Date.now());
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return '방금 전';
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  return `${Math.floor(diffInHours / 24)}일 전`;
};

const parseContentText = (content: string) => {
  if (!content) return '';
  return content.replace(/<[^>]*>/g, '');
};

const truncateText = (text: string, maxLength: number = 100) => {
  if (!text) return '';
  const cleanText = parseContentText(text);
  if (cleanText.length <= maxLength) return cleanText;
  return cleanText.substring(0, maxLength) + '...';
};
import { getBoardsByType, getPostsByBoardType, getAllPostsByType } from '@/lib/boards';
import { useAuthStore } from '../../store/authStore';
import { Board, BoardType, Post } from '../../types';
import BoardSelector from '@/components/board/BoardSelector';
// import SchoolSelector from '../../src/components/board/SchoolSelector'; // 삭제된 컴포넌트
import { Timestamp } from 'firebase/firestore';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';

interface CommunityPost extends Post {
  boardName: string;
  previewContent: string;
}

type SortOption = 'latest' | 'popular' | 'views' | 'comments';

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'views', label: '조회순' },
  { value: 'comments', label: '댓글순' }
];

const { width } = Dimensions.get('window');

export default function CommunityScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [selectedTab, setSelectedTab] = useState<BoardType>('national');
  const [boards, setBoards] = useState<Board[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBoardSelector, setShowBoardSelector] = useState(false);

  // URL 파라미터에서 탭 정보를 받아서 초기 탭 설정
  useEffect(() => {
    if (tab && typeof tab === 'string') {
      const validTabs: BoardType[] = ['national', 'regional', 'school'];
      if (validTabs.includes(tab as BoardType)) {
        setSelectedTab(tab as BoardType);
      }
    }
  }, [tab]);

  useEffect(() => {
    loadBoards();
  }, [selectedTab]);

  useEffect(() => {
    loadPosts();
  }, [selectedTab, selectedBoard, sortBy, boards]);

  const loadBoards = async () => {
    try {
      console.log('Loading boards for type:', selectedTab);
      const boardsData = await getBoardsByType(selectedTab);
      console.log('Loaded boards:', boardsData.length, boardsData);
      setBoards(boardsData);
      setSelectedBoard('all'); // 탭 변경 시 전체로 리셋
    } catch (error) {
      console.error('게시판 로드 실패:', error);
      Alert.alert('오류', '게시판 목록을 불러오는데 실패했습니다.');
    }
  };

  const loadPosts = async () => {
    // boards가 아직 로드되지 않았으면 대기
    if (boards.length === 0 && selectedBoard !== 'all') {
      return;
    }

    try {
      setIsLoading(true);

      let postsData: Post[] = [];

      if (selectedBoard === 'all') {
        // 전체 게시글 가져오기
        postsData = await getAllPostsByType(selectedTab);
      } else {
        // 특정 게시판 게시글 가져오기
        postsData = await getPostsByBoardType(selectedTab, selectedBoard);
      }

      // Post를 CommunityPost 형태로 변환
      const communityPosts: CommunityPost[] = postsData.map(post => ({
        ...post, // 모든 Post 필드를 복사
        boardName: boards.find(b => b.code === post.boardCode)?.name || '게시판',
        previewContent: truncateText(parseContentText(post.content), 100)
      }));

      setPosts(communityPosts);
    } catch (error) {
      console.error('게시글 로드 실패:', error);
      // 에러 발생 시 빈 배열로 설정
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBoards(), loadPosts()]);
    setRefreshing(false);
  };

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = (post: CommunityPost) => {
    router.push(`/board/${selectedTab}/${post.boardCode}/${post.id}` as any);
  };

  const handleWritePress = () => {
    setShowBoardSelector(true);
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {[
        { value: 'school', label: '학교' },
        { value: 'regional', label: '지역' },
        { value: 'national', label: '전국' }
      ].map((tab) => (
        <TouchableOpacity
          key={tab.value}
          style={[
            styles.tab,
            selectedTab === tab.value && styles.activeTab
          ]}
          onPress={() => setSelectedTab(tab.value as BoardType)}
        >
          <Text style={[
            styles.tabText,
            selectedTab === tab.value && styles.activeTabText
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCategoryFilter = () => (
    <View style={styles.categoryContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedBoard === 'all' && styles.activeCategoryButton
          ]}
          onPress={() => setSelectedBoard('all')}
        >
          <Text style={[
            styles.categoryText,
            selectedBoard === 'all' && styles.activeCategoryText
          ]}>
            전체
          </Text>
        </TouchableOpacity>
        {boards.map((board) => (
          <TouchableOpacity
            key={board.code}
            style={[
              styles.categoryButton,
              selectedBoard === board.code && styles.activeCategoryButton
            ]}
            onPress={() => setSelectedBoard(board.code)}
          >
            <Text style={[
              styles.categoryText,
              selectedBoard === board.code && styles.activeCategoryText
            ]}>
              {board.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSortHeader = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.postCount}>총 {posts.length}개</Text>
      <TouchableOpacity style={styles.sortButton}>
        <Text style={styles.sortText}>
          {SORT_OPTIONS.find(option => option.value === sortBy)?.label}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  const renderPostCard = ({ item: post }: { item: CommunityPost }) => (
    <TouchableOpacity style={styles.postCard} onPress={() => handlePostPress(post)}>
      <View style={styles.postHeader}>
        <View style={styles.boardBadge}>
          <Text style={styles.boardBadgeText}>{post.boardName}</Text>
        </View>
        {post.attachments.length > 0 && (
          <View style={styles.imageBadge}>
            <Text style={styles.imageBadgeText}>📷</Text>
          </View>
        )}
      </View>

      <Text style={styles.postTitle} numberOfLines={2}>
        {post.title}
      </Text>

      <Text style={styles.postPreview} numberOfLines={2}>
        {post.previewContent}
      </Text>

      <View style={styles.postMeta}>
        <View style={styles.authorSection}>
          <Text style={styles.postDate}>
            {post.authorInfo?.isAnonymous ? '익명' : post.authorInfo?.displayName || '사용자'} | {formatDate(post.createdAt)}
          </Text>
        </View>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={12} color="#6B7280" />
            <Text style={styles.statText}>{post.stats.commentCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={12} color="#6B7280" />
            <Text style={styles.statText}>{post.stats.likeCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={12} color="#6B7280" />
            <Text style={styles.statText}>{post.stats.viewCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={styles.emptyTitle}>게시글이 없습니다.</Text>
      <Text style={styles.emptySubtitle}>첫 번째 게시글을 작성해보세요!</Text>
    </View>
  );

  return (
    <SafeScreenContainer>
      {renderTabs()}
      {selectedTab === 'school' && (
        <></>
        /* <SchoolSelector 
          style={styles.schoolSelector}
          onSchoolChange={() => {
            // 학교 변경 시 게시글 다시 로드
            loadBoards();
            loadPosts();
          }}
        /> */
      )}
      {renderCategoryFilter()}
      {renderSortHeader()}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPostCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* 글쓰기 버튼 */}
      <TouchableOpacity style={styles.writeButton} onPress={handleWritePress}>
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* 게시판 선택 모달 */}
      <BoardSelector
        isVisible={showBoardSelector}
        onClose={() => setShowBoardSelector(false)}
        type={selectedTab}
      />
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#10B981',
  },
  tabText: {
    fontSize: 16,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#10B981',
    fontWeight: '600',
  },
  categoryContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
  },
  categoryScroll: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
  },
  activeCategoryButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  categoryText: {
    fontSize: 14,
    color: '#374151',
  },
  activeCategoryText: {
    color: 'white',
    fontWeight: '500',
  },
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postList: {
    padding: 16,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  boardBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  boardBadgeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  imageBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  imageBadgeText: {
    fontSize: 10,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 22,
  },
  postPreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  postStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  writeButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  schoolSelector: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
}); 