import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl, 
  Alert,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadNotificationCount
} from '../lib/notifications';
import { updateNotificationBadge } from '../lib/notification-handlers';
import { Notification, NotificationType } from '../types';
import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { formatRelativeTime } from '../utils/timeUtils';

const { width } = Dimensions.get('window');

// 알림 타입별 아이콘 및 색상
const getNotificationIcon = (type: NotificationType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'post_comment':
      return 'chatbubble';
    case 'comment_reply':
      return 'return-up-forward';
    case 'like':
      return 'heart';
    case 'follow':
      return 'person-add';
    case 'referral':
      return 'people';
    case 'system':
      return 'information-circle';
    case 'general':
      return 'document-text';
    case 'event':
      return 'calendar';
    case 'report_received':
    case 'report_resolved':
      return 'warning';
    case 'warning':
    case 'suspension':
      return 'shield';
    default:
      return 'notifications';
  }
};

const getNotificationIconColor = (type: NotificationType): string => {
  switch (type) {
    case 'post_comment':
      return '#3B82F6';
    case 'comment_reply':
      return '#10B981';
    case 'like':
      return '#EF4444';
    case 'follow':
      return '#8B5CF6';
    case 'referral':
      return '#6366F1';
    case 'system':
      return '#2563EB';
    case 'general':
      return '#6B7280';
    case 'event':
      return '#059669';
    case 'report_received':
    case 'report_resolved':
      return '#F59E0B';
    case 'warning':
    case 'suspension':
      return '#DC2626';
    default:
      return '#6B7280';
  }
};

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onDelete: (notificationId: string) => void;
}

function NotificationItem({ notification, onPress, onDelete }: NotificationItemProps) {
  const handleDelete = () => {
    Alert.alert(
      '알림 삭제',
      '이 알림을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: () => onDelete(notification.id)
        }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.isRead && styles.unreadNotification
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        {/* 알림 아이콘 */}
        <View style={styles.iconContainer}>
          <Ionicons
            name={getNotificationIcon(notification.type)}
            size={20}
            color={getNotificationIconColor(notification.type)}
          />
          {!notification.isRead && <View style={styles.unreadDot} />}
        </View>

        {/* 알림 정보 */}
        <View style={styles.notificationInfo}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.title,
              !notification.isRead && styles.unreadTitle
            ]}>
              {notification.title}
            </Text>
            <Text style={styles.type}>
              {notification.type}
            </Text>
          </View>
          
          <Text style={[
            styles.message,
            !notification.isRead && styles.unreadMessage
          ]}>
            {notification.message}
          </Text>

          {/* 추가 정보 */}
          {notification.data && (
            <View style={styles.additionalInfo}>
              {notification.data.postTitle && (
                <Text style={styles.metaText}>
                  게시글: {notification.data.postTitle}
                </Text>
              )}
              {notification.data.commentContent && (
                <Text style={styles.metaText} numberOfLines={1}>
                  내용: {notification.data.commentContent}
                </Text>
              )}
            </View>
          )}

                     <View style={styles.bottomRow}>
             <Text style={styles.timeText}>
               {formatRelativeTime(notification.createdAt)}
             </Text>
           </View>
        </View>

        {/* 삭제 버튼 */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { 
    user, 
    unreadNotificationCount, 
    updateUnreadNotificationCount, 
    decrementUnreadNotificationCount 
  } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 알림 목록 조회
  const loadNotifications = useCallback(async (showRefresh = false) => {
    if (!user) return;

    try {
      if (showRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [notificationsData, unreadCountData] = await Promise.all([
        getUserNotifications(user.uid, 50),
        getUnreadNotificationCount(user.uid)
      ]);

      setNotifications(notificationsData);
      updateUnreadNotificationCount(unreadCountData); // AuthStore 업데이트
      
      // 푸시 알림 뱃지도 업데이트
      await updateNotificationBadge();
    } catch (error) {
      console.error('알림 조회 실패:', error);
      Alert.alert('오류', '알림을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, updateUnreadNotificationCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // 알림 클릭 처리
  const handleNotificationPress = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
        decrementUnreadNotificationCount(1); // AuthStore 업데이트
      }

      // 타입별로 적절한 페이지로 이동
      const { data } = notification;
      
      if (data?.postId && (notification.type === 'post_comment' || notification.type === 'comment_reply')) {
        // 댓글 관련 알림은 해당 게시글로 이동
        let route = '';
        
        if (data.postType === 'national') {
          route = `/board/national/${data.boardCode}/${data.postId}`;
        } else if (data.postType === 'regional') {
          route = `/board/regional/${data.boardCode}/${data.postId}`;
        } else if (data.postType === 'school') {
          route = `/board/school/${data.boardCode}/${data.postId}`;
        }
        
        if (route) {
          console.log('알림 클릭으로 이동:', route);
          router.push(route as any);
        } else {
          console.warn('알림 데이터가 불완전합니다:', data);
        }
      } else if (data?.targetUserId && notification.type === 'referral') {
        // 추천인 알림은 해당 사용자 프로필로 이동
        router.push(`/users/${data.targetUserId}` as any);
      } else if (notification.type === 'system') {
        // 시스템 알림은 특별한 이동 없음
        Alert.alert('시스템 알림', notification.message);
      }
    } catch (error) {
      console.error('알림 처리 실패:', error);
      Alert.alert('오류', '알림 처리에 실패했습니다.');
    }
  };

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = async () => {
    if (!user || unreadNotificationCount === 0) return;

    try {
      await markAllNotificationsAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      updateUnreadNotificationCount(0); // AuthStore 업데이트 - 0으로 설정
      Alert.alert('완료', '모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      console.error('모든 알림 읽음 처리 실패:', error);
      Alert.alert('오류', '모든 알림 읽음 처리에 실패했습니다.');
    }
  };

  // 알림 삭제
  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      const deletedNotification = notifications.find(n => n.id === notificationId);
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (deletedNotification && !deletedNotification.isRead) {
        decrementUnreadNotificationCount(1); // AuthStore 업데이트
      }
    } catch (error) {
      console.error('알림 삭제 실패:', error);
      Alert.alert('오류', '알림 삭제에 실패했습니다.');
    }
  };

  // 새로고침
  const onRefresh = () => {
    loadNotifications(true);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>로그인이 필요합니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={[
        styles.header,
        Platform.OS === 'android' && { paddingTop: insets.top + 8 }
      ]}>
        <View style={styles.headerLeft}>
          <Ionicons name="notifications" size={24} color="#059669" />
          <Text style={styles.headerTitle}>알림</Text>
          {unreadNotificationCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadNotificationCount}</Text>
            </View>
          )}
        </View>
        
        {unreadNotificationCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Ionicons name="checkmark-done" size={20} color="#059669" />
            <Text style={styles.markAllText}>모두 읽음</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 알림 목록 */}
      {isLoading && notifications.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>알림을 불러오는 중...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>아직 받은 알림이 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={handleNotificationPress}
              onDelete={handleDeleteNotification}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#059669']}
              tintColor="#059669"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={notifications.length === 0 ? styles.centered : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#111827',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#059669',
  },
  markAllText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unreadNotification: {
    backgroundColor: '#EFF6FF',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
    marginTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  notificationInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    color: '#111827',
  },
  type: {
    fontSize: 10,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  unreadMessage: {
    color: '#374151',
  },
  additionalInfo: {
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
}); 