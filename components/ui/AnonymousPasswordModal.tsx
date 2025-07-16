import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { verifyAnonymousCommentPassword } from '../../lib/boards';

interface AnonymousPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (password: string) => void;
  postId: string;
  commentId: string;
  action: 'edit' | 'delete';
}

export default function AnonymousPasswordModal({
  visible,
  onClose,
  onSuccess,
  postId,
  commentId,
  action
}: AnonymousPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!password) {
      Alert.alert('알림', '비밀번호를 입력해주세요.');
      return;
    }

    if (!/^\d{4}$/.test(password)) {
      Alert.alert('알림', '비밀번호는 4자리 숫자로 입력해주세요.');
      return;
    }

    setIsVerifying(true);

    try {
      const isValid = await verifyAnonymousCommentPassword(postId, commentId, password);
      
      if (isValid) {
        const verifiedPassword = password;
        setPassword('');
        onSuccess(verifiedPassword);
      } else {
        Alert.alert('알림', '비밀번호가 일치하지 않습니다.');
      }
    } catch (error) {
      console.error('비밀번호 확인 실패:', error);
      Alert.alert('오류', '비밀번호 확인에 실패했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    onClose();
  };

  const actionText = action === 'edit' ? '수정' : '삭제';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>댓글 {actionText}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>
              댓글을 {actionText}하려면 작성 시 입력한 4자리 비밀번호를 입력해주세요.
            </Text>

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
                  autoFocus
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

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.verifyButton,
                action === 'delete' && styles.deleteButton,
                isVerifying && styles.verifyButtonDisabled
              ]}
              onPress={handleVerify}
              disabled={isVerifying}
            >
              <Text style={[
                styles.verifyButtonText,
                action === 'delete' && styles.deleteButtonText
              ]}>
                {isVerifying ? '확인 중...' : '확인'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  passwordContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  passwordInput: {
    paddingRight: 40,
    textAlign: 'center',
    letterSpacing: 4,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  verifyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  verifyButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButtonText: {
    color: '#fff',
  },
}); 