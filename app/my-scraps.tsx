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
import { getScrappedPosts } from '../lib/boards';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../utils/timeUtils';
import PostListItem from '../components/PostListItem';
import { Post } from '../types';

export default function MyScrapsScreen() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadScrappedPosts = async () => {
    if (!user?.uid) return;

    try {
                      const scrappedPosts = await getScrappedPosts(user.uid);
        setPosts(scrappedPosts);
          } catch (error) {
        console.error('스크랩 글 로드 오류:', error);
        Alert.alert('오류', '스크랩한 글을 불러오는데 실패했습니다.');
      } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScrappedPosts();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadScrappedPosts();
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
      default: return post.boardCode || '게시판';
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
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