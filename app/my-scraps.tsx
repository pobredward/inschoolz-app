import React, { useState, useEffect, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getScrappedPosts } from '../lib/boards';
import { getBlockedUserIds } from '../lib/users';
import { BlockedUserContent } from '../components/ui/BlockedUserContent';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../utils/timeUtils';
import { Post } from '../types';
import PostListItem from '../components/PostListItem';

type ScrapType = 'all' | 'national' | 'regional' | 'school';

export default function MyScrapsScreen() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<ScrapType>('all');

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

  const filterPosts = (posts: Post[], type: ScrapType) => {
    if (type === 'all') {
      setFilteredPosts(posts);
    } else {
      const filtered = posts.filter(post => post.type === type);
      setFilteredPosts(filtered);
    }
  };

  const loadPosts = async () => {
    if (!user?.uid) return;

    try {
      const scrappedPosts = await getScrappedPosts(user.uid);
      setPosts(scrappedPosts);
      filterPosts(scrappedPosts, selectedType);
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

  useEffect(() => {
    filterPosts(posts, selectedType);
  }, [selectedType, posts]);

  // 사용자 정보 변경 시 차단된 사용자 목록 로드
  useEffect(() => {
    if (user?.uid) {
      loadBlockedUsers();
    }
  }, [user?.uid]);

  const handleTypeChange = (type: ScrapType) => {
    setSelectedType(type);
  };

  const getTypeLabel = (type: ScrapType) => {
    switch (type) {
      case 'all': return '전체';
      case 'national': return '전국';
      case 'regional': return '지역';
      case 'school': return '학교';
      default: return '전체';
    }
  };

  const renderFilterTabs = () => {
    const types: ScrapType[] = ['all', 'national', 'regional', 'school'];
    
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

  // 화면이 포커스될 때마다 차단 목록 새로고침
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadBlockedUsers();
      }
    }, [user?.uid])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = (post: Post) => {
    // 앱의 라우트 구조에 맞게 수정: /board/[type]/[boardCode]/[postId]
    // 모든 게시글을 national 타입으로 통일하여 라우팅 (게시글 ID로 직접 조회하므로 타입 무관)
    if (post.boardCode) {
      let route = `/board/national/${post.boardCode}/${post.id}`;
      
      console.log('원본 스크랩 게시글 정보:', { type: post.type, boardCode: post.boardCode, schoolId: post.schoolId, regions: post.regions });
      console.log('통일된 라우트로 변경:', route);
      
      router.push(route as any);
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
      <Text style={styles.emptyTitle}>
        {selectedType === 'all' ? '스크랩한 글이 없습니다' : `${getTypeLabel(selectedType)} 스크랩이 없습니다`}
      </Text>
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

        {renderFilterTabs()}

        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            총 {filteredPosts.length}개 {selectedType !== 'all' && `(${getTypeLabel(selectedType)})`}
          </Text>
        </View>

        <FlatList
          data={filteredPosts}
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
  countContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  countText: {
    fontSize: 14,
    color: '#6B7280',
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