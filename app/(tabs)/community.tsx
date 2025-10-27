import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PostListItem from '../../components/PostListItem';
// 광고 제거: 리워디드 광고만 사용
import { Timestamp } from 'firebase/firestore';
// 유틸리티 함수 import
import { formatRelativeTime, getPostPreviewImages, toTimestamp } from '../../utils/timeUtils';

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

// timeUtils에서 가져온 함수를 사용하므로 여기서는 중복 정의 제거
import { getBoardsByType, getPostsByBoardType, getAllPostsByType, getAllPostsBySchool, getAllPostsByRegion } from '@/lib/boards';
import { getUserById, getBlockedUserIds } from '@/lib/users';
import { getPopularSchools, getSchoolById } from '@/lib/schools';
import { BlockedUserContent } from '../../components/ui/BlockedUserContent';
import { useAuthStore } from '../../store/authStore';
import { useScrollStore } from '../../store/scrollStore';
import { Board, BoardType, Post, School } from '../../types';
import BoardSelector from '@/components/board/BoardSelector';
import SchoolSelector, { SchoolSelectorRef } from '@/components/board/SchoolSelector';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';
import RegionSetupModal from '../../components/RegionSetupModal';
import SchoolSetupModal from '../../components/SchoolSetupModal';

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
  const [popularSchools, setPopularSchools] = useState<School[]>([]);
  const [popularSchoolsLoading, setPopularSchoolsLoading] = useState(false);
  const [currentSchoolInfo, setCurrentSchoolInfo] = useState<School | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | undefined>(undefined);
  
  // 스크롤 위치 관리를 위한 ref와 상태
  const scrollViewRef = useRef<ScrollView>(null);
  const schoolSelectorRef = useRef<SchoolSelectorRef>(null);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  
  // 스크롤 키 생성 (탭, 게시판, 정렬 기준으로 구분)
  const getScrollKey = () => {
    return `community-${selectedTab}-${selectedBoard}-${sortBy}`;
  };
  
  // 스크롤 위치 저장
  const handleScroll = useCallback((event: any) => {
    const { y } = event.nativeEvent.contentOffset;
    const scrollKey = getScrollKey();
    saveScrollPosition(scrollKey, y);
  }, [selectedTab, selectedBoard, sortBy, saveScrollPosition]);
  
  // 스크롤 위치 복원
  const restoreScrollPosition = useCallback(() => {
    if (!shouldRestoreScroll) return;
    
    const scrollKey = getScrollKey();
    const savedPosition = getScrollPosition(scrollKey);
    
    if (savedPosition > 0 && scrollViewRef.current) {
      setIsRestoringScroll(true);
      
      // 약간의 지연을 두고 스크롤 위치 복원
      // 여러 번 시도하여 안정성 향상
      let attempts = 0;
      const maxAttempts = 5;
      
      const tryRestore = () => {
        attempts++;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: savedPosition,
            animated: false,
          });
          
          // 복원이 제대로 되었는지 확인
          if (attempts < maxAttempts) {
            setTimeout(() => {
              if (scrollViewRef.current) {
                scrollViewRef.current.scrollTo({
                  y: savedPosition,
                  animated: false,
                });
              }
            }, 50 * attempts);
          } else {
            // 복원 완료
            setTimeout(() => {
              setIsRestoringScroll(false);
            }, 100);
          }
        }
      };
      
      setTimeout(tryRestore, 100);
      setShouldRestoreScroll(false);
    } else {
      setShouldRestoreScroll(false);
      setIsRestoringScroll(false);
    }
  }, [shouldRestoreScroll, selectedTab, selectedBoard, sortBy, getScrollPosition]);

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
        const sido = decodeURIComponent(parts[1]);
        const sigungu = decodeURIComponent(parts[2]);
        console.log('지역 탭 - sido:', sido, 'sigungu:', sigungu);
        setSelectedTab('regional');
      } else if (tab === 'school') {
        // /community?tab=school (학교 ID 없음) - 인기 학교 목록 표시
        console.log('학교 탭이지만 특정 학교 ID 없음 - 인기 학교 목록 표시');
        setSelectedTab('school');
        setCurrentSchoolId(undefined);
      } else {
        // 기존 단순 탭 이름 (national 등)
        const validTabs: BoardType[] = ['national', 'regional', 'school'];
        if (validTabs.includes(tab as BoardType)) {
          setSelectedTab(tab as BoardType);
        }
      }
    }
  }, [tab]);

  // currentSchoolId 변경 시 학교 정보 로드
  useEffect(() => {
    if (currentSchoolId) {
      loadCurrentSchoolInfo(currentSchoolId);
    } else {
      setCurrentSchoolInfo(null);
    }
  }, [currentSchoolId, loadCurrentSchoolInfo]);

  // 학교 탭에서 로그인하지 않은 사용자를 위한 인기 학교 로드
  useEffect(() => {
    if (selectedTab === 'school' && !user && !currentSchoolId && popularSchools.length === 0) {
      console.log('인기 학교 목록 로드 조건 충족');
      loadPopularSchools();
    }
  }, [selectedTab, user, currentSchoolId, popularSchools.length, loadPopularSchools]);

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
    loadPosts();
  }, [selectedTab, selectedBoard, sortBy, boards, currentSchoolId]);

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
      console.log('=== useFocusEffect 실행됨 ===');
      
      // 차단 목록 새로고침
      if (user?.uid) {
        loadBlockedUsers();
      }
      
      // SchoolSelector 새로고침 (즐겨찾기 학교 추가 후 즉시 반영)
      if (selectedTab === 'school' && schoolSelectorRef.current) {
        schoolSelectorRef.current.refresh();
      }
      
      // 게시글 새로고침 (항상 실행하여 새 게시글이 바로 나타나도록)
      loadPosts();
      
      // 뒤로가기로 돌아온 경우 스크롤 위치 복원을 준비
      if (posts.length > 0) {
        setShouldRestoreScroll(true);
      }
    }, [user?.uid, selectedTab, loadBlockedUsers, posts.length])
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

  const loadPosts = async () => {
    // boards가 아직 로드되지 않았으면 대기
    if (boards.length === 0 && selectedBoard !== 'all') {
      return;
    }

    try {
      setIsLoading(true);

      let postsData: Post[] = [];

      if (selectedBoard === 'all') {
        // 전체 게시글 가져오기 - 새로운 필터링 로직 적용
        if (selectedTab === 'school') {
          // 학교 탭: currentSchoolId 사용
          if (currentSchoolId) {
            console.log('학교 전체 게시글 로딩 - currentSchoolId:', currentSchoolId);
            postsData = await getAllPostsBySchool(currentSchoolId);
          } else if (tab && typeof tab === 'string' && tab.startsWith('school/')) {
            // fallback: URL에서 schoolId 추출
            const schoolId = tab.split('/')[1];
            console.log('학교 전체 게시글 로딩 - URL schoolId:', schoolId);
            postsData = await getAllPostsBySchool(schoolId);
          } else if (user?.school?.id) {
            // fallback: 사용자의 학교 ID 사용
            console.log('학교 전체 게시글 로딩 - fallback schoolId:', user.school.id);
            postsData = await getAllPostsBySchool(user.school.id);
          }
        } else if (selectedTab === 'regional') {
          // 지역 탭: URL에서 sido, sigungu 추출
          if (tab && typeof tab === 'string' && tab.startsWith('regional/')) {
            const parts = tab.split('/');
            const sido = decodeURIComponent(parts[1]);
            const sigungu = decodeURIComponent(parts[2]);
            console.log('지역 전체 게시글 로딩 - sido:', sido, 'sigungu:', sigungu);
            postsData = await getAllPostsByRegion(sido, sigungu);
          } else if (user?.regions?.sido && user?.regions?.sigungu) {
            // fallback: 사용자의 지역 정보 사용
            console.log('지역 전체 게시글 로딩 - fallback regions:', user.regions.sido, user.regions.sigungu);
            postsData = await getAllPostsByRegion(user.regions.sido, user.regions.sigungu);
          }
        } else {
          // 전국 탭
          postsData = await getAllPostsByType(selectedTab);
        }
      } else {
        // 특정 게시판 게시글 가져오기 - 새로운 필터링 로직 적용
        if (selectedTab === 'school') {
          // 학교 탭: currentSchoolId 사용
          let schoolId = '';
          if (currentSchoolId) {
            schoolId = currentSchoolId;
          } else if (tab && typeof tab === 'string' && tab.startsWith('school/')) {
            schoolId = tab.split('/')[1];
          } else if (user?.school?.id) {
            schoolId = user.school.id;
          }
          console.log('학교 특정 게시판 로딩 - schoolId:', schoolId, 'boardCode:', selectedBoard);
          postsData = await getPostsByBoardType(selectedTab, selectedBoard, 20, schoolId);
        } else if (selectedTab === 'regional') {
          // 지역 탭: URL에서 sido, sigungu 추출
          let regions = undefined;
          if (tab && typeof tab === 'string' && tab.startsWith('regional/')) {
            const parts = tab.split('/');
            regions = {
              sido: decodeURIComponent(parts[1]),
              sigungu: decodeURIComponent(parts[2])
            };
          } else if (user?.regions?.sido && user?.regions?.sigungu) {
            regions = {
              sido: user.regions.sido,
              sigungu: user.regions.sigungu
            };
          }
          console.log('지역 특정 게시판 로딩 - regions:', regions, 'boardCode:', selectedBoard);
          postsData = await getPostsByBoardType(selectedTab, selectedBoard, 20, undefined, regions);
        } else {
          // 전국 탭
          postsData = await getPostsByBoardType(selectedTab, selectedBoard);
        }
      }

      // Post를 CommunityPost 형태로 변환
      let communityPosts: CommunityPost[] = postsData.map(post => ({
        ...post, // 모든 Post 필드를 복사
        boardName: post.boardName || boards.find(b => b.code === post.boardCode)?.name || '게시판',
        previewContent: truncateText(parseContentText(post.content), 100)
      }));

      // 정렬 적용
      communityPosts = communityPosts.sort((a, b) => {
        switch (sortBy) {
          case 'latest':
            return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
          case 'popular':
            return (b.stats?.likeCount || 0) - (a.stats?.likeCount || 0);
          case 'views':
            return (b.stats?.viewCount || 0) - (a.stats?.viewCount || 0);
          case 'comments':
            return (b.stats?.commentCount || 0) - (a.stats?.commentCount || 0);
          default:
            return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
        }
      });

      setPosts(communityPosts);
    } catch (error) {
      console.error('게시글 로드 실패:', error);
      // 에러 발생 시 빈 배열로 설정
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBoards(), loadPosts()]);
    setRefreshing(false);
  };

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handlePostPress = useCallback((post: CommunityPost) => {
    // onScroll에서 이미 스크롤 위치가 저장되므로 바로 이동
    router.push(`/board/${selectedTab}/${post.boardCode}/${post.id}` as any);
  }, [selectedTab, router]);

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
      // 사용자 정보가 없는 경우 - 인기 학교 목록 표시
      if (!user?.uid) {
        console.log('사용자 정보 없음, 인기 학교 목록 표시');
        // URL만 업데이트하고 리다이렉트하지 않음
        router.setParams({ tab: 'school' });
        return;
      }
      
      try {
        console.log('사용자 UID 확인됨:', user.uid);
        console.log('Fetching latest user info from users collection...');
        const latestUser = await getUserById(user.uid);
        console.log('가져온 사용자 정보:', latestUser);
        
        if (latestUser?.school?.id) {
          console.log('Redirecting to school:', latestUser.school.id);
          router.push(`/(tabs)/community?tab=school/${latestUser.school.id}`);
        } else {
          console.log('No school info, showing school setup modal');
          setShowSchoolSetupModal(true);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        // API 호출 실패 시 기존 user 정보로 fallback
        if (user?.school?.id) {
          console.log('Fallback to cached school:', user.school.id);
          router.push(`/(tabs)/community?tab=school/${user.school.id}`);
        } else {
          console.log('No cached school info, showing school setup modal');
          setShowSchoolSetupModal(true);
        }
      }
    } else if (newTab === 'regional') {
      console.log('=== 지역 탭 선택됨 ===');
      // 사용자 정보가 없는 경우 - 로그인 안내 화면 표시
      if (!user?.uid) {
        console.log('사용자 정보 없음, 로그인 안내 화면 표시');
        // URL만 업데이트하고 리다이렉트하지 않음
        router.setParams({ tab: 'regional' });
        return;
      }
      
      try {
        console.log('사용자 UID 확인됨:', user.uid);
        console.log('Fetching latest user info from users collection...');
        const latestUser = await getUserById(user.uid);
        console.log('가져온 사용자 정보:', latestUser);
        console.log('지역 정보:', latestUser?.regions);
        
        if (latestUser?.regions?.sido && latestUser?.regions?.sigungu) {
          console.log('Redirecting to region:', latestUser.regions.sido, latestUser.regions.sigungu);
          router.push(`/(tabs)/community?tab=regional/${encodeURIComponent(latestUser.regions.sido)}/${encodeURIComponent(latestUser.regions.sigungu)}`);
        } else {
          console.log('No region info, showing region setup modal');
          setShowRegionSetupModal(true);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        // API 호출 실패 시 기존 user 정보로 fallback
        if (user?.regions?.sido && user?.regions?.sigungu) {
          console.log('Fallback to cached region:', user.regions.sido, user.regions.sigungu);
          router.push(`/(tabs)/community?tab=regional/${encodeURIComponent(user.regions.sido)}/${encodeURIComponent(user.regions.sigungu)}`);
        } else {
          console.log('No cached region info, showing region setup modal');
          setShowRegionSetupModal(true);
        }
      }
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
      <Text style={styles.postCount}>총 {posts.length}개</Text>
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
  ), [posts.length, sortBy]);

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
    // 학교 탭에서 로그인하지 않은 사용자이고 특정 학교가 선택되지 않은 경우 인기 학교 목록 표시
    if (selectedTab === 'school' && !user && !currentSchoolId) {
      return (
        <View style={styles.popularSchoolsContainer}>
          <View style={styles.popularSchoolsHeader}>
            <Text style={styles.popularSchoolsIcon}>🏫</Text>
            <Text style={styles.popularSchoolsTitle}>인기 학교 커뮤니티</Text>
            {/* <Text style={styles.popularSchoolsSubtitle}>
              활발한 활동이 이루어지고 있는 학교 커뮤니티를 둘러보세요
            </Text> */}
          </View>
          
          {popularSchoolsLoading ? (
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

  // 로그인이 필요한 탭인지 확인 (학교 탭은 로그인 없이도 접근 가능)
  const isLoginRequired = selectedTab === 'regional' && !user;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        {renderTabs()}
        
        {selectedTab === 'school' && (
          user ? (
            // 로그인한 사용자: 기존 SchoolSelector
            <SchoolSelector 
              ref={schoolSelectorRef}
              style={styles.schoolSelector}
              onSchoolChange={async (school: any) => {
                // 학교 변경 시 URL 업데이트
                console.log('학교 변경됨:', school);
                const schoolId = school?.id || school;
                router.push(`/(tabs)/community?tab=school/${schoolId}`);
                // 게시글 다시 로드
                loadBoards();
                loadPosts();
              }}
            />
          ) : (
            // 로그인하지 않은 사용자: 현재 학교 정보 표시
            <View style={styles.guestSchoolInfo}>
              {currentSchoolInfo ? (
                <View style={styles.guestSchoolContent}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => {
                      // 인기 학교 목록으로 돌아가기
                      router.push('/(tabs)/community?tab=school');
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color="#6B7280" />
                  </TouchableOpacity>
                  <Text style={styles.guestSchoolIcon}>🏫</Text>
                  <View style={styles.guestSchoolText}>
                    <Text style={styles.guestSchoolName}>{currentSchoolInfo.KOR_NAME}</Text>
                    <Text style={styles.guestSchoolSubtext}>
                      {currentSchoolInfo.REGION} • 게스트로 방문 중
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.guestSchoolContent}>
                  <Text style={styles.guestSchoolIcon}>🏫</Text>
                  <View style={styles.guestSchoolText}>
                    <Text style={styles.guestSchoolName}>학교 커뮤니티 탐색</Text>
                    <Text style={styles.guestSchoolSubtext}>
                      아래에서 원하는 학교를 선택해보세요
                    </Text>
                  </View>
                </View>
              )}
              <TouchableOpacity 
                style={styles.guestLoginButton}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.guestLoginButtonText}>로그인</Text>
              </TouchableOpacity>
            </View>
          )
        )}
        
        {/* 카테고리 필터와 정렬 헤더는 인기 학교 목록이 아닐 때만 표시 */}
        {!(selectedTab === 'school' && !user && !currentSchoolId) && (
          <>
            {renderCategoryFilter()}
            {renderSortHeader()}
          </>
        )}
      </View>

      {/* 로그인이 필요한 탭에서는 로그인 안내 화면 표시 */}
      {isLoginRequired ? (
        <View style={styles.loginRequiredWrapper}>
          {renderLoginRequired()}
        </View>
      ) : (
        <>
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
              {renderEmptyState()}
            </ScrollView>
          ) : (
            <FlatList
              ref={scrollViewRef as any}
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderPostCard}
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
              // 성능 최적화 옵션
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
            />
          )}
        </>
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
      {user && (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  headerContainer: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  postCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
  popularSchoolsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
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

}); 