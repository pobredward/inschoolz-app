import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BoardType, Post, Comment, Board } from '@/types';
import { getBoardsByType } from '@/lib/boards';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, where, orderBy, Timestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { formatRelativeTime } from '@/utils/timeUtils';
import { parseContentText, extractAllImageUrls } from '@/utils/textUtils';
import HtmlRenderer from '@/components/HtmlRenderer';
import { awardCommentExperience } from '@/lib/experience-service';
import { ReportButton } from '@/components/ui/ReportButton';
import { ReportModal } from '@/components/ui/ReportModal';
import { ExperienceModal } from '@/components/ui/ExperienceModal';

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

interface PostDetail extends Post {
  boardName: string;
}

interface CommentWithAuthor extends Comment {
  author?: {
    userName: string;
    profileImageUrl?: string;
  };
  replies?: CommentWithAuthor[];
}

interface CustomHeaderProps {
  title: string;
  onBack: () => void;
  showMenu?: boolean;
  onMenuPress?: () => void;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ title, onBack, showMenu = false, onMenuPress }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.headerButton}>
      <Ionicons name="arrow-back" size={24} color="#111827" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    {showMenu && (
      <TouchableOpacity style={styles.headerButton} onPress={onMenuPress}>
        <Ionicons name="ellipsis-vertical" size={24} color="#111827" />
      </TouchableOpacity>
    )}
  </View>
);

export default function PostDetailScreen() {
  const router = useRouter();
  const { type, boardCode, postId } = useLocalSearchParams<{
    type: string;
    boardCode: string;
    postId: string;
  }>();
  
  const { user } = useAuthStore();
  const [post, setPost] = useState<Post | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string>('');
  const [reportTargetType, setReportTargetType] = useState<'post' | 'comment'>('post');
  const [reportTargetContent, setReportTargetContent] = useState<string>('');
  const [reportPostId, setReportPostId] = useState<string>('');

  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [experienceData, setExperienceData] = useState<{
    expGained: number;
    activityType: 'post' | 'comment' | 'like';
    leveledUp: boolean;
    oldLevel?: number;
    newLevel?: number;
    currentExp: number;
    expToNextLevel: number;
    remainingCount: number;
    totalDailyLimit: number;
    reason?: string;
  } | null>(null);

  // 게시판 타입을 한글로 변환하는 함수
  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'national':
        return '전국';
      case 'regional':
        return '지역';
      case 'school':
        return '학교';
      default:
        return type;
    }
  };

  const loadPostDetail = async () => {
    try {
      setIsLoading(true);
      
      // 게시글 상세 정보 가져오기
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        Alert.alert('오류', '게시글을 찾을 수 없습니다.');
        router.back();
        return;
      }

      const postData = { id: postDoc.id, ...postDoc.data() } as Post;
      
      // 게시판 정보 가져오기
      const boards = await getBoardsByType(type as BoardType);
      const boardData = boards.find(b => b.code === boardCode);
      
      if (!boardData) {
        Alert.alert('오류', '게시판을 찾을 수 없습니다.');
        router.back();
        return;
      }

      // 게시글이 해당 게시판에 속하는지 확인
      if (postData.boardCode !== boardCode) {
        Alert.alert('오류', '게시글을 찾을 수 없습니다.');
        router.back();
        return;
      }

      // 댓글 가져오기 (사용자 정보 포함)
      await loadComments(postId);

      setPost(postData);
      setBoard(boardData);
      setLikeCount(postData.stats.likeCount);
    } catch (error) {
      console.error('게시글 로드 실패:', error);
      Alert.alert('오류', '게시글을 불러오는데 실패했습니다.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      // 부모 댓글 가져오기
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        where('parentId', '==', null),
        orderBy('createdAt', 'desc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData: CommentWithAuthor[] = [];
      
      for (const commentDoc of commentsSnapshot.docs) {
        const commentData = { id: commentDoc.id, ...commentDoc.data() } as Comment;
        
        // 삭제된 댓글이지만 대댓글이 없는 경우 건너뛰기
        if (commentData.status.isDeleted && commentData.content !== '삭제된 댓글입니다.') {
          continue;
        }
        
        // 댓글 작성자 정보 가져오기
        let authorInfo = {
          userName: '사용자',
          profileImageUrl: ''
        };
        
        if (!commentData.isAnonymous && commentData.authorId && !commentData.status.isDeleted) {
          try {
            const userDoc = await getDoc(doc(db, 'users', commentData.authorId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData?.profile) {
                authorInfo = {
                  userName: userData.profile.userName || '사용자',
                  profileImageUrl: userData.profile.profileImageUrl || ''
                };
              }
            }
          } catch (error) {
            console.error('사용자 정보 조회 오류:', error);
          }
        }
        
        // 답글 가져오기
        const repliesQuery = query(
          collection(db, 'posts', postId, 'comments'),
          where('parentId', '==', commentData.id),
          orderBy('createdAt', 'asc')
        );
        const repliesSnapshot = await getDocs(repliesQuery);
        const replies: CommentWithAuthor[] = [];
        
        for (const replyDoc of repliesSnapshot.docs) {
          const replyData = { id: replyDoc.id, ...replyDoc.data() } as Comment;
          
          // 삭제된 대댓글이지만 내용이 "삭제된 댓글입니다."가 아닌 경우 건너뛰기
          if (replyData.status.isDeleted && replyData.content !== '삭제된 댓글입니다.') {
            continue;
          }
          
          // 답글 작성자 정보 가져오기
          let replyAuthorInfo = {
            userName: '사용자',
            profileImageUrl: ''
          };
          
          if (!replyData.isAnonymous && replyData.authorId && !replyData.status.isDeleted) {
            try {
              const replyUserDoc = await getDoc(doc(db, 'users', replyData.authorId));
              if (replyUserDoc.exists()) {
                const replyUserData = replyUserDoc.data();
                if (replyUserData?.profile) {
                  replyAuthorInfo = {
                    userName: replyUserData.profile.userName || '사용자',
                    profileImageUrl: replyUserData.profile.profileImageUrl || ''
                  };
                }
              }
            } catch (error) {
              console.error('답글 작성자 정보 조회 오류:', error);
            }
          }
          
          replies.push({
            ...replyData,
            author: replyAuthorInfo
          });
        }
        
        commentsData.push({
          ...commentData,
          author: authorInfo,
          replies
        });
      }

      setComments(commentsData);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    }
  };

  const formatDate = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  // 작성자 확인
  const isAuthor = user && post && user.uid === post.authorId;

  // 게시글 수정
  const handleEdit = () => {
    if (!isAuthor) {
      Alert.alert('오류', '수정 권한이 없습니다.');
      return;
    }
    router.push(`/board/${type}/${boardCode}/edit/${postId}`);
  };

  // 게시글 삭제
  const handleDelete = () => {
    if (!isAuthor) {
      Alert.alert('오류', '삭제 권한이 없습니다.');
      return;
    }

    Alert.alert(
      '게시글 삭제',
      '정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              // 게시글 소프트 삭제
              await updateDoc(doc(db, 'posts', postId), {
                'status.isDeleted': true,
                updatedAt: Timestamp.now()
              });
              
              Alert.alert('성공', '게시글이 삭제되었습니다.', [
                { text: '확인', onPress: () => router.push('/community') }
              ]);
            } catch (error) {
              console.error('게시글 삭제 실패:', error);
              Alert.alert('오류', '게시글 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  // 메뉴 버튼 클릭
  const handleMenuPress = () => {
    if (!post) return;
    
    Alert.alert(
      '게시글 관리',
      '원하는 작업을 선택하세요.',
      [
        ...(isAuthor ? [
          { text: '수정', onPress: handleEdit },
          { text: '삭제', onPress: handleDelete, style: 'destructive' as const }
        ] : [
          { text: '신고', onPress: () => {
            setReportTargetId(post.id);
            setReportTargetType('post');
            setReportTargetContent(post.content);
            setReportPostId('');
            setShowReportModal(true);
          }, style: 'destructive' as const }
        ]),
        { text: '취소', style: 'cancel' as const }
      ]
    );
  };

  // 경험치 모달 닫기 핸들러
  const handleExperienceModalClose = () => {
    setShowExperienceModal(false);
    setExperienceData(null);
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) {
      Alert.alert('알림', '댓글을 입력해주세요.');
      return;
    }

    if (!user || !post) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      // 댓글 작성
      const commentData = {
        postId: post.id,
        content: newComment,
        authorId: user.uid,
        isAnonymous: false,
        parentId: null,
        createdAt: Date.now(),
        stats: {
          likeCount: 0
        },
        status: {
          isDeleted: false,
          isBlocked: false
        }
      };

      await addDoc(collection(db, 'posts', post.id, 'comments'), commentData);
      
      // 댓글 목록 새로고침
      await loadComments(post.id);
      setNewComment('');
      
      // 경험치 부여
      try {
        const expResult = await awardCommentExperience(user.uid);
        if (expResult.success) {
          setExperienceData({
            expGained: expResult.expGained,
            activityType: 'comment',
            leveledUp: expResult.leveledUp,
            oldLevel: expResult.oldLevel,
            newLevel: expResult.newLevel,
            currentExp: expResult.currentExp,
            expToNextLevel: expResult.expToNextLevel,
            remainingCount: expResult.remainingCount,
            totalDailyLimit: expResult.totalDailyLimit,
            reason: expResult.reason
          });
          setShowExperienceModal(true);
        }
      } catch (expError) {
        console.error('경험치 부여 실패:', expError);
        // 경험치 부여 실패는 댓글 작성 성공에 영향을 주지 않음
      }
      
      Alert.alert('성공', '댓글이 작성되었습니다.');
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      Alert.alert('오류', '댓글 작성에 실패했습니다.');
    }
  };

  const handleReplySubmit = async (parentId: string) => {
    if (!replyContent.trim()) {
      Alert.alert('알림', '답글을 입력해주세요.');
      return;
    }

    if (!user || !post) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      // 답글 작성
      const replyData = {
        postId: post.id,
        content: replyContent,
        authorId: user.uid,
        isAnonymous: false,
        parentId: parentId,
        createdAt: Date.now(),
        stats: {
          likeCount: 0
        },
        status: {
          isDeleted: false,
          isBlocked: false
        }
      };

      await addDoc(collection(db, 'posts', post.id, 'comments'), replyData);
      
      // 댓글 목록 새로고침
      await loadComments(post.id);
      setReplyContent('');
      setReplyingTo(null);
      
      // 경험치 부여
      try {
        const expResult = await awardCommentExperience(user.uid);
        if (expResult.success) {
          setExperienceData({
            expGained: expResult.expGained,
            activityType: 'comment',
            leveledUp: expResult.leveledUp,
            oldLevel: expResult.oldLevel,
            newLevel: expResult.newLevel,
            currentExp: expResult.currentExp,
            expToNextLevel: expResult.expToNextLevel,
            remainingCount: expResult.remainingCount,
            totalDailyLimit: expResult.totalDailyLimit,
            reason: expResult.reason
          });
          setShowExperienceModal(true);
        }
      } catch (expError) {
        console.error('경험치 부여 실패:', expError);
        // 경험치 부여 실패는 답글 작성 성공에 영향을 주지 않음
      }
      
      Alert.alert('성공', '답글이 작성되었습니다.');
    } catch (error) {
      console.error('답글 작성 실패:', error);
      Alert.alert('오류', '답글 작성에 실패했습니다.');
    }
  };

  const renderProfileImage = (profileImageUrl?: string, userName?: string, isAnonymous?: boolean) => {
    if (isAnonymous) {
      return (
        <View style={styles.commentAvatar}>
          <Text style={styles.avatarText}>익명</Text>
        </View>
      );
    }

    if (profileImageUrl) {
      return (
        <Image 
          source={{ uri: profileImageUrl }} 
          style={styles.commentAvatar}
        />
      );
    }

    return (
      <View style={styles.commentAvatar}>
        <Ionicons name="person" size={16} color="#6b7280" />
      </View>
    );
  };

  const renderComment = (comment: CommentWithAuthor, level: number = 0, parentAuthor?: string) => {
    const isDeleted = comment.status.isDeleted && comment.content === '삭제된 댓글입니다.';
    const isReply = level > 0;
    const authorName = isDeleted ? '삭제된 사용자' : (comment.isAnonymous ? '익명' : comment.author?.userName || '사용자');
    const maxLevel = 1; // 최대 1단계 대댓글까지만 허용
    
    return (
      <View key={comment.id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
        <View style={styles.commentWrapper}>
          {/* 대댓글 연결선 */}
          {isReply && (
            <View style={styles.replyConnector} />
          )}
          
          <View style={styles.commentAvatar}>
            <Text style={styles.avatarText}>
              {authorName.charAt(0)}
            </Text>
          </View>
      
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <View style={styles.commentAuthorRow}>
                <Text style={styles.commentAuthor}>
                  {authorName}
                </Text>
              </View>
              <View style={styles.commentMetaRow}>
                <Text style={styles.commentDate}>
                  {formatDate(comment.createdAt)}
                </Text>
                {!isDeleted && (
                  <TouchableOpacity
                    style={styles.commentMenuButton}
                    onPress={() => {
                      Alert.alert(
                        '댓글 메뉴',
                        '',
                        [
                          ...(user?.uid === comment.authorId ? [
                            { text: '수정', onPress: () => {} },
                            { text: '삭제', onPress: () => {}, style: 'destructive' as const },
                          ] : [
                            { text: '신고', onPress: () => {
                              setReportTargetId(comment.id);
                              setReportTargetType('comment');
                              setReportTargetContent(comment.content);
                              setReportPostId(postId);
                              setShowReportModal(true);
                            }, style: 'destructive' as const },
                          ]),
                          { text: '취소', style: 'cancel' as const },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <Text style={[styles.commentText, isDeleted && styles.deletedCommentText]}>
              {parseContentText(comment.content)}
            </Text>
        
            {!isDeleted && (
              <View style={styles.commentActions}>
                <TouchableOpacity style={styles.commentAction}>
                  <Ionicons name="heart-outline" size={14} color="#64748b" />
                  <Text style={styles.commentActionText}>
                    {comment.stats.likeCount}
                  </Text>
                </TouchableOpacity>
                
                {level < maxLevel && (
                  <TouchableOpacity 
                    style={styles.commentAction}
                    onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    <Ionicons name="chatbubbles-outline" size={14} color="#64748b" />
                    <Text style={styles.commentActionText}>답글</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
        
        {/* 대댓글 렌더링 */}
        {comment.replies && comment.replies.map((reply) => (
          renderComment(reply, level + 1, authorName)
        ))}
        
        {/* 답글 작성 UI */}
        {replyingTo === comment.id && level === 0 && (
          <View style={styles.replyInputContainer}>
            <View style={styles.replyToIndicator}>
              <Text style={styles.replyToIndicatorText}>
                <Text style={styles.replyToAuthorHighlight}>@{authorName}</Text>님에게 답글
              </Text>
            </View>
            <TextInput
              style={styles.replyInput}
              value={replyContent}
              onChangeText={setReplyContent}
              placeholder="답글을 입력하세요..."
              multiline
            />
            <View style={styles.replyButtonContainer}>
              <TouchableOpacity 
                style={styles.replyCancelButton}
                onPress={() => setReplyingTo(null)}
              >
                <Text style={styles.replyCancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.replyButton}
                onPress={() => handleReplySubmit(comment.id)}
              >
                <Text style={styles.replyButtonText}>답글 작성</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  useEffect(() => {
    loadPostDetail();
  }, [postId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  if (!post || !board) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>게시글을 찾을 수 없습니다.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader 
        title={board.name} 
        onBack={() => router.back()} 
        showMenu={true}
        onMenuPress={handleMenuPress}
      />

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 게시글 내용 */}
          <View style={styles.postContainer}>
            {/* 게시판 배지 */}
            <View style={styles.boardTypeContainer}>
              <View style={styles.boardTypeBadge}>
                <Text style={styles.boardTypeText}>{getBoardTypeLabel(type)}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{board.name}</Text>
              </View>
            </View>

            {/* 제목 */}
            <Text style={styles.postTitle}>{post.title}</Text>

            {/* 작성자 정보 */}
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>
                {post.authorInfo?.displayName || '익명'}
              </Text>
              <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
              <Text style={styles.viewCount}>조회 {post.stats.viewCount}</Text>
            </View>

            {/* 내용 (HTML 렌더링으로 인라인 이미지 포함) */}
            <HtmlRenderer 
              html={post.content} 
              contentWidth={width - 32}
              baseStyle={styles.postContent}
            />

            {/* 액션 버튼 */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="heart-outline" size={18} color="#6b7280" />
                <Text style={styles.actionButtonText}>좋아요 {likeCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
                <Text style={styles.actionButtonText}>댓글 {comments.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="bookmark-outline" size={18} color="#6b7280" />
                <Text style={styles.actionButtonText}>스크랩</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 댓글 섹션 */}
          <View style={styles.commentSection}>
            <View style={styles.commentSectionHeader}>
              <Text style={styles.commentTitle}>댓글</Text>
              <View style={styles.commentBadge}>
                <Text style={styles.commentBadgeText}>{comments.length}</Text>
              </View>
            </View>

            {/* 댓글 목록 */}
            {comments.map((comment) => (
              renderComment(comment, 0)
            ))}
          </View>
        </ScrollView>

        {/* 댓글 작성 */}
        <View style={styles.commentInputContainer}>
          <View style={styles.commentInputWrapper}>
            {renderProfileImage(
              user?.profile?.profileImageUrl,
              user?.profile?.userName,
              false
            )}
            <TextInput
              style={styles.commentInput}
              placeholder="댓글을 입력해 주세요..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={styles.commentSubmitButton}
              onPress={handleCommentSubmit}
            >
              <Ionicons name="send" size={20} color="#10b981" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* 경험치 획득 모달 */}
      {experienceData && (
        <ExperienceModal
          visible={showExperienceModal}
          onClose={handleExperienceModalClose}
          data={experienceData}
        />
      )}

      {/* 신고 모달 */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetId={reportTargetId}
        targetType={reportTargetType}
        targetContent={reportTargetContent}
        postId={reportTargetType === 'comment' ? reportPostId : undefined}
        onSuccess={() => {
          setShowReportModal(false);
          Alert.alert('완료', '신고가 접수되었습니다.');
        }}
        boardCode={post.boardCode}
        schoolId={post.schoolId}
        regions={post.regions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  postContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#2563eb',
  },
  postTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 28,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  boardTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  boardTypeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  boardTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  postDate: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  viewCount: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  postContent: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'left',
  },
  attachmentSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  attachmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  imageScrollView: {
    paddingVertical: 4,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  commentSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  commentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  commentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  commentBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  commentBadgeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  commentContainer: {
    marginBottom: 12,
  },
  replyContainer: {
    marginLeft: 24,
    marginTop: 8,
  },
  commentWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentDate: {
    fontSize: 12,
    color: '#64748b',
  },
  commentMenuButton: {
    padding: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
    textAlign: 'left',
  },
  deletedCommentText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#64748b',
  },
  replyInputContainer: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  replyInput: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    padding: 0,
    marginBottom: 8,
  },
  replyButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  replyButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  replyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  replyCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  replyCancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  replyConnector: {
    position: 'absolute',
    left: 16,
    top: -8,
    width: 20,
    height: 20,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 8,
  },
  replyToIndicator: {
    backgroundColor: '#e0f2fe', // 답글 힌트 배경색
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyToIndicatorText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  replyToAuthorHighlight: {
    color: '#2563eb',
  },

  commentInputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 120,
    backgroundColor: '#f9fafb',
  },
  commentSubmitButton: {
    padding: 10,
  },
}); 