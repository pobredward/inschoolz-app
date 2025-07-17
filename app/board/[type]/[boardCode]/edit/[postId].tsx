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
  StatusBar,
  SafeAreaView,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { doc, getDoc, updateDoc, deleteField, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getBoard } from '@/lib/boards';
import { Board, Post } from '@/types';
import RichTextEditor from '@/components/RichTextEditor';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/firebase';

export default function EditPostPage() {
  const { type, boardCode, postId } = useLocalSearchParams<{
    type: string;
    boardCode: string;
    postId: string;
  }>();
  
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  
  const [board, setBoard] = useState<Board | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<{ type: 'image'; url: string; name: string; size: number }[]>([]);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<{ text: string; imageUrl?: string }[]>([
    { text: '' },
    { text: '' }
  ]);

  // 게시글 및 게시판 정보 로드
  useEffect(() => {
    const loadData = async () => {
      if (!postId || !boardCode) return;
      
      // 인증 정보가 로딩 중인 경우 대기
      if (authLoading) return;
      
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
        
        // 권한 확인 - 인증 로딩이 완료된 후에만 확인
        if (!user || user.uid !== postData.authorId) {
          Alert.alert('오류', '본인이 작성한 게시글만 수정할 수 있습니다.');
          router.back();
          return;
        }

        setPost(postData);
        setTitle(postData.title);
        setContent(postData.content);
        setIsAnonymous(postData.authorInfo?.isAnonymous || false);
        
        // 기존 투표 정보 설정
        if (postData.poll) {
          setIsPollEnabled(true);
          setPollOptions(postData.poll.options.map(option => ({
            text: option.text,
            imageUrl: option.imageUrl
          })));
        }
        
        // 기존 첨부파일 정보 설정 (이미지만 필터링)
        if (postData.attachments && Array.isArray(postData.attachments)) {
          const imageAttachments = postData.attachments.filter(att => att.type === 'image') as { type: 'image'; url: string; name: string; size: number }[];
          setAttachments(imageAttachments);
        }
        
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
  }, [postId, boardCode, user, authLoading, router]);

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

    if (isPollEnabled) {
      const validOptions = pollOptions.filter(option => option.text.trim());
      if (validOptions.length < 2) {
        Alert.alert('오류', '투표 선택지를 최소 2개 이상 입력해주세요.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 게시글 업데이트 데이터 준비
      const updateData: any = {
        title: title.trim(),
        content: content.trim(),
        'authorInfo.isAnonymous': isAnonymous,
        attachments: attachments, // 업데이트된 첨부파일 정보 포함
        updatedAt: serverTimestamp()
      };

      // 투표 데이터 처리
      if (isPollEnabled && pollOptions.filter(option => option.text.trim()).length >= 2) {
        updateData.poll = {
          isActive: true,
          question: '', // 질문 없이 빈 문자열
          options: pollOptions.filter(option => option.text.trim()).map((option, index) => {
            const pollOption: any = {
              text: option.text.trim(),
              voteCount: 0,
              index
            }
            // imageUrl이 있을 때만 추가
            if (option.imageUrl) {
              pollOption.imageUrl = option.imageUrl
            }
            return pollOption
          }),
          voters: [],
        };
      } else {
        // 투표를 비활성화하면 poll 필드 삭제
        updateData.poll = deleteField();
      }



      // 게시글 업데이트
      await updateDoc(doc(db, 'posts', postId), updateData);

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

  // 이미지 업로드 핸들러
  const handleImageUpload = (attachment: { type: 'image'; url: string; name: string; size: number }) => {
    setAttachments(prev => [...prev, attachment]);
  };

  // 이미지 삭제 핸들러
  const handleImageRemove = (imageUrl: string) => {
    console.log('이미지 삭제:', imageUrl);
    setAttachments(prev => prev.filter(attachment => attachment.url !== imageUrl));
  };

  // 투표 옵션 관련 함수들
  const addPollOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, { text: '' }]);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, text: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = { ...newOptions[index], text };
    setPollOptions(newOptions);
  };

  const updatePollOptionImage = (index: number, imageUrl?: string) => {
    const newOptions = [...pollOptions];
    if (imageUrl) {
      newOptions[index] = { ...newOptions[index], imageUrl };
    } else {
      // imageUrl이 undefined일 때는 속성을 완전히 제거
      const { imageUrl: _, ...optionWithoutImage } = newOptions[index];
      newOptions[index] = optionWithoutImage;
    }
    setPollOptions(newOptions);
  };

  // 투표 옵션 이미지 선택 및 크롭
  const handlePollOptionImageUpload = async (index: number) => {
    try {
      // 권한 확인
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '이미지를 선택하려면 갤러리 접근 권한이 필요합니다.');
        return;
      }

      // expo-image-picker를 사용하여 이미지 선택 및 크롭
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // 정사각형 비율
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Firebase Storage에 업로드
        const imageUrl = await uploadImage(result.assets[0].uri);
        
        // 투표 옵션에 이미지 URL 설정
        updatePollOptionImage(index, imageUrl);
      }
    } catch (error: any) {
      console.error('이미지 선택 오류:', error);
      Alert.alert('오류', '이미지를 선택하는 중 오류가 발생했습니다.');
    }
  };

  // 투표 옵션 이미지 제거
  const removePollOptionImage = (index: number) => {
    updatePollOptionImage(index, undefined);
  };

  if (isLoading || authLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>
            {authLoading ? '사용자 정보를 확인하고 있습니다...' : '게시글을 불러오는 중...'}
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!board || !post) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {!user ? '로그인이 필요합니다.' : '게시글을 불러올 수 없습니다.'}
          </Text>
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
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#333" />
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
                  onImageUpload={handleImageUpload}
                  onImageRemove={handleImageRemove}
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

            {/* 투표 섹션 */}
            {(board as any)?.allowPolls && (
              <View style={styles.section}>
                <View style={styles.switchContainer}>
                  <Text style={styles.sectionTitle}>투표 만들기</Text>
                  <Switch
                    value={isPollEnabled}
                    onValueChange={setIsPollEnabled}
                    trackColor={{ false: '#767577', true: '#10B981' }}
                    thumbColor={isPollEnabled ? '#fff' : '#f4f3f4'}
                  />
                </View>

                {isPollEnabled && (
                  <View style={styles.pollSection}>
                    <Text style={styles.pollSectionTitle}>투표 선택지</Text>
                    {pollOptions.map((option, index) => (
                      <View key={index} style={[styles.pollOptionContainer, { minHeight: 100 }]}>
                        <View style={styles.pollOptionContent}>
                          <TextInput
                            style={styles.pollOptionInput}
                            placeholder={`선택지 ${index + 1}`}
                            value={option.text}
                            onChangeText={(text) => updatePollOption(index, text)}
                            multiline
                            maxLength={100}
                          />
                          
                          {/* 투표 옵션 이미지 영역 */}
                          <View style={styles.pollImageContainer}>
                            {option.imageUrl ? (
                              <View style={styles.pollImageWrapper}>
                                <Image
                                  source={{ uri: option.imageUrl }}
                                  style={[styles.pollImage, { width: 80, height: 100 }]}
                                  resizeMode="cover"
                                />
                                <TouchableOpacity
                                  style={styles.pollImageRemoveButton}
                                  onPress={() => removePollOptionImage(index)}
                                >
                                  <Ionicons name="close" size={16} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.pollImageAddButton}
                                onPress={() => handlePollOptionImageUpload(index)}
                              >
                                <Ionicons name="camera" size={20} color="#10B981" />
                                <Text style={styles.pollImageAddText}>이미지</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        
                        {/* 옵션 삭제 버튼 */}
                        {pollOptions.length > 2 && (
                          <TouchableOpacity
                            style={styles.pollOptionRemoveButton}
                            onPress={() => removePollOption(index)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    
                    {/* 옵션 추가 버튼 */}
                    {pollOptions.length < 5 && (
                      <TouchableOpacity style={styles.addPollOptionButton} onPress={addPollOption}>
                        <Ionicons name="add" size={20} color="#10B981" />
                        <Text style={styles.addPollOptionText}>선택지 추가</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
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
    backgroundColor: '#f9fafb',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 8,
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
  // 투표 관련 스타일
  pollSection: {
    marginTop: 16,
  },
  pollSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  pollOptionContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pollOptionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pollOptionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    marginRight: 8,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  pollImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollImageWrapper: {
    position: 'relative',
  },
  pollImage: {
    borderRadius: 6,
  },
  pollImageRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pollImageAddButton: {
    width: 60,
    height: 40,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  pollImageAddText: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
  },
  pollOptionRemoveButton: {
    padding: 4,
    marginLeft: 8,
  },
  addPollOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  addPollOptionText: {
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
}); 