import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// 기본 텍스트 처리 함수
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

// 파스텔 그린 색상 팔레트
const pastelGreenColors = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  likes: number;
  comments: number;
  views: number;
  timeAgo: string;
  isHot: boolean;
}

interface BoardInfo {
  name: string;
  description: string;
  icon: string;
}

// 커스텀 헤더 컴포넌트
function CustomHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

export default function BoardScreen() {
  const router = useRouter();
  const { type, boardCode } = useLocalSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // 새로고침 로직
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getBoardInfo = (boardCode: string): BoardInfo => {
    const boardMap: Record<string, BoardInfo> = {
      'free': { name: '자유게시판', description: '자유롭게 이야기해요', icon: '💬' },
      'study': { name: '공부', description: '학습 관련 정보를 공유해요', icon: '📚' },
      'career': { name: '진로', description: '진로와 취업 정보를 나눠요', icon: '🎯' },
      'club': { name: '동아리', description: '동아리 활동을 공유해요', icon: '🎭' },
      'food': { name: '맛집', description: '맛있는 곳을 추천해요', icon: '🍕' },
      'sports': { name: '스포츠', description: '운동과 스포츠 이야기', icon: '⚽' },
      'game': { name: '게임', description: '게임 이야기를 나눠요', icon: '🎮' },
      'music': { name: '음악', description: '음악을 공유하고 이야기해요', icon: '🎵' },
      'movie': { name: '영화/드라마', description: '영상 콘텐츠를 추천해요', icon: '🎬' },
      'fashion': { name: '패션/뷰티', description: '스타일과 뷰티 팁을 공유해요', icon: '👗' },
      'travel': { name: '여행', description: '여행 경험을 공유해요', icon: '✈️' },
      'life': { name: '일상', description: '소소한 일상을 공유해요', icon: '☕' },
    };
    return boardMap[boardCode as string] || { name: '게시판', description: '', icon: '📋' };
  };

  const getSamplePosts = (): Post[] => {
    return [
      {
        id: '1',
        title: '첫 번째 게시글입니다',
        content: '안녕하세요! 첫 번째 게시글을 작성해봅니다. 많은 관심과 댓글 부탁드려요.',
        author: '학생1',
        likes: 12,
        comments: 5,
        views: 134,
        timeAgo: '2시간 전',
        isHot: true,
      },
      {
        id: '2',
        title: '두 번째 게시글이에요',
        content: '두 번째 게시글입니다. 여러분의 의견을 듣고 싶어요.',
        author: '학생2',
        likes: 8,
        comments: 3,
        views: 89,
        timeAgo: '4시간 전',
        isHot: false,
      },
      {
        id: '3',
        title: '세 번째 게시글',
        content: '세 번째 게시글입니다. 좋은 하루 되세요!',
        author: '학생3',
        likes: 15,
        comments: 7,
        views: 201,
        timeAgo: '6시간 전',
        isHot: true,
      },
    ];
  };

  useEffect(() => {
    // 게시글 목록 로드
    setPosts(getSamplePosts());
  }, []);

  const handlePostPress = (post: Post) => {
    router.push(`/board/${type}/${boardCode}/${post.id}`);
  };

  const handleWritePress = () => {
    router.push(`/board/${type}/${boardCode}/write`);
  };

  const getTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      'national': '전국',
      'regional': '지역',
      'school': '학교',
    };
    return typeMap[type as string] || type;
  };

  const boardInfo = getBoardInfo(boardCode as string);

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader 
        title={`${boardInfo.name} - ${getTypeDisplayName(type as string)}`} 
        onBack={() => router.back()} 
      />
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 게시판 헤더 */}
        <View style={styles.header}>
          <View style={styles.boardIconContainer}>
            <Text style={styles.boardIcon}>{boardInfo.icon}</Text>
          </View>
          <View style={styles.boardInfoContainer}>
            <Text style={styles.boardName}>{boardInfo.name}</Text>
            <Text style={styles.boardDescription}>{boardInfo.description}</Text>
            <Text style={styles.boardType}>{getTypeDisplayName(type as string)} 커뮤니티</Text>
          </View>
        </View>

        {/* 글쓰기 버튼 */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.writeButton} onPress={handleWritePress}>
            <Text style={styles.writeButtonText}>✏️ 글쓰기</Text>
          </TouchableOpacity>
        </View>

        {/* 게시글 목록 */}
        <View style={styles.postList}>
          {posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 게시글이 없습니다.</Text>
              <Text style={styles.emptySubText}>첫 번째 글을 작성해보세요!</Text>
            </View>
          ) : (
            posts.map((post) => (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postCard}
                onPress={() => handlePostPress(post)}
              >
                <View style={styles.postHeader}>
                  {post.isHot && (
                    <View style={styles.hotBadge}>
                      <Text style={styles.hotBadgeText}>🔥 HOT</Text>
                    </View>
                  )}
                  <Text style={styles.postTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                </View>
                
                <Text style={styles.postContent} numberOfLines={2}>
                  {parseContentText(post.content)}
                </Text>
                
                <View style={styles.postMeta}>
                  <Text style={styles.postAuthor}>{post.author} | {post.timeAgo}</Text>
                  <Text style={styles.postViews}>조회 {post.views}</Text>
                </View>
                
                <View style={styles.postStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statText}>👍 {post.likes}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statText}>💬 {post.comments}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    width: 50,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  boardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  boardIcon: {
    fontSize: 24,
  },
  boardInfoContainer: {
    flex: 1,
  },
  boardName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  boardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  boardType: {
    fontSize: 12,
    color: '#9ca3af',
  },
  actions: {
    padding: 16,
    paddingBottom: 8,
  },
  writeButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  writeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  postList: {
    padding: 16,
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: {
    marginBottom: 8,
  },
  hotBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  hotBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: '#111827',
  },
  postContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  postAuthor: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postViews: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 50,
  },
}); 