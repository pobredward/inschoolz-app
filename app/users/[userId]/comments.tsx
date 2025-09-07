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
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getUserComments, getUserById } from '../../../lib/users';
import { formatRelativeTime } from '../../../utils/timeUtils';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseTimestamp } from '../../../types';

interface Comment {
  id: string;
  content: string;
  postId: string;
  createdAt: FirebaseTimestamp;
  postData?: {
    title: string;
    type: string;
    boardCode: string;
    boardName?: string;
    schoolId?: string;
    regions?: {
      sido: string;
      sigungu: string;
    };
  };
}

type CommentType = 'all' | 'national' | 'regional' | 'school';

export default function UserCommentsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [filteredComments, setFilteredComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<CommentType>('all');

  const filterComments = (comments: Comment[], type: CommentType) => {
    if (type === 'all') return comments;
    return comments.filter(comment => comment.postData?.type === type);
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

  const loadComments = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const result = await getUserComments(userId, 1, 50);
      setComments(result.comments);
      setFilteredComments(filterComments(result.comments, selectedType));
    } catch (error) {
      console.error('댓글 로드 오류:', error);
      Alert.alert('오류', '댓글을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadComments();
    setRefreshing(false);
  };

  useEffect(() => {
    loadUser();
    loadComments();
  }, [userId]);

  useEffect(() => {
    setFilteredComments(filterComments(comments, selectedType));
  }, [selectedType, comments]);

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handleTypeChange = (type: CommentType) => {
    setSelectedType(type);
  };

  const getTypeLabel = (type: CommentType) => {
    switch (type) {
      case 'all': return '전체';
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return '전체';
    }
  };

  const renderFilterTabs = () => {
    const types: CommentType[] = ['all', 'national', 'regional', 'school'];
    
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

  const handleCommentPress = (comment: Comment) => {
    // 게시글 데이터 검증
    if (!comment.postData || !comment.postId) {
      Alert.alert('오류', '게시글 정보를 찾을 수 없습니다.');
      return;
    }

    // 삭제되거나 접근할 수 없는 게시글 확인
    if (comment.postData.title === '삭제된 게시글' || comment.postData.title === '접근할 수 없는 게시글') {
      Alert.alert('알림', '해당 게시글에 접근할 수 없습니다.');
      return;
    }

    // 게시글 타입별 라우팅
    let route = '';
    const { type, boardCode, schoolId, regions } = comment.postData;
    
    console.log('댓글 클릭 - 라우팅 정보:', {
      postId: comment.postId,
      type,
      boardCode,
      schoolId,
      regions
    });
    
    // 모든 게시글을 national 타입으로 통일하여 라우팅 (게시글 ID로 직접 조회하므로 타입 무관)
    route = `/board/national/${boardCode || 'free'}/${comment.postId}`;
    
    console.log('원본 타입 정보:', { type, boardCode, schoolId, regions });
    console.log('통일된 라우트로 변경:', route);
    
    console.log('생성된 라우트:', route);
    
    if (route) {
      router.push(route as any);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const getBoardTypeLabel = (type?: string) => {
    switch (type) {
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return type || '게시판';
    }
  };

  const getBoardName = (postData: any) => {
    return postData?.boardName || postData?.boardCode || '게시판';
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <View style={styles.boardBadgeContainer}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{getBoardTypeLabel(item.postData?.type || 'national')}</Text>
          </View>
          <View style={styles.boardBadge}>
            <Text style={styles.boardBadgeText}>{getBoardName(item.postData)}</Text>
          </View>
        </View>
        <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
      </View>
      
      {/* 게시글 제목 표시 */}
      <Text style={styles.postTitle} numberOfLines={2}>
        {item.postData?.title || '게시글 제목 없음'}
      </Text>
      
      <Text style={styles.commentContent} numberOfLines={3}>
        댓글 내용: {item.content?.replace(/<[^>]*>/g, '') || '댓글 내용'}
      </Text>
      
      <TouchableOpacity 
        style={styles.commentFooter}
        onPress={() => handleCommentPress(item)}
        disabled={item.postData?.title === '삭제된 게시글' || item.postData?.title === '게시글 정보 없음'}
      >
        <Text style={[
          styles.postLink,
          (item.postData?.title === '삭제된 게시글' || item.postData?.title === '게시글 정보 없음') && styles.disabledLink
        ]} numberOfLines={1}>
          {(item.postData?.title === '삭제된 게시글' || item.postData?.title === '게시글 정보 없음') 
            ? '접근 불가' 
            : '게시글로 이동 →'
          }
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>
        {selectedType === 'all' ? '작성한 댓글이 없습니다' : `${getTypeLabel(selectedType)} 댓글이 없습니다`}
      </Text>
      <Text style={styles.emptyDescription}>{user?.profile?.userName || '사용자'}님이 첫 번째 댓글을 작성해보세요!</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>댓글</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>댓글을 불러오는 중...</Text>
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
            {user?.profile?.userName || '사용자'}님의 댓글
          </Text>
          <View style={styles.placeholder} />
        </View>

        {renderFilterTabs()}
        
        <View style={styles.countContainer}>
          <Text style={styles.countText}>총 {filteredComments.length}개</Text>
        </View>

        <FlatList
          data={filteredComments}
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 60,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  countText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  safeArea: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  commentCard: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  boardBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  typeBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e40af',
  },
  boardBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0f2fe',
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
  disabledLink: {
    color: '#9CA3AF',
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 20,
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
});
