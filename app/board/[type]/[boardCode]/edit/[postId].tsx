import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getBoard } from '@/lib/boards';
import { Board, Post } from '@/types';
import RichTextEditor from '@/components/RichTextEditor';

export default function EditPostPage() {
  const { type, boardCode, postId } = useLocalSearchParams<{
    type: string;
    boardCode: string;
    postId: string;
  }>();
  
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [board, setBoard] = useState<Board | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 게시글 및 게시판 정보 로드
  useEffect(() => {
    const loadData = async () => {
      if (!postId || !boardCode) return;
      
      try {
        setIsLoading(true);
        
        // 게시글 정보 가져오기
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        
        if (!postDoc.exists()) {
          Alert.alert('오류', '게시글을 찾을 수 없습니다.');
          router.back();
          return;
        }

        const postData = { id: postDoc.id, ...postDoc.data() } as Post;
        
        // 권한 확인
        if (!user || user.uid !== postData.authorId) {
          Alert.alert('오류', '수정 권한이 없습니다.');
          router.back();
          return;
        }

        setPost(postData);
        setTitle(postData.title);
        setContent(postData.content);
        setIsAnonymous(postData.authorInfo?.isAnonymous || false);
        
        // 게시판 정보 가져오기
        const boardData = await getBoard(boardCode);
        setBoard(boardData);
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [postId, boardCode, user, router]);

  const handleSubmit = async () => {
    if (!user || !post) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 게시글 업데이트
      await updateDoc(doc(db, 'posts', postId), {
        title: title.trim(),
        content: content.trim(),
        'authorInfo.isAnonymous': isAnonymous,
        updatedAt: Timestamp.now()
      });

      Alert.alert('성공', '게시글이 수정되었습니다.', [
        {
          text: '확인',
          onPress: () => router.push(`/board/${type}/${boardCode}/${postId}`)
        }
      ]);
    } catch (error: unknown) {
      console.error('게시글 수정 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      Alert.alert('오류', `게시글 수정에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  if (!board || !post) {
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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>게시글 수정</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || !title.trim() || !content.trim()}
            style={[
              styles.submitButton,
              (isSubmitting || !title.trim() || !content.trim()) && styles.submitButtonDisabled
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>완료</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 키보드 회피 영역 */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 제목 입력 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>제목</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="제목을 입력하세요"
                value={title}
                onChangeText={setTitle}
                multiline={false}
                maxLength={100}
              />
            </View>

            {/* 내용 입력 (Rich Text Editor) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>내용</Text>
              <View style={styles.editorContainer}>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="내용을 입력하세요..."
                />
              </View>
            </View>

            {/* 익명 옵션 */}
            {(board as any)?.allowAnonymous && (
              <View style={styles.section}>
                <View style={styles.switchContainer}>
                  <Text style={styles.sectionTitle}>익명으로 작성</Text>
                  <Switch
                    value={isAnonymous}
                    onValueChange={setIsAnonymous}
                    trackColor={{ false: '#767577', true: '#10B981' }}
                    thumbColor={isAnonymous ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>
            )}

            {/* 하단 여백 */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    flex: 1,
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
    color: '#666',
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
    marginBottom: 20,
  },
  backButton: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  editorContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    minHeight: 200,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomSpacer: {
    height: 120,
  },
}); 