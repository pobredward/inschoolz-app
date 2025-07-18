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
    return postData?.boardName || '게시판';
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <TouchableOpacity style={styles.commentCard} onPress={() => handleCommentPress(item)}>
      <View style={styles.commentHeader}>
        <View style={styles.boardBadgeContainer}>
          {item.postData && (
            <>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{getBoardTypeLabel(item.postData.type)}</Text>
              </View>
              <View style={styles.boardBadge}>
                <Text style={styles.boardBadgeText}>{getBoardName(item.postData)}</Text>
              </View>
            </>
          )}
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
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
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
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  boardBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  boardBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
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
}); 