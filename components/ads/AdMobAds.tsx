import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Text } from 'react-native';
import Constants from 'expo-constants';

// Expo Go 환경 감지
const isExpoGo = Constants.appOwnership === 'expo';

// Expo Go가 아닌 경우에만 AdMob 모듈 import
let BannerAd: any, BannerAdSize: any, InterstitialAd: any, AdEventType: any, 
    RewardedAd: any, RewardedAdEventType: any, MobileAds: any, 
    MaxAdContentRating: any, TestIds: any;

if (!isExpoGo) {
  const admobModule = require('react-native-google-mobile-ads');
  BannerAd = admobModule.BannerAd;
  BannerAdSize = admobModule.BannerAdSize;
  InterstitialAd = admobModule.InterstitialAd;
  AdEventType = admobModule.AdEventType;
  RewardedAd = admobModule.RewardedAd;
  RewardedAdEventType = admobModule.RewardedAdEventType;
  MobileAds = admobModule.MobileAds;
  MaxAdContentRating = admobModule.MaxAdContentRating;
  TestIds = admobModule.TestIds;
}

// 실제 AdMob Unit ID 사용 (AdMob 콘솔에서 발급받은 실제 ID)
const AD_UNIT_IDS = !isExpoGo ? {
  banner: __DEV__ ? TestIds?.BANNER : Platform.select({
    ios: 'ca-app-pub-5100840159526765/2477197240',
    android: 'ca-app-pub-5100840159526765/5841727180',
  }),
  interstitial: __DEV__ ? TestIds?.INTERSTITIAL : Platform.select({
    ios: 'ca-app-pub-5100840159526765/2477197240', // 현재는 배너와 동일, 필요시 별도 전면광고 단위 생성
    android: 'ca-app-pub-5100840159526765/5841727180', // 현재는 배너와 동일, 필요시 별도 전면광고 단위 생성
  }),
  rewarded: __DEV__ ? TestIds?.REWARDED : Platform.select({
    ios: 'ca-app-pub-5100840159526765/5519530651', // 실제 리워드 광고 단위 ID (iOS용 별도 생성 필요시 교체)
    android: 'ca-app-pub-5100840159526765/5519530651', // 실제 Android 리워드 광고 단위 ID
  }),
} : {};

// AdMob 초기화 (Expo Go가 아닌 경우에만)
if (!isExpoGo && MobileAds) {
  MobileAds()
    .setRequestConfiguration({
      // 최대 광고 콘텐츠 등급 설정 (청소년 앱에 적합)
      maxAdContentRating: MaxAdContentRating.T,
      
      // 태그된 어린이 대상 처리 설정
      tagForChildDirectedTreatment: true,
      
      // 연령 제한 광고 처리 설정
      tagForUnderAgeOfConsent: false,
    })
    .then(() => {
      // 초기화 완료
      console.log('AdMob 초기화 완료');
    });
}

interface BannerAdComponentProps {
  size?: any;
  style?: object;
}

// 배너 광고 컴포넌트
export function BannerAdComponent({ 
  size = BannerAdSize?.BANNER, 
  style 
}: BannerAdComponentProps) {
  
  // Expo Go 환경에서는 플레이스홀더 표시
  if (isExpoGo) {
    return (
      <View style={[styles.bannerContainer, styles.placeholder, style]}>
        <Text style={styles.placeholderText}>
          📱 AdMob 광고 (Development Build에서 표시됨)
        </Text>
      </View>
    );
  }

  // AdMob 모듈이 없는 경우 빈 뷰 반환
  if (!BannerAd || !AD_UNIT_IDS.banner) {
    return <View style={style} />;
  }

  return (
    <View style={[styles.bannerContainer, style]}>
      <BannerAd
        unitId={AD_UNIT_IDS.banner!}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log('배너 광고 로드 완료');
        }}
        onAdFailedToLoad={(error: any) => {
          console.log('배너 광고 로드 실패:', error);
        }}
      />
    </View>
  );
}

// 큰 배너 광고 (커뮤니티 상단용)
export function LargeBannerAd({ style }: { style?: object }) {
  return (
    <BannerAdComponent 
      size={BannerAdSize?.LARGE_BANNER || BannerAdSize?.BANNER}
      style={[styles.largeBanner, style]}
    />
  );
}

// 중간 직사각형 광고 (피드 사이용)
export function MediumRectangleAd({ style }: { style?: object }) {
  return (
    <BannerAdComponent 
      size={BannerAdSize?.MEDIUM_RECTANGLE || BannerAdSize?.BANNER}
      style={[styles.mediumRectangle, style]}
    />
  );
}

// 게시글과 동일한 크기의 네이티브 스타일 광고 (피드 사이 삽입용)
export function NativeFeedAd({ style }: { style?: object }) {
  // Expo Go 환경에서는 게시글 스타일의 플레이스홀더 표시
  if (isExpoGo) {
    return (
      <View style={[styles.nativeFeedAd, style]}>
        <View style={styles.nativeFeedHeader}>
          <Text style={styles.adBadge}>광고</Text>
        </View>
        <View style={styles.nativeFeedContent}>
          <View style={styles.nativeFeedTextContainer}>
            <Text style={styles.nativeFeedTitle}>
              📱 광고 영역 (Development Build에서 실제 광고 표시)
            </Text>
            <Text style={styles.nativeFeedDescription}>
              이 영역에 AdMob 네이티브 광고가 표시됩니다.
            </Text>
          </View>
        </View>
        <View style={styles.nativeFeedStats}>
          <Text style={styles.nativeFeedStatItem}>후원 콘텐츠</Text>
        </View>
      </View>
    );
  }

  // 실제 환경에서는 MEDIUM_RECTANGLE 광고를 게시글 스타일로 래핑
  return (
    <View style={[styles.nativeFeedAd, style]}>
      <View style={styles.nativeFeedHeader}>
        <Text style={styles.adBadge}>광고</Text>
      </View>
      <BannerAdComponent 
        size={BannerAdSize?.MEDIUM_RECTANGLE || BannerAdSize?.BANNER}
        style={styles.nativeFeedAdContent}
      />
    </View>
  );
}

// 스마트 배너 (화면 하단용)
export function SmartBannerAd({ style }: { style?: object }) {
  const screenData = Dimensions.get('window');
  
  return (
    <BannerAdComponent 
      size={screenData.width > 728 ? (BannerAdSize?.LEADERBOARD || BannerAdSize?.BANNER) : BannerAdSize?.BANNER}
      style={[styles.smartBanner, style]}
    />
  );
}

// 전면 광고 훅
export function useInterstitialAd() {
  const [interstitial, setInterstitial] = useState<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Expo Go 환경이거나 AdMob 모듈이 없는 경우 early return
    if (isExpoGo || !InterstitialAd || !AD_UNIT_IDS.interstitial) {
      return;
    }

    const interstitialAd = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial!, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      setIsLoaded(true);
      console.log('전면 광고 로드 완료');
    });

    const unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      console.log('전면 광고 오류:', error);
      setIsLoaded(false);
    });

    const unsubscribeClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('전면 광고 닫힘');
      setIsLoaded(false);
      // 새로운 광고 로드
      interstitialAd.load();
    });

    setInterstitial(interstitialAd);
    interstitialAd.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeError();
      unsubscribeClosed();
    };
  }, []);

  const showInterstitial = () => {
    if (isLoaded && interstitial) {
      interstitial.show();
    } else {
      console.log('전면 광고가 아직 로드되지 않음');
    }
  };

  return { showInterstitial, isLoaded };
}

// 리워드 광고 훅
export function useRewardedAd(onRewardEarned?: (reward: any) => void) {
  const [rewarded, setRewarded] = useState<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Expo Go 환경이거나 AdMob 모듈이 없는 경우 early return
    if (isExpoGo || !RewardedAd || !AD_UNIT_IDS.rewarded) {
      return;
    }

    const rewardedAd = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded!, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsLoaded(true);
      console.log('리워드 광고 로드 완료');
    });

    const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      console.log('리워드 광고 오류:', error);
      setIsLoaded(false);
    });

    const unsubscribeEarned = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward: any) => {
        console.log('리워드 획득:', reward);
        // 콜백 함수가 있으면 실행
        if (onRewardEarned) {
          onRewardEarned(reward);
        }
      },
    );

    const unsubscribeClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('리워드 광고 닫힘');
      setIsLoaded(false);
      // 새로운 광고 로드
      rewardedAd.load();
    });

    setRewarded(rewardedAd);
    rewardedAd.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeError();
      unsubscribeEarned();
      unsubscribeClosed();
    };
  }, [onRewardEarned]);

  const showRewardedAd = () => {
    if (isLoaded && rewarded) {
      rewarded.show();
    } else {
      console.log('리워드 광고가 아직 로드되지 않음');
    }
  };

  return { showRewardedAd, isLoaded };
}

const styles = StyleSheet.create({
  bannerContainer: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 8,
  },
  placeholder: {
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  largeBanner: {
    height: 100,
    marginVertical: 12,
  },
  mediumRectangle: {
    height: 250,
    marginVertical: 16,
  },
  smartBanner: {
    height: 50,
    marginVertical: 8,
  },
  // 게시글과 동일한 스타일의 네이티브 피드 광고
  nativeFeedAd: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6', // 광고임을 나타내는 미묘한 테두리
  },
  nativeFeedHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  nativeFeedContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  nativeFeedTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  nativeFeedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  nativeFeedDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
    lineHeight: 20,
  },
  nativeFeedStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nativeFeedStatItem: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  nativeFeedAdContent: {
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 0,
  },
});

export default {
  BannerAdComponent,
  LargeBannerAd,
  MediumRectangleAd,
  NativeFeedAd,
  SmartBannerAd,
  useInterstitialAd,
  useRewardedAd,
};
