import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { 
  BannerAd, 
  BannerAdSize, 
  InterstitialAd, 
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  MobileAds,
  MaxAdContentRating,
  TestIds
} from 'react-native-google-mobile-ads';

// 실제 AdMob Unit ID 사용 (AdMob 콘솔에서 발급받은 실제 ID)
const AD_UNIT_IDS = {
  banner: __DEV__ ? TestIds.BANNER : Platform.select({
    ios: 'ca-app-pub-5100840159526765/2477197240',
    android: 'ca-app-pub-5100840159526765/5841727180',
  }),
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : Platform.select({
    ios: 'ca-app-pub-5100840159526765/2477197240', // 현재는 배너와 동일, 필요시 별도 전면광고 단위 생성
    android: 'ca-app-pub-5100840159526765/5841727180', // 현재는 배너와 동일, 필요시 별도 전면광고 단위 생성
  }),
  rewarded: __DEV__ ? TestIds.REWARDED : Platform.select({
    ios: 'ca-app-pub-5100840159526765/2477197240', // 현재는 배너와 동일, 필요시 별도 리워드광고 단위 생성
    android: 'ca-app-pub-5100840159526765/5841727180', // 현재는 배너와 동일, 필요시 별도 리워드광고 단위 생성
  }),
};

// AdMob 초기화
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

interface BannerAdComponentProps {
  size?: BannerAdSize;
  style?: object;
}

// 배너 광고 컴포넌트
export function BannerAdComponent({ 
  size = BannerAdSize.BANNER, 
  style 
}: BannerAdComponentProps) {

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
        onAdFailedToLoad={(error) => {
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
      size={BannerAdSize.LARGE_BANNER}
      style={[styles.largeBanner, style]}
    />
  );
}

// 중간 직사각형 광고 (피드 사이용)
export function MediumRectangleAd({ style }: { style?: object }) {
  return (
    <BannerAdComponent 
      size={BannerAdSize.MEDIUM_RECTANGLE}
      style={[styles.mediumRectangle, style]}
    />
  );
}

// 스마트 배너 (화면 하단용)
export function SmartBannerAd({ style }: { style?: object }) {
  const screenData = Dimensions.get('window');
  
  return (
    <BannerAdComponent 
      size={screenData.width > 728 ? BannerAdSize.LEADERBOARD : BannerAdSize.BANNER}
      style={[styles.smartBanner, style]}
    />
  );
}

// 전면 광고 훅
export function useInterstitialAd() {
  const [interstitial, setInterstitial] = useState<InterstitialAd | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const interstitialAd = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial!, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      setIsLoaded(true);
      console.log('전면 광고 로드 완료');
    });

    const unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
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
export function useRewardedAd() {
  const [rewarded, setRewarded] = useState<RewardedAd | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const rewardedAd = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded!, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsLoaded(true);
      console.log('리워드 광고 로드 완료');
    });

    const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('리워드 광고 오류:', error);
      setIsLoaded(false);
    });

    const unsubscribeEarned = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward) => {
        console.log('리워드 획득:', reward);
        // 여기서 리워드 로직 처리 (경험치 추가 등)
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
  }, []);

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
});

export default {
  BannerAdComponent,
  LargeBannerAd,
  MediumRectangleAd,
  SmartBannerAd,
  useInterstitialAd,
  useRewardedAd,
};
