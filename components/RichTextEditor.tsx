import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onImageUpload?: (attachment: { type: 'image'; url: string; name: string; size: number }) => void;
  onImageRemove?: (imageUrl: string) => void;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = '내용을 입력하세요...',
  onImageUpload,
  onImageRemove,
}: RichTextEditorProps) {
  const richText = useRef<RichEditor>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [editorInitialized, setEditorInitialized] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [lastContent, setLastContent] = useState(content);
  const [previousImages, setPreviousImages] = useState<string[]>([]);

  // 에디터 초기화 완료 시 호출
  const onEditorInitialized = () => {
    console.log('에디터 초기화 완료');
    setEditorInitialized(true);
    // 초기 이미지 목록 추출
    const initialImages = extractImageUrls(content);
    setPreviousImages(initialImages);
  };

  // HTML에서 이미지 URL 추출하는 함수
  const extractImageUrls = (html: string): string[] => {
    const imgRegex = /<img[^>]+src="([^"]+)"/g;
    const urls: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  };

  // 콘텐츠 변경 처리
  const handleContentChange = (html: string) => {
    setLastContent(html);
    onChange(html);
    
    // 이미지 삭제 감지
    if (onImageRemove) {
      const currentImages = extractImageUrls(html);
      const removedImages = previousImages.filter(url => !currentImages.includes(url));
      
      // 삭제된 이미지들에 대해 콜백 호출
      removedImages.forEach(imageUrl => {
        console.log('이미지 삭제 감지:', imageUrl);
        onImageRemove(imageUrl);
      });
      
      setPreviousImages(currentImages);
    }
  };

  // 이미지 선택 및 업로드
  const handleImageUpload = async () => {
    console.log('이미지 업로드 버튼 클릭됨');
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '이미지를 선택하려면 갤러리 접근 권한이 필요합니다.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setIsUploading(true);
        
        try {
          const imageUri = result.assets[0].uri;
          console.log('이미지 업로드 시작:', imageUri);
          
          const uploadedUrl = await uploadImage(imageUri);
          console.log('이미지 업로드 완료:', uploadedUrl);
          
          // 에디터에 이미지 삽입
          richText.current?.insertImage(uploadedUrl);
          
          // 상위 컴포넌트에 알림
          if (onImageUpload) {
            onImageUpload({
              type: 'image',
              url: uploadedUrl,
              name: `image_${Timestamp.now().toMillis()}.jpg`,
              size: result.assets[0].fileSize || 0,
            });
          }
        } catch (error) {
          console.error('이미지 업로드 오류:', error);
          Alert.alert('오류', '이미지 업로드에 실패했습니다.');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('이미지 선택 오류:', error);
      Alert.alert('오류', '이미지를 선택하는 중 오류가 발생했습니다.');
    }
  };

  // 링크 추가
  const handleAddLink = () => {
    if (!linkUrl.trim()) {
      Alert.alert('알림', 'URL을 입력해주세요.');
      return;
    }

    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const displayText = linkText.trim() || url;
    
    // insertLink 메서드 사용
    richText.current?.insertLink(displayText, url);

    setLinkUrl('');
    setLinkText('');
    setShowLinkModal(false);
  };

  // 링크 제거
  const handleRemoveLink = () => {
    richText.current?.commandDOM('document.execCommand("unlink", false, null)');
    setShowLinkModal(false);
  };

  // 링크 삽입 핸들러
  const handleInsertLink = () => {
    console.log('링크 버튼 클릭됨');
    setShowLinkModal(true);
  };

  // 키보드 숨기기 (에디터 외부 터치 시에만)
  const dismissKeyboard = () => {
    console.log('에디터 외부 터치 - 키보드 숨김');
    Keyboard.dismiss();
    richText.current?.blurContentEditor();
    setIsEditorFocused(false);
  };

  // 에디터 포커스 처리
  const handleEditorFocus = () => {
    console.log('에디터 포커스됨');
    setIsEditorFocused(true);
  };

  // 에디터 블러 처리
  const handleEditorBlur = () => {
    console.log('에디터 블러됨');
    setIsEditorFocused(false);
  };

  // 커서 위치 변경 시 스크롤 조정
  const handleCursorPosition = (scrollY: number) => {
    console.log('커서 위치:', scrollY);
    if (scrollRef.current && scrollY > 0) {
      scrollRef.current.scrollTo({ y: scrollY - 50, animated: true });
    }
  };

  // 에디터 영역 터치 처리 (개선된 버전)
  const handleEditorTouch = () => {
    console.log('에디터 영역 터치됨');
    // 터치 시 포커스만 설정하고 커서 위치는 WebView가 자연스럽게 처리하도록 함
    if (editorInitialized && !isEditorFocused) {
      richText.current?.focusContentEditor();
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.editorWrapper}>
          <ScrollView 
            ref={scrollRef}
            style={styles.editorScrollView}
            contentContainerStyle={styles.editorScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <View style={styles.editorContainer}>
              <RichEditor
                ref={richText}
                style={styles.rich}
                initialContentHTML={content}
                onChange={handleContentChange}
                placeholder={placeholder}
                initialHeight={300}
                useContainer={false}
                editorInitializedCallback={onEditorInitialized}
                onFocus={handleEditorFocus}
                onBlur={handleEditorBlur}
                onCursorPosition={handleCursorPosition}
                editorStyle={{
                  backgroundColor: '#fff',
                  color: '#000',
                  contentCSSText: `
                    font-size: 16px; 
                    line-height: 1.5; 
                    padding: 12px;
                    min-height: 280px;
                    -webkit-user-select: text;
                    -webkit-touch-callout: none;
                    -webkit-tap-highlight-color: transparent;
                    outline: none;
                    cursor: text;
                  `,
                }}
              />
            </View>
          </ScrollView>
        </View>

        {/* 에디터 외부 터치 감지 영역 */}
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.outsideArea} />
        </TouchableWithoutFeedback>
        
        <RichToolbar
          style={styles.richBar}
          editor={richText}
          disabled={false}
          iconTint="#333"
          selectedIconTint="#2563eb"
          disabledIconTint="#bfbfbf"
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.heading1,
            actions.heading2,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.alignLeft,
            actions.alignCenter,
            actions.alignRight,
            actions.insertImage,
            actions.insertLink,
            actions.undo,
            actions.redo,
          ]}
          iconMap={{
            [actions.heading1]: ({ tintColor }: { tintColor: string }) => (
              <Text style={[{ color: tintColor, fontWeight: 'bold', fontSize: 16 }]}>H1</Text>
            ),
            [actions.heading2]: ({ tintColor }: { tintColor: string }) => (
              <Text style={[{ color: tintColor, fontWeight: 'bold', fontSize: 14 }]}>H2</Text>
            ),
          }}
          onPressAddImage={handleImageUpload}
          onInsertLink={handleInsertLink}
        />

        {/* 링크 추가 모달 */}
        <Modal
          visible={showLinkModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowLinkModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowLinkModal(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>링크 추가</Text>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>URL</Text>
                    <TextInput
                      style={styles.textInput}
                      value={linkUrl}
                      onChangeText={setLinkUrl}
                      placeholder="https://example.com"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>링크 텍스트 (선택사항)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={linkText}
                      onChangeText={setLinkText}
                      placeholder="표시할 텍스트"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => {
                        setShowLinkModal(false);
                        setLinkUrl('');
                        setLinkText('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>취소</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={handleAddLink}
                    >
                      <Text style={styles.confirmButtonText}>링크 추가</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.removeLinkButton}
                    onPress={handleRemoveLink}
                  >
                    <Text style={styles.removeLinkText}>선택된 링크 제거</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* 업로드 상태 표시 */}
        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <Text style={styles.uploadingText}>이미지 업로드 중...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  editorWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 300,
  },
  editorScrollView: {
    flex: 1,
  },
  editorScrollContent: {
    flexGrow: 1,
    minHeight: 300,
  },
  editorContainer: {
    flex: 1,
    minHeight: 300,
  },
  rich: {
    minHeight: 300,
    flex: 1,
  },
  outsideArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  richBar: {
    height: 50,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: width * 0.85,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#374151',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#2563eb',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  removeLinkButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  removeLinkText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
  },
}); 