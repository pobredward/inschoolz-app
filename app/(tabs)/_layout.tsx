import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Dimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useSegments, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '../../store/authStore';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncUserExperienceData } from '../../lib/experience';
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
  const { user, clearAuth, isLoading, error, setError } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

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
      await clearAuth();
      Alert.alert('로그아웃', '성공적으로 로그아웃되었습니다.');
      // 로그아웃 후 인증 페이지로 이동
      router.replace('/auth');
    } catch (error) {
      // 에러는 이미 logger에서 처리되므로 여기서는 사용자에게만 알림
      Alert.alert(
        '로그아웃 오류', 
        error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.'
      );
    }
  };

  const handleSettings = () => {
    setIsDropdownOpen(false);
    // 설정 페이지로 이동 (향후 구현)
    Alert.alert('설정', '설정 페이지는 개발 중입니다.');
  };

  const handleMyPage = () => {
    setIsDropdownOpen(false);
    router.push('/(tabs)/profile');
  };

  const handleLogin = () => {
    setIsDropdownOpen(false);
    router.push('/auth');
  };

  const handleSignup = () => {
    setIsDropdownOpen(false);
    router.push('/signup');
  };

  // 경험치/레벨 표시 (AuthStore의 실시간 데이터 사용)
  const renderExperienceDisplay = () => {
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
    <View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>InSchoolz</Text>
        </View>
        
        <View style={styles.headerRight}>
          {/* 경험치/레벨 표시 - 로그인된 사용자만 */}
          {user && renderExperienceDisplay()}
          
          {/* 프로필 아이콘 */}
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={handleProfilePress}
            accessibilityLabel="사용자 메뉴 열기"
            accessibilityRole="button"
            accessibilityHint="프로필 드롭다운 메뉴를 엽니다"
          >
            {user?.profile?.profileImageUrl ? (
              <Image 
                source={{ uri: user.profile.profileImageUrl }} 
                style={styles.profileImage}
              />
            ) : (
              <IconSymbol 
                name="person.circle.fill" 
                size={28} 
                color={pastelGreenColors[600]} 
              />
            )}
          </TouchableOpacity>
        </View>

        {/* 드롭다운 모달 */}
        <Modal
          visible={isDropdownOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseDropdown}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={handleCloseDropdown}
          >
            <View style={styles.dropdownContainer}>
              {user ? (
                <>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.profile?.userName || '사용자'}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                  <View style={styles.dropdownDivider} />
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={handleMyPage}
                    accessibilityLabel="마이페이지로 이동"
                    accessibilityRole="button"
                  >
                    <IconSymbol name="person.fill" size={16} color={pastelGreenColors[600]} />
                    <Text style={styles.dropdownText}>마이페이지</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={handleSettings}
                    accessibilityLabel="설정"
                    accessibilityRole="button"
                  >
                    <IconSymbol name="gearshape.fill" size={16} color={pastelGreenColors[500]} />
                    <Text style={styles.dropdownText}>설정</Text>
                  </TouchableOpacity>
                  <View style={styles.dropdownDivider} />
                  <TouchableOpacity 
                    style={[styles.dropdownItem, { opacity: isLoading ? 0.6 : 1 }]} 
                    onPress={handleLogout}
                    disabled={isLoading}
                    accessibilityLabel="로그아웃"
                    accessibilityRole="button"
                  >
                    <IconSymbol name="rectangle.portrait.and.arrow.right" size={16} color={pastelGreenColors[700]} />
                    <Text style={styles.dropdownText}>
                      {isLoading ? '로그아웃 중...' : '로그아웃'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={handleLogin}
                    accessibilityLabel="로그인하기"
                    accessibilityRole="button"
                  >
                    <IconSymbol name="arrow.right.circle.fill" size={16} color={pastelGreenColors[600]} />
                    <Text style={styles.dropdownText}>로그인</Text>
                  </TouchableOpacity>
                  <View style={styles.dropdownDivider} />
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={handleSignup}
                    accessibilityLabel="회원가입하기"
                    accessibilityRole="button"
                  >
                    <IconSymbol name="person.badge.plus" size={16} color={pastelGreenColors[500]} />
                    <Text style={styles.dropdownText}>회원가입</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
      
      {/* 에러 표시 (있을 경우) */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')} style={styles.errorCloseButton}>
            <Text style={styles.errorCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { user } = useAuthStore();
  
  // 현재 활성 탭 감지
  const currentTab = segments[1] || 'index';

  // Firebase 실시간 리스너는 AuthStore에서 중앙 관리됨
  // 관리자 권한 확인 - AuthStore의 user 데이터 사용
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <CustomHeader />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: pastelGreenColors[600],
          tabBarInactiveTintColor: '#374151', // 기존 '#6b7280'에서 더 진한 회색으로 변경
          headerShown: false,
          tabBarButton: HapticTab,
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
        {isAdmin && (
          <Tabs.Screen
            name="admin"
            options={{
              title: '관리자',
              tabBarIcon: ({ color, focused }) => (
                <IconSymbol 
                  size={24} 
                  name={focused ? "shield.fill" : "shield"} 
                  color={color} 
                />
              ),
            }}
          />
        )}
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
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
  // 드롭다운 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 90 : 70,
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
