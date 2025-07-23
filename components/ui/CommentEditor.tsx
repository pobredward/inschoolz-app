import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CommentEditorProps {
  visible: boolean;
  commentId: string;
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export default function CommentEditor({
  visible,
  commentId,
  initialContent,
  onSave,
  onCancel,
}: CommentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // initialContent가 변경될 때마다 content 상태 업데이트
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('알림', '댓글 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(content.trim());
    } catch (error) {
      console.error('댓글 수정 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // 취소할 때는 원본 내용으로 되돌리기
    setContent(initialContent);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>댓글 수정</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting || !content.trim()}
            style={[
              styles.saveButton,
              (!content.trim() || isSubmitting) && styles.saveButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.saveButtonText,
                (!content.trim() || isSubmitting) && styles.saveButtonTextDisabled,
              ]}
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.content}>
                <TextInput
                  style={styles.textInput}
                  value={content}
                  onChangeText={setContent}
                  placeholder="댓글을 입력하세요..."
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              </View>
            </SafeAreaView>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#9ca3af',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 50,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 40,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    textAlignVertical: 'top',
    minHeight: 300,
    maxHeight: 400,
  },
}); 