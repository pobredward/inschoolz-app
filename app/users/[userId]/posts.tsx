import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Platform,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { getUserPosts, getUserById } from '../../../lib/users';
import { SafeScreenContainer } from '../../../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../../../utils/timeUtils';
import { Post } from '../../../types';
import PostListItem from '../../../components/PostListItem';

// users.ts에서 반환하는 Post 타입
interface UserPost {
  id: string;
  title: string;
  content: string;
  createdAt: any;
  boardCode: string;
  type: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
  attachments?: any[];
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  boardName?: string;
  previewContent?: string;
  schoolName?: string;
}

type BoardType = 'all' | 'national' | 'regional' | 'school';

export default function UserPostsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<UserPost[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<BoardType>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 10;

  const filterPosts = (posts: UserPost[], type: BoardType) => {
    if (type === 'all') return posts;
    return posts.filter(post => post.type === type);
  };

  const loadUser = async () => {
    if (!userId) return;
    
    try {
      const userData = await getUserById(userId);
      setUser(userData);
    } catch (error) {
      console.error('사용자 정보 로드 오류:', error);
    }
  };

  const loadPosts = async (pageNum: number = 1, isLoadMore: boolean = false) => {
    if (!userId) return;

    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const result = await getUserPosts(userId, pageNum, ITEMS_PER_PAGE, 'latest');
      
      if (isLoadMore) {
        setPosts(prev => [...prev, ...result.posts]);
      } else {
        setPosts(result.posts);
      }
      
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('게시글 로드 오류:', error);
      Alert.alert('오류', '게시글을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadPosts(1, false);
    setRefreshing(false);
  }, [userId]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPosts(page + 1, true);
    }
  };

  useEffect(() => {
    loadUser();
    loadPosts();
  }, [userId]);

  useEffect(() => {
    setFilteredPosts(filterPosts(posts, selectedType));
  }, [selectedType, posts]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadPosts();
      }
    }, [userId])
  );

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = (post: UserPost) => {
    // 모든 게시글을 national 타입으로 통일하여 라우팅 (게시글 ID로 직접 조회하므로 타입 무관)
    let route = `/board/national/${post.boardCode || 'free'}/${post.id}`;
    
    console.log('유저 게시글 라우팅:', route);
    
    if (route) {
      router.push(route as any);
    }
  };

  const handleTypeChange = (type: BoardType) => {
    setSelectedType(type);
  };

  const getTypeLabel = (type: BoardType) => {
    switch (type) {
      case 'all': return '전체';
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return '전체';
    }
  };

  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type;
    }
  };

  const getBoardName = (post: UserPost) => {
    return post.boardName || '게시판';
  };

  const handleGoBack = () => {
    router.back();
  };


  const renderFilterTabs = () => {
    const types: BoardType[] = ['all', 'national', 'regional', 'school'];
    
    return (
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {types.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                selectedType === type && styles.filterButtonActive
              ]}
              onPress={() => handleTypeChange(type)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedType === type && styles.filterButtonTextActive
              ]}>
                {getTypeLabel(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPost = ({ item }: { item: UserPost }) => (
    <PostListItem
      post={{
        ...item,
        type: item.type as 'national' | 'regional' | 'school',
        authorId: userId || 'unknown',
        authorInfo: { 
          displayName: user?.profile?.userName || '사용자', 
          isAnonymous: false 
        },
        boardName: getBoardName(item),
        attachments: item.attachments || [],
        tags: [],
        status: { isPinned: false, isDeleted: false, isHidden: false, isBlocked: false },
        stats: {
          ...item.stats,
          scrapCount: 0,
        },
      }}
      onPress={handlePostPress}
      showBadges={true}
      typeBadgeText={getBoardTypeLabel(item.type)}
      boardBadgeText={getBoardName(item)}
      variant="profile"
    />
  );

  const renderEmptyState = () => {
    const emptyMessages = {
      all: `${user?.profile?.userName || '사용자'}님이 작성한 게시글이 없습니다.`,
      national: `${user?.profile?.userName || '사용자'}님이 전국 게시판에 작성한 게시글이 없습니다.`,
      regional: `${user?.profile?.userName || '사용자'}님이 지역 게시판에 작성한 게시글이 없습니다.`,
      school: `${user?.profile?.userName || '사용자'}님이 학교 게시판에 작성한 게시글이 없습니다.`,
    };

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyTitle}>작성한 게시글이 없습니다</Text>
        <Text style={styles.emptyDescription}>
          {emptyMessages[selectedType]}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>게시글</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {user?.profile?.userName || '사용자'}님의 게시글
          </Text>
          <View style={styles.placeholder} />
        </View>

        {renderFilterTabs()}

        <FlatList
          data={filteredPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={() => {
            if (!hasMore || filteredPosts.length === 0) return null;
            
            return (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity 
                  style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                >
                  <Text style={styles.loadMoreButtonText}>
                    {loadingMore ? '로딩 중...' : '더보기'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          contentContainerStyle={filteredPosts.length === 0 ? styles.emptyListContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadMoreContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadMoreButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadMoreButtonDisabled: {
    opacity: 0.5,
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
