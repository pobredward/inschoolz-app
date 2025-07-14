import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getUserComments } from '../lib/users';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../utils/timeUtils';

interface Comment {
  id: string;
  content: string;
  postId: string;
  createdAt: number;
  postData?: {
    title: string;
    type: string;
    boardCode: string;
    schoolId?: string;
    regions?: {
      sido: string;
      sigungu: string;
    };
  };
}

export default function MyCommentsScreen() {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadComments = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserComments(user.uid, 1, 20);
      setComments(result.comments);
    } catch (error) {
      console.error('내 댓글 로드 오류:', error);
      Alert.alert('오류', '댓글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadComments();
    setRefreshing(false);
  };

  const formatDate = (timestamp: number) => {
    return formatRelativeTime(timestamp);
  };

  const handleCommentPress = (comment: Comment) => {
    if (!comment.postData) return;

    // 게시글 타입별 라우팅
    let route = '';
    const { type, boardCode, schoolId, regions } = comment.postData;
    
    if (type === 'national') {
      route = `/board/national/${boardCode}/${comment.postId}`;
    } else if (type === 'regional' && regions) {
      route = `/board/regional/${regions.sido}/${regions.sigungu}/${boardCode}/${comment.postId}`;
    } else if (type === 'school' && schoolId) {
      route = `/board/school/${schoolId}/${boardCode}/${comment.postId}`;
    }
    
    if (route) {
      router.push(route as any);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <TouchableOpacity style={styles.commentCard} onPress={() => handleCommentPress(item)}>
      <View style={styles.commentHeader}>
        <View style={styles.commentBadge}>
          <Text style={styles.commentBadgeText}>댓글</Text>
        </View>
        <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
      </View>
      
      <Text style={styles.commentContent} numberOfLines={3}>
        {item.content}
      </Text>
      
      {item.postData && (
        <View style={styles.commentFooter}>
          <Ionicons name="document-text-outline" size={12} color="#6B7280" />
          <Text style={styles.postLink} numberOfLines={1}>
            {item.postData.title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>작성한 댓글이 없습니다</Text>
      <Text style={styles.emptyDescription}>첫 번째 댓글을 작성해보세요!</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 댓글</Text>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.countContainer}>
        <Text style={styles.commentCount}>총 {comments.length}개</Text>
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
            <Text style={styles.headerTitle}>내 댓글</Text>
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
        data={comments}
        renderItem={renderComment}
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
  countContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  commentCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  commentCard: {
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
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  commentBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E40AF',
  },
  commentDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  commentContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postLink: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
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