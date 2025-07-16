import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Modal,
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAnonymousComment } from '../../lib/boards';

interface AnonymousCommentFormProps {
  visible: boolean;
  postId: string;
  parentId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
  placeholder?: string;
}

export default function AnonymousCommentForm({
  visible,
  postId,
  parentId = null,
  onSuccess,
  onCancel,
  placeholder = '댓글을 입력하세요...'
}: AnonymousCommentFormProps) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    if (!nickname.trim()) {
      Alert.alert('알림', '닉네임을 입력해주세요.');
      return false;
    }
    if (nickname.length < 2 || nickname.length > 10) {
      Alert.alert('알림', '닉네임은 2-10자로 입력해주세요.');
      return false;
    }
    if (!password) {
      Alert.alert('알림', '비밀번호를 입력해주세요.');
      return false;
    }
    if (!/^\d{4}$/.test(password)) {
      Alert.alert('알림', '비밀번호는 4자리 숫자로 입력해주세요.');
      return false;
    }
    if (!content.trim()) {
      Alert.alert('알림', '댓글 내용을 입력해주세요.');
      return false;
    }
    if (content.length > 1000) {
      Alert.alert('알림', '댓글은 1000자 이하로 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      // IP 주소 가져오기 (선택사항)
      let ipAddress = '';
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        ipAddress = data.ip;
      } catch (error) {
        console.warn('IP 주소 가져오기 실패:', error);
      }

      await createAnonymousComment({
        postId,
        content: content.trim(),
        nickname: nickname.trim(),
        password,
        parentId,
        ipAddress,
      });

      Alert.alert('성공', '댓글이 작성되었습니다.', [
        { text: '확인', onPress: onSuccess }
      ]);

      // 폼 초기화
      setNickname('');
      setPassword('');
      setContent('');
    } catch (error) {
      console.error('익명 댓글 작성 실패:', error);
      Alert.alert('오류', '댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNickname('');
    setPassword('');
    setContent('');
    setShowPassword(false);
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
                  <Text style={styles.headerTitle}>익명 댓글 작성</Text>
                  <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <Ionicons name="close" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.form}>
                  <View style={styles.row}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>닉네임 (2-10자)</Text>
                      <TextInput
                        style={styles.input}
                        value={nickname}
                        onChangeText={setNickname}
                        placeholder="익명123"
                        maxLength={10}
                        autoCapitalize="none"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>비밀번호 (4자리 숫자)</Text>
                      <View style={styles.passwordContainer}>
                        <TextInput
                          style={[styles.input, styles.passwordInput]}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="1234"
                          secureTextEntry={!showPassword}
                          keyboardType="numeric"
                          maxLength={4}
                          returnKeyType="next"
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.passwordToggle}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                            size={16}
                            color="#6b7280"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      댓글 내용 ({content.length}/1000)
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={content}
                      onChangeText={setContent}
                      placeholder={placeholder}
                      multiline
                      numberOfLines={4}
                      maxLength={1000}
                      textAlignVertical="top"
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
                        styles.submitButton,
                        isSubmitting && styles.submitButtonDisabled
                      ]}
                      onPress={handleSubmit}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.submitButtonText}>
                        {isSubmitting ? '작성 중...' : '댓글 작성'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.notice}>
                  <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
                  <Text style={styles.noticeText}>
                    비밀번호는 댓글 수정/삭제 시 필요합니다. 꼭 기억해주세요.
                  </Text>
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
    justifyContent: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    justifyContent: 'flex-end',
    flexGrow: 1,
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    minHeight: '50%',
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
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 40,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 10,
    padding: 4,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
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
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    marginLeft: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    marginLeft: 6,
  },
}); 