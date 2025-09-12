import React, { useState, useEffect } from 'react';
import { 
  View, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  Modal,
  Text,
  Pressable 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');

interface PromoBannerProps {
  /** 배너 클릭 시 실행할 함수 */
  onPress?: () => void;
  /** 배너를 숨길 수 있는지 여부 */
  dismissible?: boolean;
  /** 배너가 표시되는 조건을 체크하는 함수 */
  shouldShow?: () => boolean;
}

const BANNER_DISMISSED_KEY = 'promo_banner_dismissed';
const BANNER_DAILY_DISMISSED_KEY = 'promo_banner_daily_dismissed';
const BANNER_SHOW_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7일 (1주일)

export default function PromoBanner({ 
  onPress, 
  dismissible = true,
  shouldShow 
}: PromoBannerProps) {
  const [visible, setVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // 앱 시작 1초 후에 배너 표시 확인
    const timer = setTimeout(() => {
      checkBannerVisibility();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const checkBannerVisibility = async () => {
    try {
      console.log('🔍 배너 표시 여부 확인 시작');
      
      // 사용자 정의 조건이 있으면 먼저 확인
      if (shouldShow && !shouldShow()) {
        console.log('❌ shouldShow 조건이 false로 배너 숨김');
        return;
      }

      // 1. 먼저 일일 숨김 상태 확인 (오늘 하루 보지 않기)
      const dailyDismissedData = await AsyncStorage.getItem(BANNER_DAILY_DISMISSED_KEY);
      if (dailyDismissedData) {
        const { date } = JSON.parse(dailyDismissedData);
        const today = new Date().toDateString(); // 오늘 날짜 문자열
        
        if (date === today) {
          console.log('📅 오늘 하루 보지 않기로 설정되어 배너 숨김');
          return;
        } else {
          // 날짜가 바뀌었으면 일일 숨김 데이터 삭제
          await AsyncStorage.removeItem(BANNER_DAILY_DISMISSED_KEY);
          console.log('🗑️ 날짜가 바뀌어 일일 숨김 데이터 삭제');
        }
      }

      // 2. 영구 숨김 상태 확인 (X 버튼으로 닫기 - 7일간)
      const dismissedData = await AsyncStorage.getItem(BANNER_DISMISSED_KEY);
      console.log('📱 AsyncStorage에서 배너 숨김 데이터:', dismissedData);
      
      if (dismissedData) {
        const { timestamp } = JSON.parse(dismissedData);
        const now = Date.now();
        const timeDiff = now - timestamp;
        const hoursLeft = Math.max(0, (BANNER_SHOW_INTERVAL - timeDiff) / (60 * 60 * 1000));
        
        console.log(`⏰ 배너 숨김 후 경과 시간: ${Math.floor(timeDiff / (24 * 60 * 60 * 1000))}일, 남은 시간: ${Math.floor(hoursLeft / 24)}일`);
        
        // 7일이 지나지 않았으면 숨김
        if (timeDiff < BANNER_SHOW_INTERVAL) {
          console.log('⏳ 아직 7일이 지나지 않아 배너 숨김');
          return;
        }
      }
      
      console.log('✅ 배너 표시 조건 만족 - 배너 표시');
      setVisible(true);
    } catch (error) {
      console.error('❌ 배너 표시 여부 확인 실패:', error);
      // 오류 발생 시 기본적으로 표시
      console.log('🔄 오류 발생으로 기본 배너 표시');
      setVisible(true);
    }
  };

  // X 버튼으로 완전히 닫기 (7일간 숨김)
  const handleDismiss = async () => {
    try {
      console.log('❌ 사용자가 배너를 완전히 닫음 - 7일 후 재표시');
      await AsyncStorage.setItem(
        BANNER_DISMISSED_KEY, 
        JSON.stringify({ timestamp: Date.now() })
      );
      setVisible(false);
    } catch (error) {
      console.error('❌ 배너 숨김 처리 실패:', error);
      setVisible(false);
    }
  };

  // 오늘 하루 보지 않기 (다음 날 00시까지 숨김)
  const handleDailyDismiss = async () => {
    try {
      console.log('📅 오늘 하루 보지 않기 - 내일 00시부터 재표시');
      const today = new Date().toDateString();
      await AsyncStorage.setItem(
        BANNER_DAILY_DISMISSED_KEY, 
        JSON.stringify({ date: today })
      );
      setVisible(false);
    } catch (error) {
      console.error('❌ 일일 배너 숨김 처리 실패:', error);
      setVisible(false);
    }
  };

  // 개발/테스트용: 배너 숨김 상태 초기화 (필요시 사용)
  const resetBannerVisibility = async () => {
    try {
      await AsyncStorage.removeItem(BANNER_DISMISSED_KEY);
      console.log('🔄 배너 숨김 상태 초기화됨');
      checkBannerVisibility();
    } catch (error) {
      console.error('❌ 배너 상태 초기화 실패:', error);
    }
  };

  const handleBannerPress = () => {
    if (onPress) {
      onPress();
    } else {
      // 기본 동작: 모달로 큰 이미지 보여주기
      setModalVisible(true);
    }
  };

  if (!visible) {
    return null;
  }

  // 배너 크기 계산 (4:5 비율, 화면 너비의 80% 사용하여 적절한 여백 확보)
  const bannerWidth = Math.min(screenWidth * 0.8, 320); // 최대 320px로 제한
  const bannerHeight = (bannerWidth / 4) * 5;

  return (
    <>
      <View style={styles.container}>
        <View style={[styles.bannerWrapper, { width: bannerWidth }]}>
          <TouchableOpacity
            style={[styles.bannerContainer, { width: bannerWidth, height: bannerHeight }]}
            onPress={handleBannerPress}
            activeOpacity={0.95}
            accessible={true}
            accessibilityLabel="홍보 배너"
            accessibilityHint="배너를 탭하면 자세히 볼 수 있습니다"
            accessibilityRole="button"
          >
            <Image
              source={require('../assets/images/banner.png')}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            
            {/* 닫기 버튼 */}
            {dismissible && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessible={true}
                accessibilityLabel="배너 닫기"
                accessibilityHint="7일간 배너를 숨깁니다"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={24} color="rgba(0,0,0,0.6)" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          
          {/* 오늘 하루 보지 않기 버튼 */}
          {dismissible && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDailyDismiss}
              activeOpacity={0.8}
              accessible={true}
              accessibilityLabel="오늘 하루 보지 않기"
              accessibilityHint="내일 00시까지 배너를 숨깁니다"
              accessibilityRole="button"
            >
              <Text style={styles.dismissButtonText}>오늘 하루 보지 않기</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 전체 화면 모달 */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Image
                source={require('../assets/images/banner.png')}
                style={styles.modalImage}
                resizeMode="contain"
              />
              
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close-circle" size={32} color="white" />
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 20,
  },
  bannerWrapper: {
    alignItems: 'center',
  },
  bannerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    backgroundColor: '#fff',
    // 터치 피드백을 위한 스타일
    transform: [{ scale: 1 }],
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 380,
    aspectRatio: 4/5,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.34,
    shadowRadius: 6.27,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: -20,
    right: -20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 24,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dismissButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  dismissButtonText: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    fontWeight: '500',
    textAlign: 'center',
  },
});
