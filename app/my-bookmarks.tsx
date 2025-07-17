import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  StatusBar,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getBookmarkedPosts } from '../lib/boards';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../utils/timeUtils';
import { FirebaseTimestamp } from '../types';

// boards.ts에서 반환하는 Post 타입
interface UserPost {
  id: string;
  title: string;
  content: string;
  createdAt: FirebaseTimestamp;
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  previewContent?: string;
  boardName?: string;
  schoolName?: string;
}

export default function MyBookmarksScreen() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookmarkedPosts = async () => {
    if (!user?.uid) return;

    try {
      const bookmarkedPosts = await getBookmarkedPosts(user.uid);
      setPosts(bookmarkedPosts);
    } catch (error) {
      console.error('북마크 글 로드 오류:', error);
      Alert.alert('오류', '북마크한 글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarkedPosts();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookmarkedPosts();
    setRefreshing(false);
  };

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = (post: UserPost) => {
    // 게시글 상세 페이지로 이동 (추후 구현)
    Alert.alert('게시글 보기', '게시글 상세 페이지는 준비중입니다.');
  };

  const renderPost = ({ item }: { item: UserPost }) => (
    <TouchableOpacity style={styles.postCard} onPress={() => handlePostPress(item)}>
      <View style={styles.postHeader}>
        <View style={styles.bookmarkIndicator}>
          <Ionicons name="bookmark" size={14} color="#f59e0b" />
          <Text style={styles.bookmarkText}>스크랩</Text>
        </View>
        <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.postContent} numberOfLines={3}>
        {item.content.replace(/<[^>]*>/g, '')}
      </Text>
      <View style={styles.postStats}>
        <View style={styles.statItem}>
          <Ionicons name="eye-outline" size={14} color="#6b7280" />
          <Text style={styles.statText}>{item.stats.viewCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="heart-outline" size={14} color="#6b7280" />
          <Text style={styles.statText}>{item.stats.likeCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="chatbubble-outline" size={14} color="#6b7280" />
          <Text style={styles.statText}>{item.stats.commentCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔖</Text>
      <Text style={styles.emptyTitle}>스크랩한 글이 없습니다</Text>
      <Text style={styles.emptyDescription}>나중에 읽고 싶은 글을 스크랩해보세요!</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>스크랩한 글</Text>
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 36,
    height: 36,
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
  bookmarkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bookmarkText: {
    fontSize: 12,
    color: '#f59e0b',
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