import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { 
  getUserById, 
  checkFollowStatus, 
  checkBlockStatus, 
  getFollowersCount, 
  getFollowingCount, 
  toggleFollow,
  getUserPosts,
  getUserComments 
} from '../../lib/users';
import { checkAttendance, UserAttendance } from '../../lib/attendance';
import { getKoreanDateString } from '../../utils/timeUtils';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';
import FollowersModal from '../../components/FollowersModal';
import { User } from '../../types';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuthStore();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [attendanceData, setAttendanceData] = useState<UserAttendance>({
    checkedToday: false,
    streak: 0,
    totalCount: 0,
    monthCount: 0,
    monthlyLog: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers');

  const loadUserProfile = async () => {
    if (!userId) {
      setError('유효하지 않은 사용자 ID입니다.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 사용자 정보 조회
      const user = await getUserById(userId);
      if (!user) {
        setError('사용자를 찾을 수 없습니다.');
        return;
      }

      setProfileUser(user);

      // 출석 데이터 조회 (공개 정보)
      try {
        const attendance = await checkAttendance(userId);
        setAttendanceData(attendance);
      } catch (attendanceError) {
        console.warn('출석 데이터 조회 실패:', attendanceError);
      }

      // 팔로워/팔로잉 정보 조회 (현재 사용자가 있는 경우에만)
      if (currentUser) {
        try {
          const [followStatus, blockStatus, followerCount, followingCount] = await Promise.all([
            checkFollowStatus(currentUser.uid, userId).catch(() => false),
            checkBlockStatus(currentUser.uid, userId).catch(() => false),
            getFollowersCount(userId).catch(() => 0),
            getFollowingCount(userId).catch(() => 0)
          ]);

          setIsFollowing(followStatus);
          setIsBlocked(blockStatus);
          setFollowersCount(followerCount);
          setFollowingCount(followingCount);
        } catch (relationshipError) {
          console.warn('사용자 관계 정보 조회 실패:', relationshipError);
        }
      } else {
        // 로그인하지 않은 사용자도 팔로워/팔로잉 수는 볼 수 있음
        try {
          const [followerCount, followingCount] = await Promise.all([
            getFollowersCount(userId).catch(() => 0),
            getFollowingCount(userId).catch(() => 0)
          ]);
          
          setFollowersCount(followerCount);
          setFollowingCount(followingCount);
        } catch (countError) {
          console.warn('팔로워/팔로잉 수 조회 실패:', countError);
        }
      }

      // 사용자 콘텐츠 조회
      try {
        const [postsResult, commentsResult] = await Promise.all([
          getUserPosts(userId, 1, 10, 'latest').catch(() => ({ posts: [], totalCount: 0 })),
          getUserComments(userId, 1, 10).catch(() => ({ comments: [], totalCount: 0 }))
        ]);

        setPosts(postsResult.posts || []);
        setComments(commentsResult.comments || []);
      } catch (contentError) {
        console.warn('사용자 콘텐츠 조회 실패:', contentError);
      }
    } catch (error) {
      console.error('사용자 프로필 로드 오류:', error);
      setError('프로필을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  // 자신의 프로필인지 확인
  const isOwnProfile = currentUser && profileUser && currentUser.uid === profileUser.uid;

  const handleGoBack = () => {
    router.back();
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      Alert.alert('로그인 필요', '팔로우하려면 로그인이 필요합니다.');
      return;
    }

    try {
      await toggleFollow(currentUser.uid, userId);
      
      // 상태 즉시 업데이트
      setIsFollowing(!isFollowing);
      setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
      
      Alert.alert('완료', isFollowing ? '팔로우를 취소했습니다.' : '팔로우했습니다.');
    } catch (error) {
      console.error('팔로우 토글 오류:', error);
      Alert.alert('오류', '팔로우 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleFollowersPress = () => {
    setFollowersModalType('followers');
    setShowFollowersModal(true);
  };

  const handleFollowingPress = () => {
    setFollowersModalType('following');
    setShowFollowersModal(true);
  };

  if (loading) {
    return (
      <SafeScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>프로필 로딩 중...</Text>
        </View>
      </SafeScreenContainer>
    );
  }

  if (error || !profileUser) {
    return (
      <SafeScreenContainer>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>오류가 발생했습니다</Text>
          <Text style={styles.errorMessage}>{error || '사용자를 찾을 수 없습니다'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeScreenContainer>
    );
  }

  return (
    <SafeScreenContainer>
      <ScrollView style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 0. 기본 정보 (프로필 이미지, 유저네임) */}
        <View style={styles.profileCard}>
          <View style={styles.profileImageContainer}>
            <Ionicons name="person-circle" size={100} color="#10B981" />
          </View>
          
          <Text style={styles.userName}>{profileUser.profile?.userName || '익명'}</Text>
          
          {/* 역할 배지 */}
          <View style={styles.badgeContainer}>
            {profileUser.role === 'admin' && (
              <View style={[styles.badge, styles.adminBadge]}>
                <Text style={styles.badgeText}>관리자</Text>
              </View>
            )}
            {profileUser.role === 'teacher' && (
              <View style={[styles.badge, styles.teacherBadge]}>
                <Text style={styles.badgeText}>선생님</Text>
              </View>
            )}
          </View>

          {/* 팔로우 버튼 */}
          {!isOwnProfile && currentUser && (
            <TouchableOpacity 
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollowToggle}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? '팔로잉' : '팔로우'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 1. 팔로워와 팔로잉 */}
        <View style={styles.followCard}>
          <TouchableOpacity style={styles.followItem} onPress={handleFollowersPress}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.followNumber}>{followersCount.toLocaleString()}</Text>
            <Text style={styles.followLabel}>팔로워</Text>
          </TouchableOpacity>
          
          <View style={styles.followDivider} />
          
          <TouchableOpacity style={styles.followItem} onPress={handleFollowingPress}>
            <Ionicons name="people" size={24} color="#10B981" />
            <Text style={styles.followNumber}>{followingCount.toLocaleString()}</Text>
            <Text style={styles.followLabel}>팔로잉</Text>
          </TouchableOpacity>
        </View>

        {/* 2. 레벨 및 경험치 */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <Ionicons name="trophy" size={24} color="#F59E0B" />
            <View style={styles.levelInfo}>
              <Text style={styles.levelText}>레벨 {profileUser.stats?.level || 1}</Text>
              <Text style={styles.expText}>
                {profileUser.stats?.currentExp || 0} / {profileUser.stats?.currentLevelRequiredXp || 10} XP
              </Text>
            </View>
          </View>
          
          {/* 경험치 프로그레스 바 */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(((profileUser.stats?.currentExp || 0) / (profileUser.stats?.currentLevelRequiredXp || 10)) * 100, 100)}%` }
                ]}
              />
            </View>
          </View>
        </View>

        {/* 3. 학교 및 주소 */}
        <View style={styles.infoCard}>
          {profileUser.school?.name && (
            <View style={styles.infoItem}>
              <Ionicons name="school" size={20} color="#3B82F6" />
              <Text style={styles.infoText}>
                {profileUser.school.name}
                {profileUser.school.grade && profileUser.school.classNumber && (
                  ` (${profileUser.school.grade}학년 ${profileUser.school.classNumber}반)`
                )}
              </Text>
            </View>
          )}
          
          {profileUser.regions && (
            <View style={styles.infoItem}>
              <Ionicons name="location" size={20} color="#EF4444" />
              <Text style={styles.infoText}>
                {profileUser.regions.sido} {profileUser.regions.sigungu}
              </Text>
            </View>
          )}
          
          <View style={styles.infoItem}>
            <Ionicons name="calendar" size={20} color="#6B7280" />
            <Text style={styles.infoText}>가입 정보</Text>
          </View>
        </View>

        {/* 4. 활동 현황 (출석) */}
        <View style={styles.activityCard}>
          <Text style={styles.cardTitle}>📅 출석 현황</Text>
          
          <View style={styles.attendanceStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{attendanceData.streak}</Text>
              <Text style={styles.statLabel}>연속출석</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{attendanceData.monthCount}</Text>
              <Text style={styles.statLabel}>이번달</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{attendanceData.totalCount}</Text>
              <Text style={styles.statLabel}>총 출석</Text>
            </View>
          </View>
        </View>

        {/* 5. 활동 내역 (게시글 및 댓글) */}
        <View style={styles.contentCard}>
          <Text style={styles.cardTitle}>📝 활동 내역</Text>
          
          {/* 게시글 섹션 */}
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <Ionicons name="document-text" size={16} color="#3B82F6" />
              <Text style={styles.activityLabel}>게시글 ({posts.length})</Text>
            </View>
            {posts.length > 0 ? (
              posts.slice(0, 3).map((post, index) => (
                <View key={index} style={styles.activityItem}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {post.title || '제목 없음'}
                  </Text>
                  <Text style={styles.activityContent} numberOfLines={2}>
                    {post.content?.replace(/<[^>]*>/g, '') || '내용 없음'}
                  </Text>
                  <Text style={styles.activityDate}>
                    {post.boardName || '게시판'} • 작성일
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>작성한 게시글이 없습니다.</Text>
            )}
          </View>

          {/* 댓글 섹션 */}
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <Ionicons name="chatbubble" size={16} color="#10B981" />
              <Text style={styles.activityLabel}>댓글 ({comments.length})</Text>
            </View>
            {comments.length > 0 ? (
              comments.slice(0, 3).map((comment, index) => (
                <View key={index} style={styles.activityItem}>
                  <Text style={styles.activityContent} numberOfLines={2}>
                    {comment.content || '내용 없음'}
                  </Text>
                  <Text style={styles.activityDate}>
                    댓글 • 작성일
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>작성한 댓글이 없습니다.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 팔로워/팔로잉 모달 */}
      <FollowersModal
        visible={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={profileUser?.uid || ''}
        type={followersModalType}
        title={followersModalType === 'followers' ? '팔로워' : '팔로잉'}
      />
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadge: {
    backgroundColor: '#FEE2E2',
  },
  teacherBadge: {
    backgroundColor: '#DBEAFE',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  followButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  followingButtonText: {
    color: '#10B981',
  },
  followCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  followItem: {
    flex: 1,
    alignItems: 'center',
  },
  followDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  followNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  followLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  levelCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelInfo: {
    marginLeft: 12,
  },
  levelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  expText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
    flex: 1,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
       comingSoon: {
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  activitySection: {
    marginBottom: 20,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  activityItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  activityContent: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
}); 