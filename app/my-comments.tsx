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
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { FirebaseTimestamp } from '../types';
import { getUserComments } from '../lib/users';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../utils/timeUtils';

interface Comment {
  id: string;
  content: string;
  postId: string;
  createdAt: FirebaseTimestamp;
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

interface GroupedComment {
  postId: string;
  postData: any;
  comments: Comment[];
}

export default function MyCommentsScreen() {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [groupedComments, setGroupedComments] = useState<GroupedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const groupCommentsByPost = (comments: Comment[]): GroupedComment[] => {
    const grouped = comments.reduce((acc, comment) => {
      const postId = comment.postId;
      if (!acc[postId]) {
        acc[postId] = {
          postId,
          postData: comment.postData,
          comments: []
        };
      }
      acc[postId].comments.push(comment);
      return acc;
    }, {} as Record<string, GroupedComment>);
    
    // 최신 댓글 순으로 정렬
    return Object.values(grouped).sort((a, b) => {
      const latestA = Math.max(...a.comments.map(c => {
        if (typeof c.createdAt === 'number') return c.createdAt;
        return (c.createdAt as any)?.seconds || 0;
      }));
      const latestB = Math.max(...b.comments.map(c => {
        if (typeof c.createdAt === 'number') return c.createdAt;
        return (c.createdAt as any)?.seconds || 0;
      }));
      return latestB - latestA;
    });
  };

  const loadComments = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserComments(user.uid, 1, 20);
      setComments(result.comments);
      
      // 게시글별로 댓글 그룹화
      const grouped = groupCommentsByPost(result.comments);
      setGroupedComments(grouped);
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

  const formatDate = (timestamp: FirebaseTimestamp) => {
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

  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type;
    }
  };

  const getBoardName = (postData: any) => {
    return postData?.boardName || postData?.boardCode || '게시판';
  };

  const handleGroupPress = (group: GroupedComment) => {
    if (!group.postData) return;

    // 게시글 타입별 라우팅
    let route = '';
    const { type, boardCode, schoolId, regions } = group.postData;
    
    if (type === 'national') {
      route = `/board/national/${boardCode}/${group.postId}`;
    } else if (type === 'regional' && regions) {
      route = `/board/regional/${regions.sido}/${regions.sigungu}/${boardCode}/${group.postId}`;
    } else if (type === 'school' && schoolId) {
      route = `/board/school/${schoolId}/${boardCode}/${group.postId}`;
    }
    
    if (route) {
      router.push(route as any);
    }
  };

  const renderGroupedComment = ({ item }: { item: GroupedComment }) => (
    <View style={styles.groupCard}>
      {/* 게시글 정보 헤더 */}
      <TouchableOpacity style={styles.postHeader} onPress={() => handleGroupPress(item)}>
        <View style={styles.postHeaderTop}>
          <View style={styles.boardBadgeContainer}>
            {item.postData && (
              <>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{getBoardTypeLabel(item.postData.type)}</Text>
                </View>
                <View style={styles.boardBadge}>
                  <Text style={styles.boardBadgeText}>{getBoardName(item.postData)}</Text>
                </View>
                {(item.postData as any).attachments && (item.postData as any).attachments.length > 0 && (
                  <View style={styles.imageBadge}>
                    <Text style={styles.imageBadgeText}>📷 사진</Text>
                  </View>
                )}
                {(item.postData as any).poll && (
                  <View style={styles.pollBadge}>
                    <Text style={styles.pollBadgeText}>📊 투표</Text>
                  </View>
                )}
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </View>
        {item.postData?.title && (
          <Text style={styles.postTitle} numberOfLines={2}>
            {item.postData.title}
          </Text>
        )}
        <Text style={styles.commentCount}>
          댓글 {item.comments.length}개 작성
        </Text>
      </TouchableOpacity>

      {/* 내 댓글들 */}
      <View style={styles.commentsContainer}>
        {item.comments.map((comment, index) => (
          <View key={comment.id} style={styles.commentItem}>
            <View style={styles.commentItemHeader}>
              <Text style={styles.commentNumber}>댓글 #{index + 1}</Text>
              <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
            </View>
            <Text style={styles.commentText} numberOfLines={3}>
              {comment.content}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>작성한 댓글이 없습니다</Text>
      <Text style={styles.emptyDescription}>첫 번째 댓글을 작성해보세요!</Text>
    </View>
  );



  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>내 댓글</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <Text>로딩 중...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>내 댓글</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.countContainer}>
          <Text style={styles.commentCount}>총 {comments.length}개</Text>
        </View>

        <FlatList
          data={groupedComments}
          renderItem={renderGroupedComment}
          keyExtractor={(item) => item.postId}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#1F2937',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 36,
    height: 36,
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
  boardBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#15803d',
  },
  boardBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  boardBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#1d4ed8',
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
  safeArea: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  imageBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#c2410c',
  },
  pollBadge: {
    backgroundColor: '#faf5ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  pollBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#7c3aed',
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  postHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  commentCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  commentsContainer: {
    padding: 16,
    paddingTop: 0,
  },
  commentItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  commentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentNumber: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  commentText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
}); 