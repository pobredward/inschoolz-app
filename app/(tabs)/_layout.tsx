import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useSegments, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { SafeProfileImage } from '../../components/SafeProfileImage';
import { useAuthStore } from '../../store/authStore';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncUserExperienceData } from '../../lib/experience';
import { getUnreadNotificationCount } from '../../lib/notifications';
import { User } from '../../types';

// 파스텔 그린 색상 팔레트
const pastelGreenColors = {
  50: '#f0fdf4',    // 매우 연한 그린
  100: '#dcfce7',   // 연한 그린
  200: '#bbf7d0',   // 파스텔 그린
  300: '#86efac',   // 메인 파스텔 그린
  400: '#4ade80',   // 살짝 진한 그린
  500: '#22c55e',   // 중간 그린
  600: '#16a34a',   // 진한 그린
  700: '#15803d',   // 더 진한 그린
  800: '#166534',   // 매우 진한 그린
  900: '#14532d',   // 가장 진한 그린
};

function CustomHeader() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const insets = useSafeAreaInsets(); // Safe Area 인셋 추가
  const { 
    user, 
    clearAuth, 
    isLoading, 
    error, 
    setError, 
    unreadNotificationCount, 
    updateUnreadNotificationCount 
  } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // 읽지 않은 알림 개수 조회 - AuthStore 업데이트
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadUnreadCount = async () => {
      if (user?.uid) {
        try {
          const count = await getUnreadNotificationCount(user.uid);
          updateUnreadNotificationCount(count); // AuthStore 업데이트
        } catch (error) {
          console.error('읽지 않은 알림 개수 조회 실패:', error);
        }
      } else {
        updateUnreadNotificationCount(0); // 로그아웃 시 0으로 초기화
      }
    };

    loadUnreadCount();

    // 60초마다 업데이트로 변경하여 성능 개선 (30초 → 60초)
    const interval = setInterval(loadUnreadCount, 60000);

    return () => {
      clearInterval(interval);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid, updateUnreadNotificationCount]);

  // Firebase 실시간 리스너는 AuthStore에서 중앙 관리되므로 별도 로드 불필요

  // Firebase 실시간 리스너는 AuthStore에서 중앙 관리됨
  // realTimeStats는 AuthStore의 user 데이터를 직접 사용하므로 제거

  // 현재 활성 탭 감지
  const currentTab = segments[1] || 'index'; // (tabs)/index, (tabs)/community 등에서 탭 이름 추출

  const handleProfilePress = () => {
    setIsDropdownOpen(true);
  };

  const handleCloseDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      setIsDropdownOpen(false);
      setError(''); // 기존 에러 초기화
      
      Alert.alert(
        '로그아웃',
        '정말 로그아웃하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '로그아웃',
            style: 'destructive',
            onPress: async () => {
              try {
                await clearAuth();
                router.replace('/(tabs)'); // 홈으로 리다이렉트
              } catch (error) {
                console.error('로그아웃 실패:', error);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('로그아웃 처리 오류:', error);
    }
  };

  const handleNotificationPress = () => {
    router.push('/notifications');
  };

  // 경험치/레벨 표시 (AuthStore의 실시간 데이터 사용)
  // React의 리렌더링을 트리거하기 위해 컴포넌트로 분리
  const ExperienceDisplay = () => {
    if (!user) return null;

    // AuthStore의 user 데이터를 직접 사용 (실시간 업데이트됨)
    const statsData = user.stats;

    // 기본값으로 레벨 1, 경험치 0 설정
    const level = statsData?.level || 1;
    const currentExp = statsData?.currentExp || 0;
    const currentLevelRequiredXp = statsData?.currentLevelRequiredXp || (level * 10);
    
    const xpPercentage = Math.min((currentExp / currentLevelRequiredXp) * 100, 100);

    return (
      <View style={styles.expContainer}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lv.{level}</Text>
        </View>
        <View style={styles.expBarContainer}>
          <View style={styles.expBar}>
            <View 
              style={[
                styles.expFill, 
                { width: `${Math.max(xpPercentage, 5)}%` }
              ]} 
            />
          </View>
          <Text style={styles.expText}>{currentExp}/{currentLevelRequiredXp}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerLeft}>
        <Text style={styles.logo}>InSchoolz</Text>
      </View>
      
      <View style={styles.headerRight}>
        {user && (
          <>
            {/* 알림 버튼 */}
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={handleNotificationPress}
            >
              <Ionicons name="notifications-outline" size={24} color={pastelGreenColors[600]} />
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* 프로필 버튼 */}
            <TouchableOpacity
              style={styles.profileButton}
              onPress={handleProfilePress}
            >
              <SafeProfileImage
                uri={user?.profile?.profileImageUrl}
                size={28}
                fallbackIcon="person-circle"
                fallbackColor={pastelGreenColors[600]}
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 프로필 드롭다운 모달 */}
      <Modal
        visible={isDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseDropdown}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { paddingTop: insets.top + 70 }]}
          activeOpacity={1}
          onPress={handleCloseDropdown}
        >
          <View style={styles.dropdownContainer}>
            {user && (
              <>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.profile?.userName || '사용자'}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
                
                {/* 경험치/레벨 표시 */}
                <ExperienceDisplay />
                
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setIsDropdownOpen(false);
                    router.push('/(tabs)/profile');
                  }}
                >
                  <IconSymbol name="person.fill" size={16} color={pastelGreenColors[600]} />
                  <Text style={styles.dropdownText}>마이페이지</Text>
                </TouchableOpacity>

                {user.role === 'admin' && (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setIsDropdownOpen(false);
                      router.push('/admin/users');
                    }}
                  >
                    <IconSymbol name="shield.fill" size={16} color={pastelGreenColors[500]} />
                    <Text style={styles.dropdownText}>관리자</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.dropdownItem} onPress={handleLogout}>
                  <IconSymbol name="rectangle.portrait.and.arrow.right" size={16} color={pastelGreenColors[700]} />
                  <Text style={[styles.dropdownText, { color: pastelGreenColors[700] }]}>로그아웃</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { user } = useAuthStore();
  
  // 현재 활성 탭 감지
  const currentTab = segments[1] || 'index';

  // 관리자 권한 확인 - 로그인된 상태이고 role이 admin인 경우에만
  const isAdmin = user && user.role === 'admin';

  return (
    <>
      <CustomHeader />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: pastelGreenColors[600],
          tabBarInactiveTintColor: '#374151', // 기존 '#6b7280'에서 더 진한 회색으로 변경
          headerShown: false,
          // tabBarButton: HapticTab, // 삭제된 컴포넌트
          tabBarBackground: TabBarBackground,
          tabBarStyle: {
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 5,
            paddingTop: 8,
            backgroundColor: pastelGreenColors[50], // 매우 연한 파스텔 그린으로 변경
            borderTopWidth: 1,
            borderTopColor: pastelGreenColors[200],
            ...Platform.select({
              ios: {
                position: 'absolute',
              },
              default: {},
            }),
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            // 잼민이체 스타일
            fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '홈',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={24} 
                name={focused ? "house.fill" : "house"} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: '커뮤니티',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={24} 
                name={focused ? "message.circle.fill" : "message.circle"} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="games"
          options={{
            title: '미니게임',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={24} 
                name={focused ? "gamecontroller.fill" : "gamecontroller"} 
                color={color} 
              />
            ),
          }}
        />
        {/* 급식 탭을 독립 페이지로 이동 */}
        <Tabs.Screen
          name="meals"
          options={{
            href: null, // 탭에서 숨김
          }}
        />
        <Tabs.Screen
          name="ranking"
          options={{
            title: '랭킹',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={24} 
                name={focused ? "trophy.fill" : "trophy"} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '마이페이지',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={24} 
                name={focused ? "person.fill" : "person"} 
                color={color} 
              />
            ),
          }}
        />
        {/* 관리자 탭 - 관리자만 표시 */}
        <Tabs.Screen
          name="admin"
          options={{
            title: '관리자',
            href: isAdmin ? undefined : null, // admin이 아닌 경우 탭에서 완전히 숨김
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
                size={24} 
                name={focused ? "shield.fill" : "shield"} 
                color={color} 
              />
            ),
          }}
        />
        {/* 기존 explore 탭 숨김 */}
        <Tabs.Screen
          name="explore"
          options={{
            href: null, // 탭에서 숨김
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    // paddingTop은 동적으로 설정됨 (insets.top + 10)
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: pastelGreenColors[600],
    // 잼민이체 스타일 (iOS에서는 Comic Sans MS 대신 rounded 스타일)
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    backgroundColor: pastelGreenColors[300],
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelText: {
    color: pastelGreenColors[800],
    fontSize: 12,
    fontWeight: 'bold',
  },
  expBarContainer: {
    alignItems: 'center',
    gap: 2,
  },
  expBar: {
    width: 48,
    height: 6,
    backgroundColor: pastelGreenColors[100],
    borderRadius: 3,
  },
  expFill: {
    height: '100%',
    backgroundColor: pastelGreenColors[400],
    borderRadius: 3,
  },
  expText: {
    fontSize: 10,
    color: pastelGreenColors[700],
    fontWeight: '500',
  },
  profileButton: {
    padding: 4,
    borderRadius: 20,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
    borderRadius: 20,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: pastelGreenColors[600],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // 드롭다운 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    // paddingTop은 동적으로 설정됨 (insets.top + 70)
    paddingRight: 16,
  },
  dropdownContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 160,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
  },
  userInfo: {
    padding: 12,
    backgroundColor: pastelGreenColors[50],
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
  },
  userEmail: {
    fontSize: 12,
    color: pastelGreenColors[600],
    marginTop: 2,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dropdownText: {
    fontSize: 14,
    color: '#374151',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: pastelGreenColors[200],
    marginHorizontal: 8,
  },
  // 에러 표시 스타일
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#dc2626',
  },
  errorCloseButton: {
    padding: 4,
  },
  errorCloseText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: 'bold',
  },
});
