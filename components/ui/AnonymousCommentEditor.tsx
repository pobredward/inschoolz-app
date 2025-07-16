import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateAnonymousComment } from '../../lib/boards';

interface AnonymousCommentEditorProps {
  visible: boolean;
  postId: string;
  commentId: string;
  initialContent: string;
  password: string; // 이미 검증된 비밀번호
  onSave: () => void;
  onCancel: () => void;
}

export default function AnonymousCommentEditor({
  visible,
  postId,
  commentId,
  initialContent,
  password,
  onSave,
  onCancel
}: AnonymousCommentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('알림', '댓글 내용을 입력해주세요.');
      return;
    }

    if (content.length > 1000) {
      Alert.alert('알림', '댓글은 1000자 이하로 입력해주세요.');
      return;
    }

    if (content.trim() === initialContent.trim()) {
      Alert.alert('알림', '변경된 내용이 없습니다.');
      return;
    }

    setIsSaving(true);

    try {
      await updateAnonymousComment(postId, commentId, content.trim(), password);
      Alert.alert('성공', '댓글이 수정되었습니다.', [
        { text: '확인', onPress: onSave }
      ]);
    } catch (error) {
      console.error('익명 댓글 수정 실패:', error);
      Alert.alert('오류', '댓글 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setContent(initialContent); // 원래 내용으로 복원
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalBackground}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.container}>
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>댓글 수정</Text>
                  <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <Ionicons name="close" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      댓글 내용 ({content.length}/1000)
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={content}
                      onChangeText={setContent}
                      placeholder="댓글을 입력하세요..."
                      multiline
                      numberOfLines={6}
                      maxLength={1000}
                      textAlignVertical="top"
                      autoFocus
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleClose}
                    >
                      <Text style={styles.cancelButtonText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        isSaving && styles.saveButtonDisabled
                      ]}
                      onPress={handleSave}
                      disabled={isSaving}
                    >
                      <Text style={styles.saveButtonText}>
                        {isSaving ? '저장 중...' : '저장'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 20,
    padding: 20,
    minHeight: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  form: {
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
}); 