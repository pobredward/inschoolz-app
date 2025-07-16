import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  Switch,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getBoard } from '@/lib/boards';
import { Board } from '@/types';
import { uploadImage } from '@/lib/firebase';
import RichTextEditor from '@/components/RichTextEditor';
import { awardPostExperience } from '@/lib/experience-service';
import { ExperienceModal } from '@/components/ui/ExperienceModal';

const { height: screenHeight } = Dimensions.get('window');

export default function WritePostPage() {
  const { type, boardCode, category: categoryId, categoryName } = useLocalSearchParams<{
    type: string;
    boardCode: string;
    category?: string;
    categoryName?: string;
  }>();
  
  // boardCode를 code로 매핑
  const code = boardCode;
  
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [board, setBoard] = useState<Board | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | undefined>();
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
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file'; url: string; name: string; size: number }[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // 이미지 업로드 핸들러 (Rich Text Editor에서 호출)
  const handleImageUpload = (attachment: { type: 'image'; url: string; name: string; size: number }) => {
    setAttachments(prev => [...prev, attachment]);
  };

  // 이미지 삭제 핸들러 (Rich Text Editor에서 호출)
  const handleImageRemove = (imageUrl: string) => {
    console.log('이미지 삭제:', imageUrl);
    setAttachments(prev => prev.filter(attachment => attachment.url !== imageUrl));
  };

  // 게시판 정보 로드
  useEffect(() => {
    const loadBoard = async () => {
      if (!code) return;
      
      try {
        const boardData = await getBoard(code);
        setBoard(boardData);
        
        // URL에서 카테고리 정보가 있으면 설정
        if (categoryId && categoryName) {
          setSelectedCategory({ id: categoryId, name: categoryName });
        } else if (boardData?.categories && boardData.categories.length > 0) {
          // 카테고리가 있는 게시판인데 URL에 카테고리 정보가 없으면 모달 표시
          setShowCategoryModal(true);
        }
      } catch (error) {
        console.error('게시판 정보 로드 실패:', error);
        Alert.alert('오류', '게시판 정보를 불러오는데 실패했습니다.');
      }
    };

    loadBoard();
  }, [code, categoryId, categoryName]);

  const handleCategorySelect = (category: { id: string; name: string }) => {
    setSelectedCategory(category);
    setShowCategoryModal(false);
    
    // URL에 카테고리 정보 추가하여 다시 이동
    router.replace(`/board/${type}/${code}/write?category=${category.id}&categoryName=${encodeURIComponent(category.name)}`);
  };

  const handleCategoryChange = () => {
    setShowCategoryModal(true);
  };

  const addPollOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  // 경험치 모달 닫기 핸들러
  const handleExperienceModalClose = () => {
    setShowExperienceModal(false);
    // 모달 닫기 후 게시글 상세 페이지로 이동
    if (pendingPostId) {
      router.push(`/board/${type}/${code}/${pendingPostId}`);
      setPendingPostId(null);
    }
    setExperienceData(null);
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (!board) {
      Alert.alert('오류', '게시판 정보를 불러오는 중입니다.');
      return;
    }

    // 카테고리가 있는 게시판인데 카테고리를 선택하지 않은 경우
    if (board.categories && board.categories.length > 0 && !selectedCategory) {
      Alert.alert('오류', '카테고리를 선택해주세요.');
      setShowCategoryModal(true);
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
      if (!pollQuestion.trim()) {
        Alert.alert('오류', '투표 질문을 입력해주세요.');
        return;
      }
      
      const validOptions = pollOptions.filter(option => option.trim());
      if (validOptions.length < 2) {
        Alert.alert('오류', '투표 선택지를 최소 2개 이상 입력해주세요.');
        return;
      }
    }

    setIsLoading(true);
    setUploadingImages(true);

    try {
      // Rich Text Editor에서 이미지는 이미 콘텐츠에 포함되어 있으므로
      // 별도의 이미지 업로드 처리가 필요하지 않습니다.
      setUploadingImages(false);

      // 안전한 사용자 이름 처리
      const getUserDisplayName = () => {
        if (isAnonymous) return '익명';
        return user.profile?.userName || user.email?.split('@')[0] || '사용자';
      };

      const postData = {
        type: type,
        boardCode: code,
        title: title.trim(),
        content: content.trim(), // Rich Text Editor에서 HTML 형태로 제공됨
        // category가 있을 때만 포함시키기
        ...(selectedCategory && { category: selectedCategory }),
        authorId: user.uid,
        authorInfo: {
          displayName: getUserDisplayName(),
          isAnonymous: isAnonymous,
        },
        // 학교와 지역 정보 추가
        ...(type === 'school' && user.school?.id && { schoolId: user.school.id }),
        ...(type === 'regional' && user.regions && {
          regions: {
            sido: user.regions.sido,
            sigungu: user.regions.sigungu
          }
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: {
          isPinned: false,
          isDeleted: false,
          isHidden: false,
        },
        stats: {
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
        },
        attachments: attachments, // Rich Text Editor에서 업로드된 이미지들
        tags: [],
        ...(isPollEnabled && pollQuestion.trim() && {
          poll: {
            isActive: true,
            question: pollQuestion.trim(),
            options: pollOptions.filter(option => option.trim()).map((option, index) => ({
              text: option.trim(),
              voteCount: 0,
              index
            })),
            voters: [],
          }
        })
      };

      console.log('게시글 데이터:', postData); // 디버깅용

      const docRef = await addDoc(collection(db, 'posts'), postData);
      const postId = docRef.id;

      // 경험치 부여
      try {
        const expResult = await awardPostExperience(user.uid);
        if (expResult.success) {
          setExperienceData({
            expGained: expResult.expGained,
            activityType: 'post',
            leveledUp: expResult.leveledUp,
            oldLevel: expResult.oldLevel,
            newLevel: expResult.newLevel,
            currentExp: expResult.currentExp,
            expToNextLevel: expResult.expToNextLevel,
            remainingCount: expResult.remainingCount,
            totalDailyLimit: expResult.totalDailyLimit,
            reason: expResult.reason
          });
          setPendingPostId(postId);
          setShowExperienceModal(true);
        } else {
          // 경험치 부여 실패 시 즉시 이동
          Alert.alert('성공', '게시글이 작성되었습니다.', [
            {
              text: '확인',
              onPress: () => router.push(`/board/${type}/${code}/${postId}`)
            }
          ]);
        }
      } catch (expError) {
        console.error('경험치 부여 실패:', expError);
        // 경험치 부여 실패는 게시글 작성 성공에 영향을 주지 않음
        Alert.alert('성공', '게시글이 작성되었습니다.', [
          {
            text: '확인',
            onPress: () => router.push(`/board/${type}/${code}/${postId}`)
          }
        ]);
      }
    } catch (error: unknown) {
      console.error('게시글 작성 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      Alert.alert('오류', `게시글 작성에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 카테고리 선택 모달
  const renderCategoryModal = () => {
    if (!board?.categories) return null;

    const activeCategories = board.categories.filter(cat => cat.isActive);

    return (
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>카테고리 선택</Text>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={activeCategories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.categoryItem}
                onPress={() => handleCategorySelect({ id: item.id, name: item.name })}
              >
                <View style={styles.categoryInfo}>
                  {item.icon && (
                    <Text style={styles.categoryIcon}>{item.icon}</Text>
                  )}
                  <View style={styles.categoryText}>
                    <Text style={styles.categoryName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.categoryDescription}>{item.description}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.categoryList}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  if (!board) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>게시판 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
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
          <Text style={styles.headerTitle}>
            {board ? `${board.name} - 글쓰기` : '글쓰기'}
          </Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading || !title.trim() || !content.trim()}
            style={[
              styles.submitButton,
              (isLoading || !title.trim() || !content.trim()) && styles.submitButtonDisabled
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>완료</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 카테고리 선택 (상단 고정) */}
        {board?.categories && board.categories.length > 0 && (
          <View style={styles.categorySection}>
            <TouchableOpacity
              onPress={handleCategoryChange}
              style={styles.categorySelectButton}
            >
              <Text style={[styles.categoryButtonText, !selectedCategory && styles.placeholderText]}>
                {selectedCategory ? selectedCategory.name : '카테고리를 선택하세요'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}

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

            {/* 투표 옵션 */}
            <View style={styles.section}>
              <View style={styles.switchContainer}>
                <Text style={styles.sectionTitle}>투표 추가</Text>
                <Switch
                  value={isPollEnabled}
                  onValueChange={setIsPollEnabled}
                  trackColor={{ false: '#767577', true: '#10B981' }}
                  thumbColor={isPollEnabled ? '#fff' : '#f4f3f4'}
                />
              </View>

              {isPollEnabled && (
                <View style={styles.pollContainer}>
                  <TextInput
                    style={styles.pollQuestionInput}
                    placeholder="투표 질문을 입력하세요"
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    multiline={true}
                    maxLength={200}
                  />
                  
                  {pollOptions.map((option, index) => (
                    <View key={index} style={styles.pollOptionContainer}>
                      <TextInput
                        style={styles.pollOptionInput}
                        placeholder={`선택지 ${index + 1}`}
                        value={option}
                        onChangeText={(value) => updatePollOption(index, value)}
                        maxLength={100}
                      />
                      {pollOptions.length > 2 && (
                        <TouchableOpacity
                          onPress={() => removePollOption(index)}
                          style={styles.removeOptionButton}
                        >
                          <Ionicons name="close-circle" size={24} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  
                  {pollOptions.length < 5 && (
                    <TouchableOpacity onPress={addPollOption} style={styles.addOptionButton}>
                      <Ionicons name="add" size={20} color="#10B981" />
                      <Text style={styles.addOptionText}>선택지 추가</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* 익명 옵션 */}
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

            {/* 하단 여백 (키보드 영역 확보) */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>

        {renderCategoryModal()}

        {/* 경험치 획득 모달 */}
        {experienceData && (
          <ExperienceModal
            visible={showExperienceModal}
            onClose={handleExperienceModalClose}
            data={experienceData}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
  // 카테고리 선택 영역 스타일
  categorySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  categorySelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  categoryButtonText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 120,
    textAlignVertical: 'top',
    marginTop: 2,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pollContainer: {
    marginTop: 12,
  },
  pollQuestionInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  pollOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pollOptionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  removeOptionButton: {
    marginLeft: 8,
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    marginTop: 8,
  },
  addOptionText: {
    marginLeft: 4,
    color: '#10B981',
    fontWeight: '600',
  },
  // 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  categoryList: {
    padding: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryText: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
  },

  categorySelectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  categorySelectedText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 2,
  },
  // 키보드 회피 영역 스타일
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 120, // 키보드 높이만큼 여백 추가
  },
  editorContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    minHeight: 200,
  },
  bottomSpacer: {
    height: 120, // 키보드 높이만큼 여백 추가
  },
}); 