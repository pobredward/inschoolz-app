import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getUserPosts } from '../lib/users';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../utils/timeUtils';

interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: number;
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
}

type BoardType = 'all' | 'national' | 'regional' | 'school';

export default function MyPostsScreen() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<BoardType>('all');

  const loadPosts = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserPosts(user.uid, 1, 50, 'latest'); // 더 많은 게시글 로드하여 필터링
      setPosts(result.posts);
      filterPosts(result.posts, selectedType);
    } catch (error) {
      console.error('내 게시글 로드 오류:', error);
      Alert.alert('오류', '게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = (posts: Post[], type: BoardType) => {
    if (type === 'all') {
      setFilteredPosts(posts);
    } else {
      setFilteredPosts(posts.filter(post => post.type === type));
    }
  };

  useEffect(() => {
    loadPosts();
  }, [user]);

  useEffect(() => {
    filterPosts(posts, selectedType);
  }, [selectedType, posts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const formatDate = (timestamp: number) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = (post: Post) => {
    // 게시글 타입별 라우팅
    let route = '';
    if (post.type === 'national') {
      route = `/board/national/${post.boardCode}/${post.id}`;
    } else if (post.type === 'regional' && post.regions) {
      route = `/board/regional/${post.regions.sido}/${post.regions.sigungu}/${post.boardCode}/${post.id}`;
    } else if (post.type === 'school' && post.schoolId) {
      route = `/board/school/${post.schoolId}/${post.boardCode}/${post.id}`;
    }
    
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

  const renderTypeFilter = () => {
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

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity style={styles.postCard} onPress={() => handlePostPress(item)}>
      <View style={styles.postHeader}>
        <View style={styles.boardBadge}>
          <Text style={styles.boardBadgeText}>{item.boardName || '게시판'}</Text>
        </View>
        {item.attachments && item.attachments.length > 0 && (
          <View style={styles.imageBadge}>
            <Text style={styles.imageBadgeText}>📷</Text>
          </View>
        )}
      </View>

      <Text style={styles.postTitle} numberOfLines={2}>
        {item.title}
      </Text>

      {item.previewContent && (
        <Text style={styles.postPreview} numberOfLines={2}>
          {item.previewContent}
        </Text>
      )}

      <View style={styles.postMeta}>
        <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={12} color="#6B7280" />
            <Text style={styles.statText}>{item.stats.commentCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={12} color="#6B7280" />
            <Text style={styles.statText}>{item.stats.likeCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={12} color="#6B7280" />
            <Text style={styles.statText}>{item.stats.viewCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={styles.emptyTitle}>
        {selectedType === 'all' ? '작성한 게시글이 없습니다' : `${getTypeLabel(selectedType)} 게시글이 없습니다`}
      </Text>
      <Text style={styles.emptyDescription}>첫 번째 게시글을 작성해보세요!</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내가 쓴 글</Text>
        <View style={styles.placeholder} />
      </View>
      {renderTypeFilter()}
      <View style={styles.countContainer}>
        <Text style={styles.postCount}>총 {filteredPosts.length}개</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeScreenContainer>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>내가 쓴 글</Text>
            <View style={styles.placeholder} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text>로딩 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  return (
    <SafeScreenContainer>
      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      />
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  postCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
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
    fontWeight: '500',
    color: '#374151',
  },
  imageBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  imageBadgeText: {
    fontSize: 10,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 22,
  },
  postPreview: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
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
    alignItems: 'center',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
}); 