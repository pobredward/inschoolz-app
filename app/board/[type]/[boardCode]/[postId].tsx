import React, { useState, useEffect, useCallback } from 'react';
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
  Dimensions,
  StatusBar
} from 'react-native';

const { width } = Dimensions.get('window');
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BoardType, Post, Comment, Board } from '@/types';
import { getBoardsByType, deleteAnonymousComment, toggleCommentLike, checkMultipleCommentLikeStatus } from '@/lib/boards';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, where, orderBy, Timestamp, updateDoc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import AnonymousCommentForm from '../../../../components/ui/AnonymousCommentForm';
import AnonymousPasswordModal from '../../../../components/ui/AnonymousPasswordModal';
import AnonymousCommentEditor from '../../../../components/ui/AnonymousCommentEditor';
import { PollVoting } from '../../../../components/ui/PollVoting';
// 유틸리티 함수 import
import { formatRelativeTime, formatAbsoluteTime, toTimestamp } from '../../../../utils/timeUtils';

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

const extractAllImageUrls = (content: string): string[] => {
  if (!content) return [];
  const imageUrls: string[] = [];
  const imgTagMatches = content.matchAll(/<img[^>]+src="([^"]+)"/gi);
  for (const match of imgTagMatches) {
    imageUrls.push(match[1]);
  }
  return [...new Set(imageUrls)];
};
import HtmlRenderer from '@/components/HtmlRenderer';
import { awardCommentExperience } from '@/lib/experience-service';
import { ReportButton } from '@/components/ui/ReportButton';
import { ReportModal } from '@/components/ui/ReportModal';
import { ExperienceModal } from '@/components/ui/ExperienceModal';
import { 
  createPostCommentNotification, 
  createCommentReplyNotification 
} from '../../../../lib/notifications';

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
      <Ionicons name="arrow-back" size={20} color="#111827" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    {showMenu ? (
      <TouchableOpacity style={styles.headerButton} onPress={onMenuPress}>
        <Ionicons name="ellipsis-vertical" size={20} color="#111827" />
      </TouchableOpacity>
    ) : (
      <View style={styles.headerButton} />
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

  // 익명 댓글 관련 상태
  const [showAnonymousForm, setShowAnonymousForm] = useState(false);
  
  // 댓글 좋아요 상태 관리
  const [commentLikeStatuses, setCommentLikeStatuses] = useState<Record<string, boolean>>({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalData, setPasswordModalData] = useState<{
    commentId: string;
    action: 'edit' | 'delete';
  } | null>(null);
  const [editingAnonymousComment, setEditingAnonymousComment] = useState<{
    commentId: string;
    content: string;
    password: string;
  } | null>(null);

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
  
  // 좋아요/스크랩 상태
  const [isLiked, setIsLiked] = useState(false);
  const [isScrapped, setIsScrapped] = useState(false);
  const [scrapCount, setScrapCount] = useState(0);

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

  // 사용자 액션 상태 확인 (좋아요/북마크)
  const checkUserActions = async (postId: string, userId: string) => {
    try {
      // 좋아요 상태 확인
      const likesRef = collection(db, 'posts', postId, 'likes');
      const likeQuery = query(likesRef, where('userId', '==', userId));
      const likeSnapshot = await getDocs(likeQuery);
      setIsLiked(!likeSnapshot.empty);

      // 스크랩 상태 확인 (users 컬렉션 기반)
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const scraps = userData.scraps || [];
        setIsScrapped(scraps.includes(postId));
      }
    } catch (error) {
      console.error('사용자 액션 상태 확인 실패:', error);
    }
  };

  // 좋아요 토글
  const handleLike = async () => {
    if (!user || !post) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const likesRef = collection(db, 'posts', post.id, 'likes');
      const likeQuery = query(likesRef, where('userId', '==', user.uid));
      const likeSnapshot = await getDocs(likeQuery);

      if (!likeSnapshot.empty) {
        // 좋아요 취소
        const likeDoc = likeSnapshot.docs[0];
        await deleteDoc(doc(db, 'posts', post.id, 'likes', likeDoc.id));
        
        // 게시글 좋아요 수 감소
        await updateDoc(doc(db, 'posts', post.id), {
          'stats.likeCount': increment(-1)
        });
        
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        // 좋아요 추가
        await addDoc(likesRef, {
          userId: user.uid,
          postId: post.id,
          createdAt: serverTimestamp()
        });
        
        // 게시글 좋아요 수 증가
        await updateDoc(doc(db, 'posts', post.id), {
          'stats.likeCount': increment(1)
        });
        
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
      Alert.alert('오류', '좋아요 처리에 실패했습니다.');
    }
  };

  // 스크랩 토글 (새로운 API 함수 사용)
  const handleScrap = async () => {
    if (!user || !post) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const { togglePostScrap } = await import('../../../../lib/boards');
      const result = await togglePostScrap(post.id, user.uid);
      
      setIsScrapped(result.scrapped);
      setScrapCount(result.scrapCount);
      Alert.alert('알림', result.scrapped ? '스크랩에 추가했습니다.' : '스크랩을 해제했습니다.');
    } catch (error) {
      console.error('스크랩 처리 실패:', error);
      Alert.alert('오류', '스크랩 처리에 실패했습니다.');
    }
  };

  // 공유 기능 (링크 복사)
  const handleShare = async () => {
    if (!post) return;

    try {
      let shareUrl = '';
      
      // 웹 버전과 일치하는 URL 구조로 생성
      if (type === 'national') {
        shareUrl = `https://inschoolz.com/community/national/${boardCode}/${post.id}`;
      } else if (type === 'regional' && post.regions) {
        shareUrl = `https://inschoolz.com/community/region/${encodeURIComponent(post.regions.sido)}/${encodeURIComponent(post.regions.sigungu)}/${boardCode}/${post.id}`;
      } else if (type === 'school' && post.schoolId) {
        shareUrl = `https://inschoolz.com/community/school/${post.schoolId}/${boardCode}/${post.id}`;
      } else {
        // fallback for unknown types
        shareUrl = `https://inschoolz.com/community/national/${boardCode}/${post.id}`;
      }
      
      // 플랫폼별 클립보드 복사 처리
      if (Platform.OS === 'web') {
        // 웹 환경에서 클립보드 API 사용
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareUrl);
            Alert.alert('📋 공유 완료', '게시글 링크가 복사되었습니다!\n다른 곳에 붙여넣기해서 공유해보세요.');
          } else {
            // fallback 방법
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Alert.alert('📋 공유 완료', '게시글 링크가 복사되었습니다!');
          }
        } catch (clipboardError) {
          Alert.alert(
            '게시글 링크', 
            `다음 링크를 복사해서 공유하세요:\n\n${shareUrl}`,
            [
              { text: '확인', style: 'default' }
            ]
          );
        }
      } else {
        // 모바일 환경에서는 실제 클립보드 복사
        try {
          await Clipboard.setStringAsync(shareUrl);
          Alert.alert('📋 공유 완료', '게시글 링크가 복사되었습니다!\n다른 앱에서 붙여넣기하여 공유해보세요.');
        } catch (clipboardError) {
          console.error('클립보드 복사 실패:', clipboardError);
          // 복사 실패 시 URL을 직접 표시
          Alert.alert(
            '📋 게시글 공유',
            `링크를 수동으로 복사해주세요:\n\n${shareUrl}`,
            [
              { text: '확인', style: 'default' }
            ]
          );
        }
      }
    } catch (error) {
      console.error('공유 실패:', error);
      Alert.alert('❌ 오류', '공유에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const loadPostDetail = async () => {
    try {
      setIsLoading(true);
      
      // 게시글 상세 정보 가져오기 (조회수 증가 없이)
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        Alert.alert('오류', '게시글을 찾을 수 없습니다.');
        router.back();
        return;
      }

      const postData = { id: postDoc.id, ...postDoc.data() } as Post;
      
      // 조회수 증가 (별도 처리)
      try {
        await updateDoc(postRef, {
          'stats.viewCount': increment(1),
          updatedAt: serverTimestamp()
        });
        // UI에 반영할 조회수 업데이트
        postData.stats.viewCount = (postData.stats.viewCount || 0) + 1;
      } catch (viewError) {
        console.error('조회수 증가 실패:', viewError);
        // 조회수 증가 실패는 무시하고 계속 진행
      }
      
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

      // authorInfo가 없거나 profileImageUrl이 없는 경우 사용자 정보 업데이트
      if (!postData.authorInfo?.profileImageUrl && !postData.authorInfo?.isAnonymous && postData.authorId) {
        try {
          const { getUserById } = await import('../../../../lib/users');
          const userDoc = await getUserById(postData.authorId);
          if (userDoc && userDoc.profile) {
            postData.authorInfo = {
              ...postData.authorInfo,
              displayName: postData.authorInfo?.displayName || userDoc.profile.userName || '사용자',
              profileImageUrl: userDoc.profile.profileImageUrl || '',
              isAnonymous: postData.authorInfo?.isAnonymous || false
            };
          }
        } catch (userError) {
          console.warn('사용자 정보 업데이트 실패:', userError);
        }
      }

      // 댓글 가져오기 (사용자 정보 포함)
      await loadComments(postId);

      setPost(postData);
      setBoard(boardData);
      setLikeCount(postData.stats.likeCount);
      setScrapCount(postData.stats.scrapCount || 0);
      
      // 좋아요/스크랩 상태 확인
      if (user) {
        await checkUserActions(postId, user.uid);
      }
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
        orderBy('createdAt', 'asc')
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
        
        // 익명 댓글 처리
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
          
          // 익명 대댓글 처리
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
          
          replies.push({
            ...replyData,
            author: replyAuthorInfo
          });
        }
        
        // 대댓글도 시간순으로 정렬
        replies.sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
        
        commentsData.push({
          ...commentData,
          author: authorInfo,
          replies
        });
      }

      // 모든 댓글을 시간순으로 확실히 정렬 (익명 댓글 포함)
      commentsData.sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));

      setComments(commentsData);
      
      // 로그인한 사용자인 경우 댓글 좋아요 상태 확인
      if (user?.uid && commentsData.length > 0) {
        const allCommentIds: string[] = [];
        
        // 모든 댓글과 대댓글의 ID 수집
        commentsData.forEach(comment => {
          allCommentIds.push(comment.id);
          if (comment.replies) {
            comment.replies.forEach(reply => {
              allCommentIds.push(reply.id);
            });
          }
        });
        
        try {
          const likeStatuses = await checkMultipleCommentLikeStatus(postId, allCommentIds, user.uid);
          setCommentLikeStatuses(likeStatuses);
        } catch (error) {
          console.error('댓글 좋아요 상태 확인 실패:', error);
        }
      }
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    }
  };

  const formatDate = (timestamp: unknown) => {
    return formatAbsoluteTime(timestamp, 'datetime');
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
                { text: '확인', onPress: () => router.back() }
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
            setReportTargetContent(JSON.stringify({ title: post.title, content: post.content }));
            setReportPostId('');
            setShowReportModal(true);
          }, style: 'destructive' as const },
          { text: '차단하기', onPress: async () => {
            if (!user || !post.authorId) {
              Alert.alert('알림', '로그인이 필요합니다.');
              return;
            }

            if (post.authorId === user.uid) {
              Alert.alert('알림', '자기 자신을 차단할 수 없습니다.');
              return;
            }

            Alert.alert(
              '사용자 차단',
              `${post.authorInfo?.displayName}님을 차단하시겠습니까?`,
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '차단',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { toggleBlock } = await import('../../../../lib/users');
                      const result = await toggleBlock(user.uid, post.authorId);
                      Alert.alert('완료', result.isBlocked ? '사용자를 차단했습니다.' : '차단을 해제했습니다.');
                    } catch (error) {
                      console.error('차단 처리 실패:', error);
                      Alert.alert('오류', '차단 처리에 실패했습니다.');
                    }
                  }
                }
              ]
            );
          }}
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
        createdAt: serverTimestamp(),
        stats: {
          likeCount: 0
        },
        status: {
          isDeleted: false,
          isBlocked: false
        }
      };

      const docRef = await addDoc(collection(db, 'posts', post.id, 'comments'), commentData);
      
      // 게시글의 댓글 수 증가
      await updateDoc(doc(db, 'posts', post.id), {
        'stats.commentCount': increment(1)
      });
      
      // 댓글 목록 새로고침
      await loadComments(post.id);
      setNewComment('');

      // 알림 발송 로직 (게시글 작성자가 자기 자신이 아닌 경우)
      try {
        if (post.authorId !== user.uid) {
          await createPostCommentNotification(
            post.authorId,    // 게시글 작성자 ID
            user.uid,         // 댓글 작성자 ID
            post.id,          // 게시글 ID
            docRef.id,        // 댓글 ID
            post.title || '제목 없음',  // 게시글 제목
            newComment        // 댓글 내용
          );
        }
      } catch (notificationError) {
        console.error('알림 발송 실패:', notificationError);
        // 알림 발송 실패는 댓글 작성을 방해하지 않음
      }
      
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
        createdAt: serverTimestamp(),
        stats: {
          likeCount: 0
        },
        status: {
          isDeleted: false,
          isBlocked: false
        }
      };

      const docRef = await addDoc(collection(db, 'posts', post.id, 'comments'), replyData);
      
      // 게시글의 댓글 수 증가 (답글도 댓글 수에 포함)
      await updateDoc(doc(db, 'posts', post.id), {
        'stats.commentCount': increment(1)
      });
      
      // 댓글 목록 새로고침
      await loadComments(post.id);
      setReplyContent('');
      setReplyingTo(null);

      // 알림 발송 로직 (부모 댓글 작성자에게)
      try {
        // 부모 댓글 정보 조회
        const parentCommentDoc = await getDoc(doc(db, 'posts', post.id, 'comments', parentId));
        
        if (parentCommentDoc.exists()) {
          const parentCommentData = parentCommentDoc.data();
          const parentAuthorId = parentCommentData?.authorId;
          
          // 부모 댓글 작성자가 자기 자신이 아닌 경우 알림 발송
          if (parentAuthorId && parentAuthorId !== user.uid) {
            // 대댓글 작성자명 처리 (익명 여부 고려)
            const commenterName = false  // 현재 앱에서는 익명 기능이 비활성화되어 있음
              ? '익명' 
              : (user.profile?.userName || '사용자');
              
            await createCommentReplyNotification(
              parentAuthorId,
              post.id,
              post.title || '제목 없음',
              parentId,
              commenterName,
              replyContent,
              docRef.id
            );
          }
        }
      } catch (notificationError) {
        console.error('알림 발송 실패:', notificationError);
        // 알림 발송 실패는 답글 작성을 방해하지 않음
      }
      
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

  // 익명 댓글 성공 핸들러
  const handleAnonymousCommentSuccess = async () => {
    setShowAnonymousForm(false);
    if (post) {
      await loadComments(post.id);
    }
  };

  // 익명 댓글 비밀번호 확인 성공 핸들러
  const handlePasswordVerifySuccess = (verifiedPassword: string) => {
    if (!passwordModalData) return;

    const { commentId, action } = passwordModalData;
    
    if (action === 'edit') {
      // 수정 모드로 전환
      const comment = findCommentById(commentId);
      if (comment) {
        setEditingAnonymousComment({
          commentId,
          content: comment.content,
          password: verifiedPassword, // 검증된 비밀번호 저장
        });
      }
    } else if (action === 'delete') {
      // 삭제 실행
      handleAnonymousCommentDelete(commentId, verifiedPassword);
    }

    setShowPasswordModal(false);
    setPasswordModalData(null);
  };

  // 댓글 찾기 함수
  const findCommentById = (commentId: string): CommentWithAuthor | null => {
    for (const comment of comments) {
      if (comment.id === commentId) return comment;
      if (comment.replies) {
        for (const reply of comment.replies) {
          if (reply.id === commentId) return reply;
        }
      }
    }
    return null;
  };

  // 익명 댓글 삭제
  const handleAnonymousCommentDelete = async (commentId: string, password: string) => {
    if (!post) return;

    try {
      await deleteAnonymousComment(post.id, commentId, password);
      Alert.alert('성공', '댓글이 삭제되었습니다.');
      await loadComments(post.id);
    } catch (error) {
      console.error('익명 댓글 삭제 실패:', error);
      Alert.alert('오류', '댓글 삭제에 실패했습니다.');
    }
  };

  // 익명 댓글 수정 완료
  const handleAnonymousCommentEditComplete = async () => {
    setEditingAnonymousComment(null);
    if (post) {
      await loadComments(post.id);
    }
  };

  // 댓글 좋아요 토글
  const handleCommentLike = async (commentId: string) => {
    if (!user?.uid) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const result = await toggleCommentLike(postId, commentId, user.uid);
      
      // 좋아요 상태 즉시 업데이트
      setCommentLikeStatuses(prev => ({
        ...prev,
        [commentId]: result.liked
      }));
      
      // 댓글 좋아요 수 업데이트
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            stats: {
              ...comment.stats,
              likeCount: result.likeCount
            }
          };
        }
        // 대댓글 확인
        if (comment.replies) {
          const updatedReplies = comment.replies.map(reply => {
            if (reply.id === commentId) {
              return {
                ...reply,
                stats: {
                  ...reply.stats,
                  likeCount: result.likeCount
                }
              };
            }
            return reply;
          });
          return {
            ...comment,
            replies: updatedReplies
          };
        }
        return comment;
      }));
      
    } catch (error) {
      console.error('댓글 좋아요 처리 실패:', error);
      Alert.alert('오류', '좋아요 처리에 실패했습니다.');
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
    const authorName = isDeleted ? '삭제된 사용자' : 
      (comment.isAnonymous ? 
        (comment.authorId === null ? 
          `${comment.anonymousAuthor?.nickname || '익명'} (비회원)` : 
          '익명') : 
        comment.author?.userName || '사용자');
    const maxLevel = 1; // 최대 1단계 대댓글까지만 허용
    
    return (
      <View key={comment.id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
        <View style={styles.commentWrapper}>
          {comment.isAnonymous && comment.authorId === null ? (
            <View style={[styles.commentAvatar, styles.anonymousAvatar]}>
              <Ionicons name="person-outline" size={16} color="#22c55e" />
            </View>
          ) : (
            <TouchableOpacity 
              onPress={() => comment.authorId && router.push(`/users/${comment.authorId}`)}
            >
              {renderProfileImage(comment.author?.profileImageUrl, authorName, comment.isAnonymous)}
            </TouchableOpacity>
          )}
      
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <View style={styles.commentAuthorRow}>
                {comment.isAnonymous && comment.authorId === null ? (
                  <Text style={styles.commentAuthor}>
                    {authorName}
                  </Text>
                ) : (
                  <TouchableOpacity 
                    onPress={() => comment.authorId && router.push(`/users/${comment.authorId}`)}
                  >
                    <Text style={[styles.commentAuthor, styles.clickableAuthor]}>
                      {authorName}
                    </Text>
                  </TouchableOpacity>
                )}
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
                          // 회원 댓글인 경우 (자신의 댓글)
                          ...(user?.uid === comment.authorId ? [
                            { text: '수정', onPress: () => {} },
                            { text: '삭제', onPress: async () => {
                              try {
                                // 대댓글이 있는지 확인
                                const hasReplies = comments.some(c => c.parentId === comment.id);
                                
                                if (hasReplies) {
                                  // 대댓글이 있으면 소프트 삭제
                                  await updateDoc(doc(db, 'posts', postId, 'comments', comment.id), {
                                    'status.isDeleted': true,
                                    content: '삭제된 댓글입니다.',
                                    updatedAt: serverTimestamp()
                                  });
                                } else {
                                  // 대댓글이 없으면 완전 삭제
                                  await deleteDoc(doc(db, 'posts', postId, 'comments', comment.id));
                                }
                                
                                // 게시글의 댓글 수 감소
                                await updateDoc(doc(db, 'posts', postId), {
                                  'stats.commentCount': increment(-1)
                                });
                                
                                Alert.alert('성공', '댓글이 삭제되었습니다.');
                                // 댓글 목록 새로고침
                                await loadComments(postId);
                              } catch (error) {
                                console.error('댓글 삭제 실패:', error);
                                Alert.alert('오류', '댓글 삭제에 실패했습니다.');
                              }
                            }, style: 'destructive' as const },
                          ] : 
                          // 익명 댓글인 경우
                          comment.isAnonymous && comment.authorId === null ? [
                            { text: '수정 (비밀번호 필요)', onPress: () => {
                              setPasswordModalData({ commentId: comment.id, action: 'edit' });
                              setShowPasswordModal(true);
                            }},
                            { text: '삭제 (비밀번호 필요)', onPress: () => {
                              setPasswordModalData({ commentId: comment.id, action: 'delete' });
                              setShowPasswordModal(true);
                            }, style: 'destructive' as const },
                          ] : [
                            // 다른 사람의 댓글인 경우
                            { text: '신고', onPress: () => {
                              setReportTargetId(comment.id);
                              setReportTargetType('comment');
                              setReportTargetContent(comment.content);
                              setReportPostId(postId);
                              setShowReportModal(true);
                            }, style: 'destructive' as const },
                            { text: '차단하기', onPress: async () => {
                              if (!user || !comment.authorId) {
                                Alert.alert('알림', '로그인이 필요합니다.');
                                return;
                              }

                              if (comment.authorId === user.uid) {
                                Alert.alert('알림', '자기 자신을 차단할 수 없습니다.');
                                return;
                              }

                              Alert.alert(
                                '사용자 차단',
                                `${comment.author?.userName}님을 차단하시겠습니까?`,
                                [
                                  { text: '취소', style: 'cancel' },
                                  {
                                    text: '차단',
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        const { toggleBlock } = await import('../../../../lib/users');
                                        const result = await toggleBlock(user.uid, comment.authorId!);
                                        Alert.alert('완료', result.isBlocked ? '사용자를 차단했습니다.' : '차단을 해제했습니다.');
                                      } catch (error) {
                                        console.error('차단 처리 실패:', error);
                                        Alert.alert('오류', '차단 처리에 실패했습니다.');
                                      }
                                    }
                                  }
                                ]
                              );
                            }},
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
                <TouchableOpacity 
                  style={styles.commentAction}
                  onPress={() => handleCommentLike(comment.id)}
                >
                  <Ionicons 
                    name={commentLikeStatuses[comment.id] ? "heart" : "heart-outline"} 
                    size={14} 
                    color={commentLikeStatuses[comment.id] ? "#ef4444" : "#64748b"} 
                  />
                  <Text style={[
                    styles.commentActionText,
                    commentLikeStatuses[comment.id] && { color: "#ef4444" }
                  ]}>
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
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!post || !board) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>게시글을 찾을 수 없습니다.</Text>
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
                {post.attachments && post.attachments.length > 0 && (
                  <View style={styles.imageBadgeContainer}>
                    <Text style={styles.imageBadgeText}>📷 사진 {post.attachments.filter(att => att.type === 'image').length}</Text>
                  </View>
                )}
                {post.poll && (
                  <View style={styles.pollBadgeContainer}>
                    <Text style={styles.pollBadgeText}>📊 투표</Text>
                  </View>
                )}
              </View>

              {/* 제목 */}
              <Text style={styles.postTitle}>{post.title}</Text>

              {/* 작성자 정보 */}
              {post.authorInfo?.isAnonymous ? (
                <View style={styles.authorInfo}>
                  <View style={styles.authorAvatarContainer}>
                    <View style={styles.authorAvatarPlaceholder}>
                      <Text style={styles.authorAvatarText}>익명</Text>
                    </View>
                  </View>
                  <View style={styles.authorTextInfo}>
                    <Text style={styles.authorName}>익명</Text>
                    <View style={styles.authorMetaInfo}>
                      <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.authorInfo}
                  onPress={() => router.push(`/users/${post.authorId}`)}
                >
                  <View style={styles.authorAvatarContainer}>
                    {post.authorInfo?.profileImageUrl ? (
                      <Image 
                        source={{ uri: post.authorInfo.profileImageUrl }} 
                        style={styles.authorAvatar}
                      />
                    ) : (
                      <View style={styles.authorAvatarPlaceholder}>
                        <Text style={styles.authorAvatarText}>
                          {post.authorInfo?.displayName?.substring(0, 1) || 'U'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.authorTextInfo}>
                    <Text style={styles.authorName}>
                      {post.authorInfo?.displayName || '사용자'}
                    </Text>
                    <View style={styles.authorMetaInfo}>
                      <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* 내용 (HTML 렌더링으로 인라인 이미지 포함) */}
              <HtmlRenderer 
                html={post.content} 
                contentWidth={width - 32}
                baseStyle={styles.postContent}
              />

              {/* 투표 */}
              {post.poll && (
                <PollVoting 
                  postId={post.id} 
                  poll={post.poll}
                  onVoteUpdate={(updatedPoll) => {
                    // 투표 업데이트 시 post 상태도 업데이트
                    setPost(prev => prev ? { ...prev, poll: updatedPoll } : null);
                  }}
                />
              )}

              {/* 액션 버튼 */}
              <View style={styles.actionButtons}>
                {/* 왼쪽: 조회수, 댓글 */}
                <View style={styles.actionButtonsLeft}>
                  <View style={styles.actionButton}>
                    <Ionicons name="eye-outline" size={16} color="#6b7280" />
                    <Text style={styles.actionButtonText}>{post.stats.viewCount}</Text>
                  </View>
                  <View style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
                    <Text style={styles.actionButtonText}>{comments.length}</Text>
                  </View>
                </View>
                
                {/* 오른쪽: 좋아요, 스크랩, 공유 */}
                <View style={styles.actionButtonsRight}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                    <Ionicons 
                      name={isLiked ? "heart" : "heart-outline"} 
                      size={16} 
                      color={isLiked ? "#ef4444" : "#6b7280"} 
                    />
                    <Text style={[styles.actionButtonText, isLiked && { color: "#ef4444" }]}>
                      {likeCount}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={handleScrap}>
                    <Ionicons 
                      name={isScrapped ? "bookmark" : "bookmark-outline"} 
                      size={16} 
                      color={isScrapped ? "#3b82f6" : "#6b7280"} 
                    />
                    <Text style={[styles.actionButtonText, isScrapped && { color: "#3b82f6" }]}>
                      {scrapCount}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={handleShare}
                    accessibilityLabel="게시글 공유하기"
                    accessibilityHint="이 게시글의 링크를 복사하여 다른 사람과 공유할 수 있습니다"
                  >
                    <Ionicons name="share-outline" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
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
          {user ? (
            // 로그인한 사용자용 댓글 작성
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
          ) : (
            // 비로그인 사용자용 익명 댓글 작성
            <View style={styles.anonymousCommentContainer}>
              <View style={styles.anonymousCommentButton}>
                <TouchableOpacity 
                  style={styles.anonymousButton}
                  onPress={() => setShowAnonymousForm(true)}
                >
                  <Ionicons name="person-outline" size={20} color="#22c55e" />
                  <Text style={styles.anonymousButtonText}>익명 댓글 작성</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.anonymousNotice}>
                로그인하지 않고도 댓글을 작성할 수 있습니다. 4자리 비밀번호로 수정/삭제가 가능합니다.
              </Text>
            </View>
          )}
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

        {/* 익명 댓글 작성 폼 */}
        {post && (
          <AnonymousCommentForm
            visible={showAnonymousForm}
            postId={post.id}
            onSuccess={handleAnonymousCommentSuccess}
            onCancel={() => setShowAnonymousForm(false)}
          />
        )}

        {/* 익명 댓글 비밀번호 확인 모달 */}
        {passwordModalData && post && (
          <AnonymousPasswordModal
            visible={showPasswordModal}
            onClose={() => {
              setShowPasswordModal(false);
              setPasswordModalData(null);
            }}
            onSuccess={handlePasswordVerifySuccess}
            postId={post.id}
            commentId={passwordModalData.commentId}
            action={passwordModalData.action}
          />
        )}

        {/* 익명 댓글 수정 에디터 */}
        {post && (
          <AnonymousCommentEditor
            visible={!!editingAnonymousComment}
            postId={post.id}
            commentId={editingAnonymousComment?.commentId || ''}
            initialContent={editingAnonymousComment?.content || ''}
            password={editingAnonymousComment?.password || ''}
            onSave={handleAnonymousCommentEditComplete}
            onCancel={() => setEditingAnonymousComment(null)}
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
    elevation: 0,
    shadowOpacity: 0,
  },
  headerButton: {
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
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  badgeText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
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
  authorAvatarContainer: {
    marginRight: 12,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  authorTextInfo: {
    flex: 1,
  },
  authorMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  boardTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  boardTypeBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  boardTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  postDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  viewCount: {
    fontSize: 12,
    color: '#6b7280',
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
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButtonsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
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
  
  // 익명 댓글 관련 스타일
  anonymousCommentContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  anonymousCommentButton: {
    marginBottom: 8,
  },
  anonymousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  anonymousButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  anonymousNotice: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  imageBadgeContainer: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  imageBadgeText: {
    fontSize: 12,
    color: '#c2410c',
    fontWeight: '600',
  },
  pollBadgeContainer: {
    backgroundColor: '#faf5ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  pollBadgeText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '600',
  },
  clickableAuthor: {
    color: '#3b82f6',
  },
}); 