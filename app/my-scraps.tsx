import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getScrappedPosts } from '../lib/boards';
import { getBlockedUserIds } from '../lib/users';
import { BlockedUserContent } from '../components/ui/BlockedUserContent';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../utils/timeUtils';
import { Post } from '../types';
import PostListItem from '../components/PostListItem';

export default function MyScrapsScreen() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // 차단된 사용자 목록 로드
  const loadBlockedUsers = async () => {
    if (!user?.uid) return;
    
    try {
      const blockedIds = await getBlockedUserIds(user.uid);
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단된 사용자 목록 로드 실패:', error);
    }
  };

  // 차단 해제 시 상태 업데이트
  const handleUnblock = (userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  const loadPosts = async () => {
    if (!user?.uid) return;

    try {
      const scrappedPosts = await getScrappedPosts(user.uid);
      setPosts(scrappedPosts);
    } catch (error) {
      console.error('스크랩한 글 로드 오류:', error);
      Alert.alert('오류', '스크랩한 글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [user]);

  // 사용자 정보 변경 시 차단된 사용자 목록 로드
  useEffect(() => {
    if (user?.uid) {
      loadBlockedUsers();
    }
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = (post: Post) => {
    // 게시글 상세 페이지로 이동
    if (post.type && post.boardCode) {
      router.push(`/board/${post.type}/${post.boardCode}/${post.id}` as any);
    } else {
      Alert.alert('오류', '게시글 정보가 불완전합니다.');
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

  const getBoardName = (post: Post) => {
    return post.boardName || '게시판';
  };

  const renderPost = ({ item }: { item: Post }) => {
    // 차단된 사용자인지 확인
    const isBlocked = item.authorId && blockedUserIds.has(item.authorId);
    
    const postListItem = (
      <PostListItem
        post={{
          ...item,
          boardName: getBoardName(item),
        }}
        onPress={handlePostPress}
        showBadges={true}
        typeBadgeText={getBoardTypeLabel(item.type)}
        boardBadgeText={getBoardName(item)}
        variant="profile"
      />
    );

    if (isBlocked && item.authorId) {
      return (
        <BlockedUserContent
          key={item.id}
          blockedUserId={item.authorId}
          blockedUserName={item.authorInfo?.displayName || '사용자'}
          contentType="post"
          onUnblock={() => handleUnblock(item.authorId!)}
        >
          {postListItem}
        </BlockedUserContent>
      );
    }

    return postListItem;
  };

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