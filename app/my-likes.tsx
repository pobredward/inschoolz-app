import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getUserLikedPosts } from '../lib/users';
import { formatRelativeTime } from '../utils/timeUtils';
import { Post } from '../types';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import PostListItem from '../components/PostListItem';

// users.ts에서 반환하는 Post 타입
interface UserPost {
  id: string;
  title: string;
  content: string;
  createdAt: any;
  boardCode?: string;
  type?: string;
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  boardName?: string;
  previewContent?: string;
}

export default function MyLikesScreen() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLikedPosts = async () => {
    if (!user?.uid) return;

    try {
      const likedPosts = await getUserLikedPosts(user.uid, 1, 20);
      setPosts(likedPosts);
    } catch (error) {
      console.error('좋아요한 글 로드 오류:', error);
      Alert.alert('오류', '좋아요한 글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLikedPosts();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLikedPosts();
    setRefreshing(false);
  };

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = (post: UserPost) => {
    // 게시글 상세 페이지로 이동 (추후 구현)
    Alert.alert('게시글 보기', '게시글 상세 페이지는 준비중입니다.');
  };

  const getBoardTypeLabel = (type?: string) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return '커뮤니티';
    }
  };

  const getBoardName = (post: UserPost) => {
    // boardName이 있으면 직접 사용
    if (post.boardName) {
      return post.boardName;
    }
    
    // fallback for existing posts without boardName
    switch (post.boardCode) {
      case 'free': return '자유게시판';
      case 'qa': return '질문/답변';
      case 'study': return '스터디';
      case 'club': return '동아리';
      case 'notice': return '공지사항';
      case 'graduate': return '졸업생';
      case 'academy': return '학원정보';
      case 'restaurant': return '맛집추천';
      case 'local': return '동네소식';
      case 'together': return '함께해요';
      case 'job': return '구인구직';
      case 'exam': return '입시정보';
      case 'career': return '진로상담';
      case 'university': return '대학생활';
      case 'hobby': return '취미생활';
      default: return '게시판';
    }
  };

  const renderPost = ({ item }: { item: UserPost }) => (
    <PostListItem
      post={{
        ...item,
        type: (item.type as 'national' | 'regional' | 'school') || 'school',
        boardCode: item.boardCode || 'free',
        authorId: 'anonymous',
        authorInfo: { displayName: '익명', isAnonymous: true },
        boardName: getBoardName(item),
        attachments: [],
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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>❤️</Text>
      <Text style={styles.emptyTitle}>좋아요한 글이 없습니다</Text>
      <Text style={styles.emptyDescription}>마음에 드는 글에 좋아요를 눌러보세요!</Text>
    </View>
  );

  return (
    <SafeScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>좋아요한 글</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={!loading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  likeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  likeText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  postDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
}); 