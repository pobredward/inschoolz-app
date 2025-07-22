import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

interface BlockedUserContentProps {
  blockedUserId: string;
  blockedUserName: string;
  contentType: 'post' | 'comment';
  children: React.ReactNode;
  onUnblock?: () => void;
}

export function BlockedUserContent({ 
  blockedUserId, 
  blockedUserName, 
  contentType,
  children,
  onUnblock 
}: BlockedUserContentProps) {
  const { user } = useAuthStore();
  const [showContent, setShowContent] = useState(false);

  const handleUnblock = async () => {
    if (!user) return;
    
    Alert.alert(
      '차단 해제',
      `${blockedUserName}님을 차단 해제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: async () => {
            try {
              const { toggleBlock } = await import('../../lib/users');
              await toggleBlock(user.uid, blockedUserId);
              Alert.alert('완료', `${blockedUserName}님을 차단 해제했습니다.`);
              onUnblock?.();
            } catch (error) {
              console.error('차단 해제 실패:', error);
              Alert.alert('오류', '차단 해제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleToggleContent = () => {
    setShowContent(!showContent);
  };

  if (showContent) {
    return (
      <View style={styles.showingContainer}>
        {children}
        <TouchableOpacity 
          style={styles.hideButton} 
          onPress={handleToggleContent}
        >
          <MaterialIcons name="visibility-off" size={16} color="#666" />
          <Text style={styles.hideButtonText}>숨기기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.blockedContainer}>
      <View style={styles.blockedContent}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="block" size={24} color="#999" />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.blockedTitle}>
            차단한 사용자의 {contentType === 'post' ? '게시글' : '댓글'}입니다
          </Text>
          <Text style={styles.blockedSubtitle}>
            @{blockedUserName}
          </Text>
        </View>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.viewButton} 
            onPress={handleToggleContent}
          >
            <MaterialIcons name="visibility" size={16} color="#007AFF" />
            <Text style={styles.viewButtonText}>보기</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.unblockButton} 
            onPress={handleUnblock}
          >
            <Text style={styles.unblockButtonText}>차단 해제</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockedContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  blockedContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  blockedTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 2,
  },
  blockedSubtitle: {
    fontSize: 12,
    color: '#6c757d',
  },
  buttonsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  viewButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  unblockButtonText: {
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'center',
  },
  showingContainer: {
    position: 'relative',
  },
  hideButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hideButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
}); 