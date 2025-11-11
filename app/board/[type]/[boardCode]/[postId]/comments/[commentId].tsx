import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Hyperlink from 'react-native-hyperlink';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { SafeProfileImage } from '../../../../../../components/SafeProfileImage';
import { formatRelativeTime, toTimestamp } from '../../../../../../utils/timeUtils';
import { BlockedUserContent } from '../../../../../../components/ui/BlockedUserContent';
import { toggleCommentLike, checkMultipleCommentLikeStatus } from '@/lib/boards';
import { awardCommentExperience } from '@/lib/experience-service';
import { ExperienceModal } from '../../../../../../components/ui/ExperienceModal';
import AnonymousPasswordModal from '../../../../../../components/ui/AnonymousPasswordModal';
import { deleteAnonymousComment } from '@/lib/boards';

interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string | null;
  isAnonymous?: boolean;
  anonymousAuthor?: {
    nickname: string;
  };
  parentId: string | null;
  createdAt: any;
  stats: {
    likeCount: number;
  };
  status: {
    isDeleted: boolean;
    isBlocked: boolean;
  };
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
  insets?: { top: number; bottom: number; left: number; right: number };
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ title, onBack, insets }) => (
  <View style={[
    styles.header,
    Platform.OS === 'android' && insets && { paddingTop: insets.top + 8 }
  ]}>
    <TouchableOpacity onPress={onBack} style={styles.headerButton}>
      <Ionicons name="arrow-back" size={20} color="#111827" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={styles.headerButton} />
  </View>
);

const parseContentText = (content: string) => {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'doc' && parsed.content) {
      return extractTextFromTipTap(parsed);
    }
    return content;
  } catch {
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
  }
};

const extractTextFromTipTap = (node: any): string => {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromTipTap).join('');
  }
  return '';
};

export default function CommentDetailScreen() {
  const router = useRouter();
  const { type, boardCode, postId, commentId } = useLocalSearchParams<{
    type: string;
    boardCode: string;
    postId: string;
    commentId: string;
  }>();
  
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [parentComment, setParentComment] = useState<CommentWithAuthor | null>(null);
  const [replies, setReplies] = useState<CommentWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [commentLikeStatuses, setCommentLikeStatuses] = useState<Record<string, boolean>>({});
  
  // 답글 작성 상태
  const [replyContent, setReplyContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 답글 제출 중 상태
  
  // 경험치 모달
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [experienceData, setExperienceData] = useState<any>(null);
  
  // 댓글 수정 상태
  const [editingComment, setEditingComment] = useState<{
    commentId: string;
    content: string;
  } | null>(null);
  const [editingAnonymousComment, setEditingAnonymousComment] = useState<{
    commentId: string;
    content: string;
    password: string;
  } | null>(null);
  
  // 비밀번호 모달
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalData, setPasswordModalData] = useState<{
    commentId: string;
    action: 'edit' | 'delete';
  } | null>(null);

  // 차단된 사용자 목록 로드
  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const { getBlockedUserIds } = await import('../../../../../../lib/users');
      const blockedIds = await getBlockedUserIds(user.uid);
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단된 사용자 목록 로드 실패:', error);
    }
  }, [user?.uid]);

  // 차단 해제 시 상태 업데이트
  const handleUnblock = useCallback((userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  }, []);

  // 댓글 및 답글 로드
  const loadCommentAndReplies = async () => {
    try {
      setIsLoading(true);
      
      // 부모 댓글 로드
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);
      
      if (!commentDoc.exists()) {
        Alert.alert('오류', '댓글을 찾을 수 없습니다.');
        router.back();
        return;
      }

      const commentData = { id: commentDoc.id, ...commentDoc.data() } as Comment;
      
      // status 객체가 없는 경우 기본값으로 초기화
      if (!commentData.status) {
        commentData.status = {
          isDeleted: false,
          isBlocked: false
        };
      }
      
      // 댓글 작성자 정보 가져오기
      let authorInfo = {
        userName: '사용자',
        profileImageUrl: ''
      };
      
      if (commentData.isAnonymous || !commentData.authorId) {
        if (commentData.anonymousAuthor?.nickname) {
          authorInfo.userName = commentData.anonymousAuthor.nickname;
        } else {
          authorInfo.userName = '익명';
        }
      } else if (!commentData.status.isDeleted) {
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
      
      setParentComment({
        ...commentData,
        author: authorInfo
      });
      
      // 답글 로드
      const repliesQuery = query(
        collection(db, 'posts', postId, 'comments'),
        where('parentId', '==', commentId),
        orderBy('createdAt', 'asc')
      );
      const repliesSnapshot = await getDocs(repliesQuery);
      const repliesData: CommentWithAuthor[] = [];
      
      for (const replyDoc of repliesSnapshot.docs) {
        const replyData = { id: replyDoc.id, ...replyDoc.data() } as Comment;
        
        if (!replyData.status) {
          replyData.status = {
            isDeleted: false,
            isBlocked: false
          };
        }
        
        if (replyData.status.isDeleted && replyData.content !== '삭제된 댓글입니다.') {
          continue;
        }
        
        let replyAuthorInfo = {
          userName: '사용자',
          profileImageUrl: ''
        };
        
        if (replyData.isAnonymous || !replyData.authorId) {
          if (replyData.anonymousAuthor?.nickname) {
            replyAuthorInfo.userName = replyData.anonymousAuthor.nickname;
          } else {
            replyAuthorInfo.userName = '익명';
          }
        } else if (!replyData.status.isDeleted) {
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
        
        repliesData.push({
          ...replyData,
          author: replyAuthorInfo
        });
      }
      
      repliesData.sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
      setReplies(repliesData);
      
      // 좋아요 상태 확인
      if (user?.uid) {
        const allCommentIds = [commentId, ...repliesData.map(r => r.id)];
        try {
          const likeStatuses = await checkMultipleCommentLikeStatus(postId, allCommentIds, user.uid);
          setCommentLikeStatuses(likeStatuses);
        } catch (error) {
          console.error('댓글 좋아요 상태 확인 실패:', error);
        }
      }
    } catch (error) {
      console.error('댓글 로드 실패:', error);
      Alert.alert('오류', '댓글을 불러오는데 실패했습니다.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  // 답글 작성
  const handleReplySubmit = async () => {
    if (!user || !parentComment || !replyContent.trim()) {
      Alert.alert('알림', '로그인 후 답글을 작성할 수 있습니다.');
      return;
    }

    // 이미 제출 중이면 중복 제출 방지
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { createComment } = await import('../../../../../../lib/boards');
      await createComment(postId, replyContent, user.uid, isAnonymous, commentId);
      
      // 입력 필드 먼저 초기화 (사용자 경험 개선)
      setReplyContent('');
      setIsAnonymous(false);
      
      // 답글 목록 새로고침
      await loadCommentAndReplies();
      
      // 경험치 부여
      if (!isAnonymous) {
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
        }
      }
      
      Alert.alert('성공', '답글이 작성되었습니다.');
    } catch (error) {
      console.error('답글 작성 실패:', error);
      Alert.alert('오류', '답글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 댓글 좋아요 토글
  const handleCommentLike = async (targetCommentId: string) => {
    if (!user?.uid) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const result = await toggleCommentLike(postId, targetCommentId, user.uid);
      
      setCommentLikeStatuses(prev => ({
        ...prev,
        [targetCommentId]: result.liked
      }));
      
      // 좋아요 수 업데이트
      if (parentComment && parentComment.id === targetCommentId) {
        setParentComment(prev => prev ? {
          ...prev,
          stats: {
            ...prev.stats,
            likeCount: result.likeCount
          }
        } : null);
      } else {
        setReplies(prev => prev.map(reply => {
          if (reply.id === targetCommentId) {
            return {
              ...reply,
              stats: {
                ...reply.stats,
                likeCount: result.likeCount
              }
            };
          }
          return reply;
        }));
      }
    } catch (error) {
      console.error('댓글 좋아요 처리 실패:', error);
      Alert.alert('오류', '좋아요 처리에 실패했습니다.');
    }
  };

  // 댓글 더보기 메뉴
  const handleCommentMorePress = (comment: CommentWithAuthor) => {
    const isOwnComment = user && comment.authorId === user.uid;
    const isGuestAnonymousComment = comment.isAnonymous && !comment.authorId;
    
    if (!user && !isGuestAnonymousComment) return;
    
    let options: string[] = [];
    
    if (isOwnComment || isGuestAnonymousComment) {
      options = ['수정', '삭제', '취소'];
    } else if (user) {
      const isBlocked = blockedUserIds.has(comment.authorId || '');
      options = ['신고', isBlocked ? '차단 해제' : '차단', '취소'];
    } else {
      return;
    }

    Alert.alert(
      '댓글 옵션',
      '원하는 작업을 선택하세요.',
      options.map(option => ({
        text: option,
        style: option === '취소' ? 'cancel' : option === '삭제' || option === '신고' ? 'destructive' : 'default',
        onPress: () => {
          switch (option) {
            case '수정':
              if (isGuestAnonymousComment) {
                setPasswordModalData({ commentId: comment.id, action: 'edit' });
                setShowPasswordModal(true);
              } else {
                setEditingComment({
                  commentId: comment.id,
                  content: comment.content
                });
              }
              break;
            case '삭제':
              if (isGuestAnonymousComment) {
                setPasswordModalData({ commentId: comment.id, action: 'delete' });
                setShowPasswordModal(true);
              } else {
                Alert.alert(
                  '댓글 삭제',
                  '댓글을 삭제하시겠습니까?',
                  [
                    { text: '취소', style: 'cancel' },
                    { 
                      text: '삭제', 
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          if (!user) return;
                          const { deleteComment } = await import('../../../../../../lib/boards');
                          await deleteComment(postId, comment.id, user.uid);
                          await loadCommentAndReplies();
                          Alert.alert('완료', '댓글이 삭제되었습니다.');
                        } catch (error) {
                          console.error('댓글 삭제 실패:', error);
                          Alert.alert('오류', '댓글 삭제에 실패했습니다.');
                        }
                      }
                    }
                  ]
                );
              }
              break;
            case '신고':
              // 신고 기능 구현
              break;
            case '차단':
            case '차단 해제':
              Alert.alert(
                option === '차단' ? '사용자 차단' : '차단 해제',
                `${comment.author?.userName || '이 사용자'}님을 ${option === '차단' ? '차단하시겠습니까' : '차단 해제하시겠습니까'}?`,
                [
                  { text: '취소', style: 'cancel' },
                  {
                    text: option === '차단' ? '차단' : '차단 해제',
                    style: option === '차단' ? 'destructive' : 'default',
                    onPress: async () => {
                      try {
                        if (!user) return;
                        const { toggleBlock } = await import('../../../../../../lib/users');
                        await toggleBlock(user.uid, comment.authorId!);
                        if (option === '차단') {
                          setBlockedUserIds(prev => new Set([...prev, comment.authorId!]));
                        } else {
                          handleUnblock(comment.authorId!);
                        }
                        Alert.alert('완료', option === '차단' ? '사용자를 차단했습니다.' : '차단을 해제했습니다.');
                      } catch (error) {
                        console.error('차단 처리 실패:', error);
                        Alert.alert('오류', '차단 처리에 실패했습니다.');
                      }
                    }
                  }
                ]
              );
              break;
          }
        }
      }))
    );
  };

  // 비밀번호 확인 성공 핸들러
  const handlePasswordVerifySuccess = (verifiedPassword: string) => {
    if (!passwordModalData) return;

    const { commentId: targetCommentId, action } = passwordModalData;
    
    if (action === 'edit') {
      const comment = parentComment?.id === targetCommentId ? parentComment : replies.find(r => r.id === targetCommentId);
      if (comment) {
        setEditingAnonymousComment({
          commentId: targetCommentId,
          content: comment.content,
          password: verifiedPassword,
        });
      }
    } else if (action === 'delete') {
      handleAnonymousCommentDelete(targetCommentId, verifiedPassword);
    }

    setShowPasswordModal(false);
    setPasswordModalData(null);
  };

  // 익명 댓글 삭제
  const handleAnonymousCommentDelete = async (targetCommentId: string, password: string) => {
    try {
      await deleteAnonymousComment(postId, targetCommentId, password);
      Alert.alert('성공', '댓글이 삭제되었습니다.');
      await loadCommentAndReplies();
    } catch (error) {
      console.error('익명 댓글 삭제 실패:', error);
      Alert.alert('오류', '댓글 삭제에 실패했습니다.');
    }
  };

  // 익명 댓글 수정 완료
  const handleAnonymousCommentEditComplete = async () => {
    if (!editingAnonymousComment) return;

    try {
      const { updateAnonymousComment } = await import('../../../../../../lib/boards');
      await updateAnonymousComment(
        postId, 
        editingAnonymousComment.commentId, 
        editingAnonymousComment.content, 
        editingAnonymousComment.password
      );
      
      setEditingAnonymousComment(null);
      await loadCommentAndReplies();
      Alert.alert('성공', '댓글이 수정되었습니다.');
    } catch (error) {
      console.error('익명 댓글 수정 실패:', error);
      Alert.alert('오류', '댓글 수정에 실패했습니다.');
    }
  };

  // 회원 댓글 수정 완료
  const handleCommentEditComplete = async (content: string) => {
    if (!editingComment || !user) return;

    try {
      const { updateComment } = await import('../../../../../../lib/boards');
      await updateComment(postId, editingComment.commentId, content, user.uid);
      
      setEditingComment(null);
      await loadCommentAndReplies();
      Alert.alert('성공', '댓글이 수정되었습니다.');
    } catch (error) {
      console.error('댓글 수정 실패:', error);
      Alert.alert('오류', '댓글 수정에 실패했습니다.');
    }
  };

  const renderProfileImage = useCallback((profileImageUrl?: string, userName?: string, isAnonymous?: boolean, authorId?: string) => {
    if (isAnonymous) {
      return (
        <View style={styles.commentAvatar}>
          <Text style={styles.avatarText}>익명</Text>
        </View>
      );
    }

    const imageContent = (
      <SafeProfileImage
        uri={profileImageUrl}
        size={32}
        style={styles.safeProfileImageStyle}
        fallbackIcon="person"
        fallbackColor="#6b7280"
      />
    );

    if (!isAnonymous && authorId) {
      return (
        <TouchableOpacity
          onPress={() => router.push(`/users/${authorId}`)}
          style={styles.profileImageTouchable}
        >
          {imageContent}
        </TouchableOpacity>
      );
    }

    return imageContent;
  }, [router]);

  const renderComment = (comment: CommentWithAuthor, isReply: boolean = false) => {
    const commentStatus = comment.status || { isDeleted: false, isBlocked: false };
    const isDeleted = commentStatus.isDeleted && comment.content === '삭제된 댓글입니다.';
    const authorName = isDeleted ? '삭제된 사용자' : 
      (comment.isAnonymous ? 
        (comment.authorId === null ? 
          `${comment.anonymousAuthor?.nickname || '익명'} (비회원)` : 
          '익명') : 
        comment.author?.userName || '사용자');
    
    const isBlocked = comment.authorId && user && blockedUserIds.has(comment.authorId);
    
    if (isBlocked && comment.authorId) {
      return (
        <View key={comment.id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
          <BlockedUserContent
            blockedUserId={comment.authorId}
            blockedUserName={comment.author?.userName || '사용자'}
            contentType="comment"
            onUnblock={() => handleUnblock(comment.authorId!)}
          >
            <View style={styles.blockedCommentContent}>
              <Text style={styles.blockedCommentText}>차단한 사용자의 댓글입니다</Text>
              <Text style={styles.blockedUserName}>@{comment.author?.userName || '사용자'}</Text>
            </View>
          </BlockedUserContent>
        </View>
      );
    }

    return (
      <View key={comment.id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
        <View style={styles.commentHeader}>
          <View style={styles.commentHeaderLeft}>
            {renderProfileImage(
              comment.author?.profileImageUrl,
              comment.author?.userName,
              comment.isAnonymous,
              comment.authorId || undefined
            )}
            {!comment.isAnonymous && comment.authorId ? (
              <TouchableOpacity
                onPress={() => router.push(`/users/${comment.authorId!}`)}
                style={styles.authorNameTouchable}
              >
                <Text style={[styles.commentAuthor, styles.clickableAuthor]}>{authorName}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.commentAuthor}>{authorName}</Text>
            )}
            <Text style={styles.commentDate}>
              {formatRelativeTime(comment.createdAt)}
            </Text>
          </View>
          
          {(user || (comment.isAnonymous && !comment.authorId)) && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => handleCommentMorePress(comment)}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.commentContent}>
          {(editingComment?.commentId === comment.id || editingAnonymousComment?.commentId === comment.id) ? (
            <View style={styles.editingContainer}>
              <TextInput
                style={styles.editingInput}
                value={editingComment?.commentId === comment.id ? editingComment.content : editingAnonymousComment?.content || ''}
                onChangeText={(text) => {
                  if (editingComment?.commentId === comment.id) {
                    setEditingComment(prev => prev ? { ...prev, content: text } : null);
                  } else if (editingAnonymousComment?.commentId === comment.id) {
                    setEditingAnonymousComment(prev => prev ? { ...prev, content: text } : null);
                  }
                }}
                multiline
                autoFocus
                placeholder="댓글을 입력하세요..."
              />
              <View style={styles.editingActions}>
                <TouchableOpacity
                  style={styles.editingSaveButton}
                  onPress={() => {
                    if (editingComment?.commentId === comment.id) {
                      handleCommentEditComplete(editingComment.content);
                    } else if (editingAnonymousComment?.commentId === comment.id) {
                      handleAnonymousCommentEditComplete();
                    }
                  }}
                >
                  <Text style={styles.editingSaveButtonText}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editingCancelButton}
                  onPress={() => {
                    setEditingComment(null);
                    setEditingAnonymousComment(null);
                  }}
                >
                  <Text style={styles.editingCancelButtonText}>취소</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Hyperlink
              linkDefault={true}
              linkStyle={styles.linkText}
              onPress={(url, text) => {
                Linking.openURL(url).catch((err) => {
                  console.error('링크 열기 실패:', err);
                  Alert.alert('오류', '링크를 열 수 없습니다.');
                });
              }}
            >
              <Text style={[styles.commentText, isDeleted && styles.deletedCommentText]}>
                {isDeleted ? '삭제된 댓글입니다.' : parseContentText(comment.content)}
              </Text>
            </Hyperlink>
          )}
          
          {!isDeleted && !(editingComment?.commentId === comment.id || editingAnonymousComment?.commentId === comment.id) && (
            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCommentLike(comment.id)}
              >
                <Ionicons 
                  name={commentLikeStatuses[comment.id] ? "heart" : "heart-outline"} 
                  size={14} 
                  color={commentLikeStatuses[comment.id] ? "#ef4444" : "#6b7280"} 
                />
                <Text style={[styles.actionButtonText, commentLikeStatuses[comment.id] && styles.likedText]}>
                  {comment.stats.likeCount}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  useEffect(() => {
    loadCommentAndReplies();
  }, [commentId]);

  useEffect(() => {
    if (user?.uid) {
      loadBlockedUsers();
    }
  }, [user?.uid, loadBlockedUsers]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>댓글을 불러오는 중...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!parentComment) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>댓글을 찾을 수 없습니다.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <CustomHeader 
          title="댓글" 
          onBack={() => router.back()} 
          insets={insets}
        />

        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollViewContent,
              { paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom + 20, 40) : 40 }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* 부모 댓글 */}
            <View style={styles.parentCommentSection}>
              {renderComment(parentComment, false)}
            </View>

            {/* 답글 섹션 */}
            {replies.length > 0 && (
              <View style={styles.repliesSection}>
                <View style={styles.repliesSectionHeader}>
                  <Text style={styles.repliesTitle}>답글</Text>
                  <View style={styles.repliesBadge}>
                    <Text style={styles.repliesBadgeText}>{replies.length}</Text>
                  </View>
                </View>
                {replies.map((reply) => renderComment(reply, true))}
              </View>
            )}
          </ScrollView>

          {/* 답글 작성 - 하단 고정 */}
          {user && (
            <View style={[
              styles.commentInputContainer,
              { paddingBottom: insets.bottom || 12 }
            ]}>
              <View style={styles.commentOptions}>
                <TouchableOpacity
                  style={styles.anonymousToggle}
                  onPress={() => setIsAnonymous(!isAnonymous)}
                >
                  <Ionicons 
                    name={isAnonymous ? "checkbox" : "square-outline"} 
                    size={20} 
                    color={isAnonymous ? "#10b981" : "#6b7280"} 
                  />
                  <Text style={[
                    styles.anonymousToggleText,
                    isAnonymous && styles.anonymousToggleTextActive
                  ]}>
                    익명
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.commentInputWrapper}>
                {!isAnonymous && renderProfileImage(
                  user?.profile?.profileImageUrl,
                  user?.profile?.userName,
                  false
                )}
                {isAnonymous && (
                  <View style={[styles.commentAvatar, styles.anonymousAvatar]}>
                    <Ionicons name="person-outline" size={20} color="#6b7280" />
                  </View>
                )}
                <TextInput
                  style={styles.commentInput}
                  placeholder="답글을 입력해 주세요..."
                  value={replyContent}
                  onChangeText={setReplyContent}
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity 
                  style={styles.commentSubmitButton}
                  onPress={handleReplySubmit}
                  disabled={isSubmitting || !replyContent.trim()}
                >
                  <Ionicons 
                    name="send" 
                    size={20} 
                    color={isSubmitting || !replyContent.trim() ? "#9ca3af" : "#10b981"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* 경험치 획득 모달 */}
        {experienceData && (
          <ExperienceModal
            visible={showExperienceModal}
            onClose={() => {
              setShowExperienceModal(false);
              setExperienceData(null);
            }}
            data={experienceData}
          />
        )}

        {/* 익명 댓글 비밀번호 확인 모달 */}
        {passwordModalData && (
          <AnonymousPasswordModal
            visible={showPasswordModal}
            onClose={() => {
              setShowPasswordModal(false);
              setPasswordModalData(null);
            }}
            onSuccess={handlePasswordVerifySuccess}
            postId={postId}
            commentId={passwordModalData.commentId}
            action={passwordModalData.action}
          />
        )}
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
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 8,
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
    // paddingBottom은 동적으로 적용됨
  },
  parentCommentSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  repliesSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  repliesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  repliesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  repliesBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  repliesBadgeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  commentContainer: {
    marginBottom: 12,
  },
  replyContainer: {
    marginLeft: 24,
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  anonymousAvatar: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 8,
  },
  clickableAuthor: {
    color: '#3b82f6',
  },
  commentDate: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  moreButton: {
    padding: 8,
    marginLeft: 8,
  },
  commentContent: {
    marginLeft: 32,
    marginTop: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  deletedCommentText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  likedText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 4,
  },
  commentInputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
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
  commentOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    gap: 4,
  },
  anonymousToggleText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  anonymousToggleTextActive: {
    color: '#10b981',
  },
  editingContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editingInput: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  editingSaveButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editingSaveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editingCancelButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editingCancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  linkText: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  profileImageTouchable: {
    borderRadius: 16,
  },
  authorNameTouchable: {
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  safeProfileImageStyle: {},
  blockedCommentContent: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
  },
  blockedCommentText: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  blockedUserName: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '600',
  },
});

