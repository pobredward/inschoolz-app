import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Modal,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentSnapshot } from 'firebase/firestore';
import PostListItem from '../../components/PostListItem';
import { formatRelativeTime } from '../../utils/timeUtils';
import { getBoardsByType, getPostsWithPagination } from '@/lib/boards';
import { getUserById, getBlockedUserIds } from '@/lib/users';
import { getPopularSchools, getSchoolById, getPopularRegions, RegionInfo, getUserFavoriteSchools } from '@/lib/schools';
import { BlockedUserContent } from '../../components/ui/BlockedUserContent';
import { useAuthStore } from '../../store/authStore';
import { useScrollStore } from '../../store/scrollStore';
import { usePostCacheStore } from '../../store/postCacheStore';
import { Board, BoardType, Post, School } from '../../types';
import BoardSelector from '@/components/board/BoardSelector';
import SchoolSelector, { SchoolSelectorRef } from '@/components/board/SchoolSelector';
import RegionSetupModal from '../../components/RegionSetupModal';
import SchoolSetupModal from '../../components/SchoolSetupModal';
import FavoriteSchoolsManagementModal from '../../components/FavoriteSchoolsManagementModal';
import { useQuest } from '../../providers/QuestProvider';

const parseContentText = (content: string) => {
  if (!content) return '';
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
};

// 유틸리티 함수 추가
const truncateText = (text: string, maxLength: number = 100) => {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

interface CommunityPost extends Post {
  boardName: string;
  previewContent: string;
}

type SortOption = 'latest' | 'popular' | 'views' | 'comments';

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'views', label: '조회순' },
  { value: 'comments', label: '댓글순' }
];

const { width } = Dimensions.get('window');

export default function CommunityScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams();
  const { user } = useAuthStore();
  const { trackAction } = useQuest();
  const { saveScrollPosition, getScrollPosition } = useScrollStore();
  const [selectedTab, setSelectedTab] = useState<BoardType>('national');
  const [boards, setBoards] = useState<Board[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showSortSelector, setShowSortSelector] = useState(false); // 정렬 선택 모달 상태 추가
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false); // 카테고리 드롭다운 상태 추가
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [showRegionSetupModal, setShowRegionSetupModal] = useState(false);
  const [showSchoolSetupModal, setShowSchoolSetupModal] = useState(false);
  const [showFavoriteSchoolsModal, setShowFavoriteSchoolsModal] = useState(false);
  const [popularSchools, setPopularSchools] = useState<School[]>([]);
  const [popularSchoolsLoading, setPopularSchoolsLoading] = useState(false);
  const [favoriteSchools, setFavoriteSchools] = useState<School[]>([]);
  const [favoriteSchoolsLoading, setFavoriteSchoolsLoading] = useState(false);
  const [currentSchoolInfo, setCurrentSchoolInfo] = useState<School | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | undefined>(undefined);
  const [popularRegions, setPopularRegions] = useState<RegionInfo[]>([]);
  const [popularRegionsLoading, setPopularRegionsLoading] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<{ sido?: string; sigungu?: string }>({});
  
  // 무한 스크롤 상태
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // 스크롤 위치 관리를 위한 ref와 상태
  const scrollViewRef = useRef<FlatList>(null);
  const schoolSelectorRef = useRef<SchoolSelectorRef>(null);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const isLoadingRef = useRef(false); // 로딩 상태를 추적하는 ref
  
  // 스크롤 상태 관리 제거 - 이제 FlatList의 stickyHeaderIndices 사용
  
  // 스크롤 키 생성 (탭, 게시판, 정렬 기준으로 구분)
  const getScrollKey = useCallback(() => {
    return `community-${selectedTab}-${selectedBoard}-${sortBy}`;
  }, [selectedTab, selectedBoard, sortBy]);

  // 스크롤 위치 저장 (간단하게)
  const handleScroll = useCallback((event: {nativeEvent: {contentOffset: {y: number}}}) => {
    const { y } = event.nativeEvent.contentOffset;
    const scrollKey = getScrollKey();
    saveScrollPosition(scrollKey, y);
  }, [getScrollKey, saveScrollPosition]);
  
  // 스크롤 위치 복원 (FlatList에서는 scrollToOffset 사용)
  const restoreScrollPosition = useCallback(() => {
    if (!shouldRestoreScroll) return;
    
    const scrollKey = getScrollKey();
    const savedPosition = getScrollPosition(scrollKey);
    
    if (savedPosition > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToOffset({
          offset: savedPosition,
          animated: false,
        });
      }, 100);
      setShouldRestoreScroll(false);
    } else {
      setShouldRestoreScroll(false);
    }
  }, [shouldRestoreScroll, getScrollKey, getScrollPosition]);

  // 차단된 사용자 목록 로드 - useCallback으로 메모이제이션
  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const blockedIds = await getBlockedUserIds(user.uid);
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단된 사용자 목록 로드 실패:', error);
    }
  }, [user?.uid]);

  // 인기 학교 목록 로드
  const loadPopularSchools = useCallback(async () => {
    try {
      setPopularSchoolsLoading(true);
      const schools = await getPopularSchools(12); // 12개 학교 로드
      setPopularSchools(schools);
    } catch (error) {
      console.error('인기 학교 목록 로드 실패:', error);
    } finally {
      setPopularSchoolsLoading(false);
    }
  }, []);

  // 즐겨찾기 학교 목록 로드
  const loadFavoriteSchools = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setFavoriteSchoolsLoading(true);
      const schools = await getUserFavoriteSchools(user.uid);
      setFavoriteSchools(schools);
    } catch (error) {
      console.error('즐겨찾기 학교 로드 오류:', error);
    } finally {
      setFavoriteSchoolsLoading(false);
    }
  }, [user?.uid]);

  // 인기 지역 목록 로드
  const loadPopularRegions = useCallback(async () => {
    try {
      setPopularRegionsLoading(true);
      const regions = await getPopularRegions(12); // 12개 지역 로드
      setPopularRegions(regions);
    } catch (error) {
      console.error('인기 지역 목록 로드 실패:', error);
    } finally {
      setPopularRegionsLoading(false);
    }
  }, []);

  // 현재 학교 정보 로드
  const loadCurrentSchoolInfo = useCallback(async (schoolId: string) => {
    try {
      console.log('현재 학교 정보 로드:', schoolId);
      const school = await getSchoolById(schoolId);
      if (school) {
        setCurrentSchoolInfo(school);
        console.log('현재 학교 정보 로드 완료:', school.KOR_NAME);
      } else {
        console.log('학교 정보를 찾을 수 없음:', schoolId);
        setCurrentSchoolInfo(null);
      }
    } catch (error) {
      console.error('현재 학교 정보 로드 실패:', error);
      setCurrentSchoolInfo(null);
    }
  }, []);

  // URL 파라미터에서 탭 정보를 받아서 초기 탭 설정
  useEffect(() => {
    if (tab && typeof tab === 'string') {
      console.log('URL 파라미터에서 탭 정보 파싱:', tab);
      
      // 새로운 URL 구조 파싱: school/schoolId, regional/sido/sigungu
      if (tab.startsWith('school/')) {
        const schoolId = tab.split('/')[1];
        console.log('학교 탭 - schoolId:', schoolId);
        setSelectedTab('school');
        setCurrentSchoolId(schoolId);
      } else if (tab.startsWith('regional/')) {
        const parts = tab.split('/');
        if (parts.length >= 3) {
          const sido = decodeURIComponent(parts[1]);
          const sigungu = decodeURIComponent(parts[2]);
          console.log('지역 탭 - sido:', sido, 'sigungu:', sigungu);
          setSelectedTab('regional');
          setCurrentRegion({ sido, sigungu });
        }
      } else if (tab === 'regional') {
        // /community?tab=regional (지역 정보 없음) - 인기 지역 목록 표시
        console.log('지역 탭이지만 특정 지역 없음 - 인기 지역 목록 표시');
        setSelectedTab('regional');
        setCurrentRegion({});
      } else if (tab === 'school') {
        // /community?tab=school (학교 ID 없음) - 인기 학교 목록 표시
        console.log('학교 탭이지만 특정 학교 ID 없음 - 인기 학교 목록 표시');
        setSelectedTab('school');
        setCurrentSchoolId(undefined);
        setCurrentSchoolInfo(null);
      } else {
        // 기존 단순 탭 이름 (national 등)
        const validTabs: BoardType[] = ['national', 'regional', 'school'];
        if (validTabs.includes(tab as BoardType)) {
          setSelectedTab(tab as BoardType);
        }
      }
    }
  }, [tab]);

  // currentSchoolId 변경 시 학교 정보, 게시판, 게시글 로드
  useEffect(() => {
    if (currentSchoolId) {
      console.log('학교 변경 감지 - 데이터 로드 시작:', currentSchoolId);
      loadCurrentSchoolInfo(currentSchoolId);
      // 게시판과 게시글도 다시 로드
      loadBoards();
    } else {
      setCurrentSchoolInfo(null);
    }
  }, [currentSchoolId, loadCurrentSchoolInfo]);

  // currentRegion 변경 시 게시판, 게시글 로드
  useEffect(() => {
    if (currentRegion.sido && currentRegion.sigungu) {
      console.log('지역 변경 감지 - 데이터 로드 시작:', currentRegion);
      // 게시판과 게시글 다시 로드
      loadBoards();
    }
  }, [currentRegion.sido, currentRegion.sigungu]);

  // 학교 선택 UI에서 즐겨찾기 학교와 인기 학교 로드
  useEffect(() => {
    if (selectedTab === 'school' && !currentSchoolId) {
      console.log('학교 선택 UI - 데이터 로드 시작');
      
      // 즐겨찾기 학교 로드 (로그인한 경우)
      if (user?.uid && favoriteSchools.length === 0) {
        console.log('즐겨찾기 학교 로드');
        loadFavoriteSchools();
      }
      
      // 인기 학교 로드
      if (popularSchools.length === 0) {
        console.log('인기 학교 로드');
        loadPopularSchools();
      }
    }
  }, [selectedTab, currentSchoolId, user?.uid, favoriteSchools.length, popularSchools.length, loadFavoriteSchools, loadPopularSchools]);

  // 지역 탭에서 지역이 설정되지 않은 경우 인기 지역 로드
  useEffect(() => {
    if (selectedTab === 'regional' && !currentRegion.sido && !currentRegion.sigungu && popularRegions.length === 0) {
      console.log('인기 지역 목록 로드 조건 충족');
      loadPopularRegions();
    }
  }, [selectedTab, currentRegion, popularRegions.length, loadPopularRegions]);

  useEffect(() => {
    loadBoards();
    // 학교 탭으로 변경될 때 SchoolSelector 새로고침
    if (selectedTab === 'school' && schoolSelectorRef.current) {
      setTimeout(() => {
        schoolSelectorRef.current?.refresh();
      }, 100);
    }
  }, [selectedTab]);

  useEffect(() => {
    // boards가 로드되지 않았으면 대기 (단, currentSchoolId나 currentRegion이 설정된 경우는 제외)
    const hasSchoolOrRegion = (selectedTab === 'school' && currentSchoolId) || 
                              (selectedTab === 'regional' && currentRegion.sido && currentRegion.sigungu);
    
    if (boards.length === 0 && selectedTab !== 'national' && !hasSchoolOrRegion) {
      console.log('게시판 로드 대기 중...');
      return;
    }
    
    // 학교/지역이 선택되지 않은 경우 게시글 로드하지 않음
    if (selectedTab === 'school' && !currentSchoolId) {
      console.log('학교가 선택되지 않음 - 게시글 로드 생략');
      return;
    }
    if (selectedTab === 'regional' && (!currentRegion.sido || !currentRegion.sigungu)) {
      console.log('지역이 선택되지 않음 - 게시글 로드 생략');
      return;
    }
    
    console.log('게시글 로드 조건 충족 - loadPosts 호출');
    loadPosts();
  }, [selectedTab, selectedBoard, sortBy, currentSchoolId, currentRegion.sido, currentRegion.sigungu, boards.length]);

  // 사용자 정보 변경 시 차단된 사용자 목록 로드 - 무한 루프 방지 수정
  useEffect(() => {
    if (user?.uid) {
      loadBlockedUsers();
    }
  }, [user?.uid]); // loadBlockedUsers 의존성 제거로 무한 루프 방지

  // 게시글 로딩이 완료되고 레이아웃이 준비된 후 스크롤 위치 복원
  useEffect(() => {
    if (!isLoading && !refreshing && posts.length > 0 && isLayoutReady) {
      restoreScrollPosition();
    }
  }, [isLoading, refreshing, posts.length, isLayoutReady, restoreScrollPosition]);

  // 레이아웃이 준비되었을 때 호출되는 핸들러
  const handleLayout = useCallback(() => {
    setIsLayoutReady(true);
  }, []);

  // 화면이 포커스될 때마다 게시글 목록 및 차단 목록 새로고침
  useFocusEffect(
    useCallback(() => {
      // 차단 목록 새로고침
      if (user?.uid) {
        loadBlockedUsers();
      }
      
      // SchoolSelector 새로고침 (즐겨찾기 학교 추가 후 즉시 반영)
      if (selectedTab === 'school' && schoolSelectorRef.current) {
        schoolSelectorRef.current.refresh();
      }
      
      // 게시글 새로고침은 초기 마운트 시에만 (뒤로가기 제외)
      // posts.length를 의존성에서 제거하여 무한 루프 방지
      setShouldRestoreScroll(true);
    }, [user?.uid, selectedTab])
  );

  // 차단 해제 시 상태 업데이트
  const handleUnblock = useCallback((userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  }, []);

  const loadBoards = async () => {
    try {
      console.log('Loading boards for type:', selectedTab);
      const boardsData = await getBoardsByType(selectedTab);
      console.log('Loaded boards:', boardsData.length, boardsData);
      setBoards(boardsData);
      setSelectedBoard('all'); // 탭 변경 시 전체로 리셋
    } catch (error) {
      console.error('게시판 로드 실패:', error);
      Alert.alert('오류', '게시판 목록을 불러오는데 실패했습니다.');
    }
  };

  const loadPosts = async (isLoadMore = false) => {
    try {
      console.log('loadPosts 호출:', { isLoadMore, hasMore, postsCount: posts.length, isLoading, isLoadingMore, isLoadingRef: isLoadingRef.current });
      
      // ref를 사용하여 로딩 중인지 확인 (더 정확함)
      if (isLoadingRef.current) {
        console.log('이미 로딩 중 (ref 체크) - 중단');
        return;
      }
      
      // 이미 로딩 중이면 중단
      if (isLoadMore && isLoadingMore) {
        console.log('이미 로딩 중 - 중단');
        return;
      }
      
      if (!isLoadMore && isLoading) {
        console.log('이미 초기 로딩 중 - 중단');
        return;
      }
      
      // 더 로드하기인데 더 이상 없으면 중단
      if (isLoadMore && !hasMore) {
        console.log('더 이상 로드할 게시글 없음');
        return;
      }

      // 로딩 시작
      isLoadingRef.current = true;

      if (isLoadMore) {
        setIsLoadingMore(true);
        console.log('더 많은 게시글 로딩 시작...');
      } else {
        setIsLoading(true);
        console.log('초기 게시글 로딩 시작...');
        // 새로 로드할 때는 커서 초기화
        setLastDoc(null);
        setHasMore(true);
      }

      // 학교 ID 결정
      let schoolId: string | undefined = undefined;
      if (selectedTab === 'school') {
        if (currentSchoolId) {
          schoolId = currentSchoolId;
        } else if (tab && typeof tab === 'string' && tab.startsWith('school/')) {
          schoolId = tab.split('/')[1];
        } else {
          // 학교 선택 UI (currentSchoolId가 없고 tab도 school/xxx 형태가 아님)
          // 이 경우 게시글 로드하지 않음
          console.log('학교 선택 UI 상태, 게시글 로드 건너뛰기');
          isLoadingRef.current = false;
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      // 지역 정보 결정
      let regions: { sido: string; sigungu: string } | undefined = undefined;
      if (selectedTab === 'regional') {
        if (currentRegion.sido && currentRegion.sigungu) {
          regions = {
            sido: currentRegion.sido,
            sigungu: currentRegion.sigungu
          };
        } else {
          console.log('지역이 설정되지 않음, 게시글 로드 건너뛰기');
          isLoadingRef.current = false;
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      // 서버 사이드 정렬과 페이지네이션으로 게시글 가져오기
      const result = await getPostsWithPagination({
        type: selectedTab,
        boardCode: selectedBoard,
        pageSize: 30, // 30개씩 로드
        sortBy: sortBy,
        lastDoc: isLoadMore ? lastDoc : null,
        schoolId,
        regions
      });

      // Post를 CommunityPost 형태로 변환
      const communityPosts: CommunityPost[] = result.posts.map(post => ({
        ...post,
        boardName: post.boardName || boards.find(b => b.code === post.boardCode)?.name || '게시판',
        previewContent: truncateText(parseContentText(post.content), 100)
      }));

      console.log('로드 결과:', {
        새로운게시글: communityPosts.length,
        hasMore: result.hasMore,
        lastDoc: !!result.lastDoc
      });

      if (isLoadMore) {
        // 더 로드하기: 기존 목록에 추가
        setPosts(prev => {
          console.log('기존:', prev.length, '+ 새로운:', communityPosts.length, '= 총:', prev.length + communityPosts.length);
          return [...prev, ...communityPosts];
        });
      } else {
        // 새로 로드: 기존 목록 교체
        setPosts(communityPosts);
        console.log('게시글 초기화:', communityPosts.length, '개');
        
        // 퀘스트 트래킹: 커뮤니티 페이지 방문 (3단계, 9단계) - 초기 로드 시에만
        if (user?.uid && selectedTab === 'school' && schoolId) {
          try {
            // 3단계: 학교 커뮤니티 방문
            await trackAction('visit_board', { schoolId });
            console.log('✅ 퀘스트 트래킹: 학교 커뮤니티 방문 (3단계)');
            
            // 9단계: 다른 학교인지 확인
            const isOtherSchool = schoolId !== user.school?.id;
            if (isOtherSchool) {
              await trackAction('visit_other_board', { schoolId, isOtherSchool: true });
              console.log('✅ 퀘스트 트래킹: 다른 학교 커뮤니티 방문 (9단계)');
            }
          } catch (questError) {
            console.error('❌ 퀘스트 트래킹 오류:', questError);
          }
        }
      }

      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      console.log('hasMore 설정:', result.hasMore);

    } catch (error) {
      console.error('게시글 로드 실패:', error);
      if (!isLoadMore) {
        setPosts([]);
      }
    } finally {
      // 로딩 완료
      isLoadingRef.current = false;
      
      if (isLoadMore) {
        setIsLoadingMore(false);
        console.log('더 로드하기 완료');
      } else {
        setIsLoading(false);
        console.log('초기 로드 완료');
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBoards(), loadPosts()]);
    setRefreshing(false);
  };

  const { cachePost, cacheBoard } = usePostCacheStore();
  
  const handlePostPress = useCallback((post: CommunityPost) => {
    // 게시글 데이터를 캐시에 저장 (즉시 표시용)
    const boardData = boards.find(b => b.code === post.boardCode);
    cachePost(post.id, post, boardData);
    
    // onScroll에서 이미 스크롤 위치가 저장되므로 바로 이동
    router.push(`/board/${selectedTab}/${post.boardCode}/${post.id}` as any);
  }, [selectedTab, router, boards, cachePost]);

  const handleWritePress = () => {
    setShowBoardSelector(true);
  };

  // 탭 변경 핸들러
  const handleTabChange = async (newTab: BoardType) => {
    console.log('=== handleTabChange 시작 ===');
    console.log('새로운 탭:', newTab);
    console.log('현재 user 상태:', user);
    
    // 탭 변경 시에는 스크롤 복원하지 않음
    setShouldRestoreScroll(false);
    setIsLayoutReady(false);
    setSelectedTab(newTab);
    
    // 새로운 라우팅 구조로 리다이렉트
    if (newTab === 'school') {
      // 학교 탭으로 이동 - 항상 학교 선택 UI 먼저 표시
      console.log('학교 탭으로 이동 - 학교 선택 UI 표시');
      // 이전 학교 정보 초기화
      setCurrentSchoolId(undefined);
      setCurrentSchoolInfo(null);
      setPosts([]);
      setBoards([]);
      router.push('/(tabs)/community?tab=school');
      return;
    } else if (newTab === 'regional') {
      // 지역 탭으로 이동 - 항상 지역 선택 UI 먼저 표시
      console.log('지역 탭으로 이동 - 지역 선택 UI 표시');
      // 이전 지역 정보 초기화
      setCurrentRegion({});
      setPosts([]);
      setBoards([]);
      router.push('/(tabs)/community?tab=regional');
      return;
    } else {
      // 전국 탭은 바로 설정
      router.push(`/(tabs)/community?tab=${newTab}`);
    }
  };

  const renderTabs = useCallback(() => (
    <View style={styles.tabContainer}>
      {[
        { value: 'national', label: '전국' },
        { value: 'regional', label: '지역' },
        { value: 'school', label: '학교' }
      ].map((tab) => (
        <TouchableOpacity
          key={tab.value}
          style={[
            styles.tab,
            selectedTab === tab.value && styles.activeTab
          ]}
          onPress={() => handleTabChange(tab.value as BoardType)}
        >
          <Text style={[
            styles.tabText,
            selectedTab === tab.value && styles.activeTabText
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [selectedTab]);

  const renderCategoryFilter = () => (
    <View style={styles.categoryContainer}>
      {/* 가로 스크롤 카테고리와 화살표 버튼 */}
      <View style={styles.categoryRow}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedBoard === 'all' && styles.activeCategoryButton
            ]}
            onPress={() => {
              setSelectedBoard('all');
              setShouldRestoreScroll(false);
              setIsLayoutReady(false);
            }}
          >
            <Text style={[
              styles.categoryText,
              selectedBoard === 'all' && styles.activeCategoryText
            ]}>
              전체
            </Text>
          </TouchableOpacity>
          {boards.map((board) => (
            <TouchableOpacity
              key={board.code}
              style={[
                styles.categoryButton,
                selectedBoard === board.code && styles.activeCategoryButton
              ]}
              onPress={() => {
                setSelectedBoard(board.code);
                setShouldRestoreScroll(false);
                setIsLayoutReady(false);
              }}
            >
              <Text style={[
                styles.categoryText,
                selectedBoard === board.code && styles.activeCategoryText
              ]}>
                {board.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* 화살표 버튼 */}
        <TouchableOpacity
          style={styles.arrowButton}
          onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
        >
          <Ionicons 
            name={showCategoryDropdown ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#6B7280" 
          />
        </TouchableOpacity>
      </View>
      
      {/* 인라인 확장 카테고리 영역 */}
      {showCategoryDropdown && (
        <View style={styles.expandedCategoryContainer}>
          <View style={styles.expandedCategoryGrid}>
            <TouchableOpacity
              style={[
                styles.expandedCategoryButton,
                selectedBoard === 'all' && styles.activeExpandedCategoryButton
              ]}
              onPress={() => {
                setSelectedBoard('all');
                setShowCategoryDropdown(false);
                setShouldRestoreScroll(false);
                setIsLayoutReady(false);
              }}
            >
              <Text style={[
                styles.expandedCategoryText,
                selectedBoard === 'all' && styles.activeExpandedCategoryText
              ]}>
                전체
              </Text>
            </TouchableOpacity>
            {boards.map((board) => (
              <TouchableOpacity
                key={`expanded-${board.code}`}
                style={[
                  styles.expandedCategoryButton,
                  selectedBoard === board.code && styles.activeExpandedCategoryButton
                ]}
                onPress={() => {
                  setSelectedBoard(board.code);
                  setShowCategoryDropdown(false);
                  setShouldRestoreScroll(false);
                  setIsLayoutReady(false);
                }}
              >
                <Text style={[
                  styles.expandedCategoryText,
                  selectedBoard === board.code && styles.activeExpandedCategoryText
                ]}>
                  {board.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  // 정렬 선택 핸들러 추가
  const handleSortChange = (newSortBy: SortOption) => {
    setSortBy(newSortBy);
    setShowSortSelector(false);
    // 정렬 변경 시에는 스크롤 복원하지 않음
    setShouldRestoreScroll(false);
    setIsLayoutReady(false);
    // 정렬 변경 후 게시글 다시 로드 (이미 loadPosts의 useEffect에서 sortBy 변경 시 자동으로 실행됨)
  };

  const renderSortHeader = useCallback(() => (
    <View style={styles.sortContainer}>
      <TouchableOpacity 
        style={styles.sortButton}
        onPress={() => setShowSortSelector(true)}
      >
        <Text style={styles.sortText}>
          {SORT_OPTIONS.find(option => option.value === sortBy)?.label}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>
    </View>
  ), [sortBy]);

  // 정렬 선택 모달 렌더링 함수 추가
  const renderSortModal = () => (
    <Modal
      visible={showSortSelector}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSortSelector(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSortSelector(false)}
      >
        <View style={styles.sortModal}>
          <View style={styles.sortModalHeader}>
            <Text style={styles.sortModalTitle}>정렬 방식</Text>
            <TouchableOpacity onPress={() => setShowSortSelector(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.activeSortOption
              ]}
                             onPress={() => handleSortChange(option.value as SortOption)}
            >
              <Text style={[
                styles.sortOptionText,
                sortBy === option.value && styles.activeSortOptionText
              ]}>
                {option.label}
              </Text>
              {sortBy === option.value && (
                <Ionicons name="checkmark" size={20} color="#10B981" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderPostCard = useCallback(({ item: post }: { item: CommunityPost }) => {
    const getTabName = () => {
      switch (selectedTab) {
        case 'national': return '전국';
        case 'regional': return '지역';
        case 'school': return '학교';
        default: return '전국';
      }
    };

    // 차단된 사용자인지 확인
    const isBlocked = post.authorId && blockedUserIds.has(post.authorId);
    
    if (isBlocked && post.authorId) {
      return (
        <BlockedUserContent
          blockedUserId={post.authorId}
          blockedUserName={post.authorInfo?.displayName || '사용자'}
          contentType="post"
          onUnblock={() => handleUnblock(post.authorId!)}
        >
          <PostListItem
            post={post}
            onPress={(p) => handlePostPress(p as CommunityPost)}
            typeBadgeText={getTabName()}
            boardBadgeText={post.boardName}
            variant="community"
          />
        </BlockedUserContent>
      );
    }

    return (
      <PostListItem
        post={post}
        onPress={(p) => handlePostPress(p as CommunityPost)}
        typeBadgeText={getTabName()}
        boardBadgeText={post.boardName}
        variant="community"
      />
    );
  }, [selectedTab, blockedUserIds, handleUnblock, handlePostPress]);

  const renderEmptyState = () => {
    // 지역 탭에서 지역이 설정되지 않은 경우 인기 지역 목록 표시
    if (selectedTab === 'regional' && !currentRegion.sido && !currentRegion.sigungu) {
      return (
        <View style={styles.popularSchoolsContainer}>
          {/* 지역 선택 헤더 */}
          <View style={styles.popularSchoolsHeader}>
            <Text style={styles.popularSchoolsIcon}>🏘️</Text>
            <Text style={styles.popularSchoolsTitle}>지역 선택</Text>
          </View>

          {/* 로그인한 사용자의 본인 지역 바로가기 버튼 */}
          {user?.regions?.sido && user?.regions?.sigungu && (
            <TouchableOpacity
              style={styles.myRegionButton}
              onPress={() => {
                router.push(`/(tabs)/community?tab=regional/${encodeURIComponent(user.regions!.sido)}/${encodeURIComponent(user.regions!.sigungu)}`);
              }}
            >
              <View style={styles.myRegionContent}>
                <View style={styles.myRegionIconContainer}>
                  <Text style={styles.myRegionIcon}>📍</Text>
                </View>
                <View style={styles.myRegionInfo}>
                  <Text style={styles.myRegionLabel}>내 지역 커뮤니티</Text>
                  <Text style={styles.myRegionName}>{user.regions.sigungu}, {user.regions.sido}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#10B981" />
            </TouchableOpacity>
          )}
          
          {/* 인기 지역 */}
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>인기 지역</Text>
            {user && (
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() => setShowRegionSetupModal(true)}
              >
                <Text style={styles.manageButtonText}>📍 내 지역 관리</Text>
              </TouchableOpacity>
            )}
          </View>
          {popularRegionsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>인기 지역을 불러오는 중...</Text>
            </View>
          ) : popularRegions.length > 0 ? (
            <View style={styles.popularSchoolsGrid}>
              {popularRegions.map((region) => (
                <TouchableOpacity
                  key={`${region.sido}-${region.sigungu}`}
                  style={styles.popularSchoolCard}
                  onPress={() => {
                    router.push(`/(tabs)/community?tab=regional/${encodeURIComponent(region.sido)}/${encodeURIComponent(region.sigungu)}`);
                  }}
                >
                  <View style={styles.schoolCardHeader}>
                    <View style={styles.schoolIconContainer}>
                      <Text style={styles.schoolIcon}>🏘️</Text>
                    </View>
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName} numberOfLines={2}>
                        {region.sigungu}
                      </Text>
                      <Text style={styles.schoolDistrict}>{region.sido}</Text>
                    </View>
                  </View>
                  <View style={styles.schoolStats}>
                    <Text style={styles.schoolStat}>게시글 {region.postCount}개</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏘️</Text>
              <Text style={styles.emptyTitle}>인기 지역 목록을 불러올 수 없습니다.</Text>
            </View>
          )}
          
          {!user && (
            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>더 많은 기능을 이용하려면 로그인하세요</Text>
              <View style={styles.loginPromptButtons}>
                <TouchableOpacity 
                  style={styles.loginPromptButton}
                  onPress={() => router.push('/login')}
                >
                  <Text style={styles.loginPromptButtonText}>로그인하기</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.loginPromptButton, styles.loginPromptButtonSecondary]}
                  onPress={() => handleTabChange('national')}
                >
                  <Text style={[styles.loginPromptButtonText, styles.loginPromptButtonSecondaryText]}>
                    전국 커뮤니티 보기
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    }

    // 학교 탭에서 학교 선택 UI 표시 (특정 학교가 선택되지 않은 경우)
    if (selectedTab === 'school' && !currentSchoolId) {
      const mainSchool = favoriteSchools.find(school => school.id === user?.school?.id);
      const otherFavoriteSchools = favoriteSchools.filter(school => school.id !== user?.school?.id);
      
      return (
        <View style={styles.popularSchoolsContainer}>
          <View style={styles.popularSchoolsHeader}>
            <Text style={styles.popularSchoolsIcon}>🏫</Text>
            <Text style={styles.popularSchoolsTitle}>학교 선택</Text>
          </View>
          
          {/* 메인 학교 */}
          {mainSchool && (
            <>
              {/* <Text style={styles.sectionTitle}>내 학교</Text> */}
              <TouchableOpacity
                style={styles.mySchoolButton}
                onPress={() => {
                  router.push(`/(tabs)/community?tab=school/${mainSchool.id}`);
                }}
              >
                <View style={styles.myRegionContent}>
                  <View style={styles.mySchoolIconContainer}>
                    <Text style={styles.myRegionIcon}>🏫</Text>
                  </View>
                  <View style={styles.myRegionInfo}>
                    <Text style={styles.mySchoolLabel}>메인 학교</Text>
                    <Text style={styles.myRegionName}>{mainSchool.KOR_NAME}</Text>
                    <Text style={styles.schoolDistrict}>{mainSchool.REGION}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
              </TouchableOpacity>
            </>
          )}
          
          {/* 즐겨찾기 학교 */}
          {user && (
            <>
              <Text style={styles.sectionTitle}>즐겨찾기 학교</Text>
              {favoriteSchoolsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.loadingText}>즐겨찾기 학교를 불러오는 중...</Text>
                </View>
              ) : otherFavoriteSchools.length > 0 ? (
                <View style={styles.popularSchoolsGrid}>
                  {otherFavoriteSchools.map((school) => (
                    <TouchableOpacity
                      key={school.id}
                      style={styles.popularSchoolCard}
                      onPress={() => {
                        router.push(`/(tabs)/community?tab=school/${school.id}`);
                      }}
                    >
                      <View style={styles.schoolCardHeader}>
                        <View style={styles.schoolIconContainer}>
                          <Text style={styles.schoolIcon}>⭐</Text>
                        </View>
                        <View style={styles.schoolInfo}>
                          <Text style={styles.schoolName} numberOfLines={2}>
                            {school.KOR_NAME}
                          </Text>
                          <Text style={styles.schoolDistrict}>{school.REGION}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyFavoriteSection}>
                  <Text style={styles.emptyFavoriteText}>
                    아직 즐겨찾기 학교가 없습니다
                  </Text>
                  <Text style={styles.emptyFavoriteSubtext}>
                    마이페이지에서 학교를 추가해보세요
                  </Text>
                </View>
              )}
            </>
          )}
          
          {/* 인기 학교 */}
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>인기 학교</Text>
            {user && (
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() => setShowFavoriteSchoolsModal(true)}
              >
                <Text style={styles.manageButtonText}>🏫 즐겨찾기 학교 관리</Text>
              </TouchableOpacity>
            )}
          </View>
          {popularSchoolsLoading || favoriteSchoolsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>인기 학교를 불러오는 중...</Text>
            </View>
          ) : popularSchools.length > 0 ? (
            <View style={styles.popularSchoolsGrid}>
              {popularSchools.map((school) => (
                <TouchableOpacity
                  key={school.id}
                  style={styles.popularSchoolCard}
                  onPress={() => {
                    router.push(`/(tabs)/community?tab=school/${school.id}`);
                  }}
                >
                  <View style={styles.schoolCardHeader}>
                    <View style={styles.schoolIconContainer}>
                      <Text style={styles.schoolIcon}>🏫</Text>
                    </View>
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName} numberOfLines={2}>
                        {school.KOR_NAME}
                      </Text>
                      <Text style={styles.schoolDistrict}>{school.REGION}</Text>
                    </View>
                  </View>
                  <View style={styles.schoolStats}>
                    <Text style={styles.schoolStat}>멤버 {school.memberCount || 0}명</Text>
                    <Text style={styles.schoolStat}>즐겨찾기 {school.favoriteCount || 0}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏫</Text>
              <Text style={styles.emptyTitle}>인기 학교 목록을 불러올 수 없습니다.</Text>
            </View>
          )}
          
          {!user && (
            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>더 많은 기능을 이용하려면 로그인하세요</Text>
              <View style={styles.loginPromptButtons}>
                <TouchableOpacity 
                  style={styles.loginPromptButton}
                  onPress={() => router.push('/login')}
                >
                  <Text style={styles.loginPromptButtonText}>로그인하기</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.loginPromptButton, styles.loginPromptButtonSecondary]}
                  onPress={() => handleTabChange('national')}
                >
                  <Text style={[styles.loginPromptButtonText, styles.loginPromptButtonSecondaryText]}>
                    전국 커뮤니티 보기
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    }

    // 기본 빈 상태
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyTitle}>게시글이 없습니다.</Text>
        <Text style={styles.emptySubtitle}>첫 번째 게시글을 작성해보세요!</Text>
      </View>
    );
  };

  // 로그인이 필요한 탭에서 로그인 안내 화면
  const renderLoginRequired = () => (
    <View style={styles.loginRequiredContainer}>
      <Text style={styles.loginRequiredIcon}>🔒</Text>
      <Text style={styles.loginRequiredTitle}>로그인이 필요합니다</Text>
      <Text style={styles.loginRequiredSubtitle}>
        지역 게시판을 보려면 로그인해주세요.
      </Text>
      <TouchableOpacity 
        style={styles.loginButton}
        onPress={() => router.push('/login')}
      >
        <Text style={styles.loginButtonText}>로그인하기</Text>
      </TouchableOpacity>
    </View>
  );

  // 로그인이 필요한 탭인지 확인 - 제거됨 (이제 지역 탭도 로그인 없이 인기 지역 목록 볼 수 있음)
  // const isLoginRequired = selectedTab === 'regional' && !user;

  // ListHeaderComponent: 탭 아래 collapsible 컨텐츠
  const renderListHeader = useCallback(() => {
    return (
      <View style={styles.listHeaderContainer}>
        {selectedTab === 'school' && currentSchoolId && currentSchoolInfo && (
          // 특정 학교를 보고 있는 경우: 학교 정보와 뒤로가기 버튼 표시
          <View style={styles.guestSchoolInfo}>
            <View style={styles.guestSchoolContent}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  // 학교 선택 UI로 돌아가기
                  setCurrentSchoolId(undefined);
                  setCurrentSchoolInfo(null);
                  setPosts([]);
                  setBoards([]);
                  router.push('/(tabs)/community?tab=school');
                }}
              >
                <Ionicons name="chevron-back" size={20} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.guestSchoolIcon}>🏫</Text>
              <View style={styles.guestSchoolText}>
                <Text style={styles.guestSchoolName}>{currentSchoolInfo.KOR_NAME}</Text>
                <Text style={styles.guestSchoolSubtext}>
                  {currentSchoolInfo.REGION}
                  {!user && ' • 게스트로 방문 중'}
                  {user && user.school?.id === currentSchoolId && ' • 내 학교'}
                  {user && user.school?.id !== currentSchoolId && ' • 다른 학교 방문 중'}
                </Text>
              </View>
            </View>
            {!user && (
              <TouchableOpacity 
                style={styles.guestLoginButton}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.guestLoginButtonText}>로그인</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {selectedTab === 'regional' && currentRegion.sido && currentRegion.sigungu && (
          // 지역 커뮤니티: 현재 지역 정보 표시
          <View style={styles.guestSchoolInfo}>
            <View style={styles.guestSchoolContent}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  // 인기 지역 목록으로 돌아가기
                  setCurrentRegion({});
                  router.push('/(tabs)/community?tab=regional');
                }}
              >
                <Ionicons name="chevron-back" size={20} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.guestSchoolIcon}>🏘️</Text>
              <View style={styles.guestSchoolText}>
                <Text style={styles.guestSchoolName}>{currentRegion.sigungu}</Text>
                <Text style={styles.guestSchoolSubtext}>
                  {currentRegion.sido}
                  {!user && ' • 게스트로 방문 중'}
                  {user && user.regions?.sido === currentRegion.sido && user.regions?.sigungu === currentRegion.sigungu && ' • 내 지역'}
                  {user && (user.regions?.sido !== currentRegion.sido || user.regions?.sigungu !== currentRegion.sigungu) && ' • 다른 지역 방문 중'}
                </Text>
              </View>
            </View>
            {!user && (
              <TouchableOpacity 
                style={styles.guestLoginButton}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.guestLoginButtonText}>로그인</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* 카테고리 필터와 정렬 헤더는 학교 선택 UI/인기 지역 목록이 아닐 때만 표시 */}
        {!(selectedTab === 'school' && !currentSchoolId) && 
         !(selectedTab === 'regional' && !currentRegion.sido && !currentRegion.sigungu) && (
          <>
            {renderCategoryFilter()}
            {renderSortHeader()}
          </>
        )}
      </View>
    );
  }, [selectedTab, user, currentSchoolId, currentSchoolInfo, currentRegion, renderCategoryFilter, renderSortHeader]);

  return (
    <View style={styles.container}>
      {/* Sticky Tab Header: 항상 최상단 고정 */}
      <View style={styles.stickyTabHeader}>
        {renderTabs()}
      </View>

      {/* 게시글 목록 - FlatList로 변경하여 성능 개선 */}
      {isLoading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (selectedTab === 'school' && !user && !currentSchoolId) ? (
        // 인기 학교 목록 표시
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#10B981']}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {renderListHeader()}
          {renderEmptyState()}
        </ScrollView>
      ) : (selectedTab === 'regional' && !currentRegion.sido && !currentRegion.sigungu) ? (
        // 인기 지역 목록 표시
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#10B981']}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {renderListHeader()}
          {renderEmptyState()}
        </ScrollView>
      ) : (
            <FlatList
              ref={scrollViewRef}
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderPostCard}
              // 헤더를 FlatList 안에 넣어서 자연스럽게 스크롤
              ListHeaderComponent={renderListHeader}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#10B981']}
                />
              }
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onLayout={handleLayout}
              contentContainerStyle={styles.flatListContent}
              ListEmptyComponent={!isLoading ? renderEmptyState : null}
              showsVerticalScrollIndicator={false}
              // 무한 스크롤
              onEndReached={() => {
                console.log('onEndReached 트리거:', { isLoading, isLoadingMore, hasMore, postsCount: posts.length });
                // 초기 로딩 중이거나, 이미 로딩 중이거나, 더 이상 없거나, 게시글이 없으면 중단
                if (isLoading || isLoadingMore || !hasMore || posts.length === 0) {
                  console.log('로드 안 함:', { isLoading, isLoadingMore, hasMore, postsLength: posts.length });
                  return;
                }
                console.log('다음 페이지 로드 시작!');
                loadPosts(true);
              }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={() => {
                if (isLoadingMore) {
                  return (
                    <View style={styles.loadingMoreContainer}>
                      <ActivityIndicator size="small" color="#10B981" />
                      <Text style={styles.loadingMoreText}>게시글 로딩 중...</Text>
                    </View>
                  );
                }
                if (!hasMore && posts.length > 0) {
                  return (
                    <View style={styles.endOfListContainer}>
                      <Text style={styles.endOfListText}>모든 게시글을 불러왔습니다</Text>
                    </View>
                  );
                }
                return null;
              }}
              // 성능 최적화 옵션
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
            />
      )}

      {/* 게시판 선택 모달 */}
      <BoardSelector
        isVisible={showBoardSelector}
        onClose={() => setShowBoardSelector(false)}
        type={selectedTab}
      />

      {/* 정렬 선택 모달 */}
      {renderSortModal()}

      {/* 글쓰기 버튼 - SafeScreenContainer 외부에 배치하여 고정 */}
      {/* 학교 선택 UI나 인기 지역 UI에서는 숨김 */}
      {/* 학교 탭에서는 메인 학교일 때만 표시 */}
      {user && 
       !(selectedTab === 'school' && !currentSchoolId) && 
       !(selectedTab === 'regional' && !currentRegion.sido && !currentRegion.sigungu) && 
       !(selectedTab === 'school' && currentSchoolId && currentSchoolId !== user?.school?.id) && (
        <TouchableOpacity style={styles.writeButton} onPress={handleWritePress}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* 지역 설정 모달 */}
      <RegionSetupModal
        visible={showRegionSetupModal}
        onClose={() => setShowRegionSetupModal(false)}
        onComplete={async () => {
          try {
            setShowRegionSetupModal(false);
            
            // 최신 사용자 정보를 다시 가져와서 라우팅
            const latestUser = await getUserById(user!.uid);
            if (latestUser?.regions?.sido && latestUser?.regions?.sigungu) {
              router.push(`/(tabs)/community?tab=regional/${encodeURIComponent(latestUser.regions.sido)}/${encodeURIComponent(latestUser.regions.sigungu)}`);
              
              // 강제로 게시글 새로고침
              setTimeout(async () => {
                console.log('지역 설정 완료 후 게시글 새로고침 시작');
                await loadBoards();
                await loadPosts();
                console.log('지역 설정 완료 후 게시글 새로고침 완료');
              }, 500);
            }
          } catch (error) {
            console.error('지역 설정 완료 후 라우팅 실패:', error);
          }
        }}
      />

      {/* 학교 설정 모달 */}
      <SchoolSetupModal
        visible={showSchoolSetupModal}
        onClose={() => setShowSchoolSetupModal(false)}
        onComplete={async () => {
          try {
            setShowSchoolSetupModal(false);
            
            // 최신 사용자 정보를 다시 가져와서 라우팅
            const latestUser = await getUserById(user!.uid);
            if (latestUser?.school?.id) {
              router.push(`/(tabs)/community?tab=school/${latestUser.school.id}`);
              
              // 강제로 게시글 새로고침
              setTimeout(async () => {
                console.log('학교 설정 완료 후 게시글 새로고침 시작');
                await loadBoards();
                await loadPosts();
                console.log('학교 설정 완료 후 게시글 새로고침 완료');
              }, 500);
            }
          } catch (error) {
            console.error('학교 설정 완료 후 라우팅 실패:', error);
          }
        }}
      />

      {/* 즐겨찾기 학교 관리 모달 */}
      <FavoriteSchoolsManagementModal
        visible={showFavoriteSchoolsModal}
        onClose={() => setShowFavoriteSchoolsModal(false)}
        onUpdate={async () => {
          // 즐겨찾기 학교 업데이트 후 인기 학교 목록 새로고침
          await loadPopularSchools();
          await loadFavoriteSchools();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  stickyTabHeader: {
    backgroundColor: 'white',
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listHeaderContainer: {
    backgroundColor: 'white',
  },
  contentContainer: {
    paddingBottom: 100, // 글쓰기 버튼과의 간격을 위한 여백
  },
  postsContainer: {
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  flatListContent: {
    paddingHorizontal: 6,
    paddingBottom: 140, // 글쓰기 버튼과의 간격을 위한 여백
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#10B981',
  },
  tabText: {
    fontSize: 16,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#10B981',
    fontWeight: '600',
  },
  categoryContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  categoryScroll: {
    flex: 1,
    marginRight: 8,
  },
  categoryScrollContent: {
    paddingRight: 16,
  },
  arrowButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  expandedCategoryContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 12,
    maxHeight: 300,
  },
  expandedCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  expandedCategoryButton: {
    width: '48%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  activeExpandedCategoryButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  expandedCategoryText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  activeExpandedCategoryText: {
    color: 'white',
    fontWeight: '500',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
  },
  activeCategoryButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  categoryText: {
    fontSize: 14,
    color: '#374151',
  },
  activeCategoryText: {
    color: 'white',
    fontWeight: '500',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  sortText: {
    fontSize: 14,
    color: '#374151',
    marginRight: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  postCard: {
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
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  boardBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  boardBadgeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  postBadgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  postTypeBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803d',
    backgroundColor: '#f0fdf4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  postBoardBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  imageBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#c2410c',
    backgroundColor: '#fff7ed',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  imageBadgeText: {
    fontSize: 10,
  },
  postMainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  postTextContent: {
    flex: 1,
    minWidth: 0,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 22,
  },
  postPreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  postImagePreview: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  previewImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  postStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyFavoriteSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 16,
  },
  emptyFavoriteText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  emptyFavoriteSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  writeButton: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  schoolSelector: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  loginRequiredWrapper: {
    paddingBottom: 100, // 글쓰기 버튼과의 간격을 위한 여백
  },
  loginRequiredContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginRequiredIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  loginRequiredTitle: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 4,
  },
  loginRequiredSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loginButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // 정렬 모달 스타일 추가
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: width * 0.8,
    maxWidth: 300,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activeSortOption: {
    backgroundColor: '#F0FDF4',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  activeSortOptionText: {
    color: '#10B981',
    fontWeight: '500',
  },

  // 인기 학교 목록 스타일
  popularSchoolsContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  popularSchoolsHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  
  // 내 지역 버튼 스타일
  myRegionButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  myRegionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  myRegionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  myRegionIcon: {
    fontSize: 24,
  },
  myRegionInfo: {
    flex: 1,
  },
  myRegionLabel: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 2,
  },
  myRegionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  
  // 내 학교 버튼 스타일
  mySchoolButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mySchoolIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mySchoolLabel: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
    marginBottom: 2,
  },
  popularSchoolsIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  popularSchoolsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
  },
  popularSchoolsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  manageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  manageButtonText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  popularSchoolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  popularSchoolCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  schoolCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  schoolIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  schoolIcon: {
    fontSize: 16,
  },
  schoolInfo: {
    flex: 1,
    minWidth: 0,
  },
  schoolName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  schoolDistrict: {
    fontSize: 11,
    color: '#6B7280',
  },
  schoolStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  schoolStat: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  loginPrompt: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  loginPromptText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  loginPromptButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  loginPromptButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  loginPromptButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  loginPromptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loginPromptButtonSecondaryText: {
    color: '#10B981',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },

  // 게스트 학교 정보 스타일
  guestSchoolInfo: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestSchoolContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  guestSchoolIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  guestSchoolText: {
    flex: 1,
  },
  guestSchoolName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  guestSchoolSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  guestLoginButton: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  guestLoginButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  // 무한 스크롤 스타일
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  endOfListContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 14,
    color: '#9CA3AF',
  },

}); 