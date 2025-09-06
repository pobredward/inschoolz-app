import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Expo Go 환경 감지
const isExpoGo = Constants.appOwnership === 'expo';

// 리워드 광고만 사용하므로 필요한 모듈만 import
let RewardedAd: any, RewardedAdEventType: any, AdEventType: any, TestIds: any;

if (!isExpoGo) {
  try {
    const admobModule = require('react-native-google-mobile-ads');
    RewardedAd = admobModule.RewardedAd;
    RewardedAdEventType = admobModule.RewardedAdEventType;
    AdEventType = admobModule.AdEventType;
    TestIds = admobModule.TestIds;
  } catch (error) {
    console.warn('AdMob 모듈을 로드할 수 없습니다:', error);
  }
}

// 리워드 광고 Unit ID만 (실제 사용하는 것만)
const REWARDED_AD_UNIT_ID = !isExpoGo ? (
  __DEV__ ? TestIds?.REWARDED : Platform.select({
    ios: 'ca-app-pub-5100840159526765/5519530651',
    android: 'ca-app-pub-5100840159526765/5519530651',
  })
) : null;

/**
 * 리워드 광고 훅 (완전 최적화된 버전)
 * - 클릭할 때만 광고 로드 (앱 시작 시 로드 안함)
 * - 사용하지 않는 배너/전면 광고 코드 제거
 * - TestFlight 버벅임 완전 해결
 */
export function useRewardedAd(onRewardEarned?: (reward: any) => void) {
  const [rewarded, setRewarded] = useState<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 광고 로드 함수 (클릭할 때만 호출)
  const loadRewardedAd = () => {
    // Expo Go 환경이거나 AdMob 모듈이 없는 경우 early return
    if (isExpoGo || !RewardedAd || !REWARDED_AD_UNIT_ID) {
      console.log('AdMob을 사용할 수 없는 환경입니다');
      return;
    }

    if (isLoading || isLoaded) {
      console.log('이미 광고를 로딩 중이거나 로드 완료됨');
      return;
    }

    setIsLoading(true);
    console.log('🎬 리워드 광고 로드 시작 (클릭 시 로딩)');

    try {
      const rewardedAd = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID!, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setIsLoaded(true);
        setIsLoading(false);
        console.log('✅ 리워드 광고 로드 완료 (클릭 시 로딩)');
      });

      const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log('❌ 리워드 광고 오류:', error);
        setIsLoaded(false);
        setIsLoading(false);
      });

      const unsubscribeEarned = rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward: any) => {
          console.log('🎉 리워드 획득:', reward);
          if (onRewardEarned) {
            onRewardEarned(reward);
          }
        },
      );

      const unsubscribeClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('📱 리워드 광고 닫힘');
        setIsLoaded(false);
        setRewarded(null);
        // 다음 광고는 다시 클릭할 때 로드
      });

      setRewarded(rewardedAd);
      rewardedAd.load();
      
      // 클린업 함수들을 광고 객체에 저장
      (rewardedAd as any)._unsubscribers = [
        unsubscribeLoaded,
        unsubscribeError,
        unsubscribeEarned,
        unsubscribeClosed,
      ];
    } catch (error) {
      console.error('❌ 리워드 광고 초기화 실패:', error);
      setIsLoading(false);
    }
  };

  const showRewardedAd = () => {
    if (isLoaded && rewarded) {
      rewarded.show();
    } else if (!isLoading && !isLoaded) {
      // 광고가 로드되지 않은 경우 로드 시작
      loadRewardedAd();
    } else {
      console.log('⏳ 리워드 광고 로딩 중...');
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (rewarded && (rewarded as any)._unsubscribers) {
        (rewarded as any)._unsubscribers.forEach((unsubscribe: () => void) => {
          unsubscribe();
        });
      }
    };
  }, [rewarded]);

  return { 
    showRewardedAd, 
    isLoaded, 
    isLoading,
    loadRewardedAd // 수동 로드를 위한 함수 제공
  };
}

// 실제 사용하는 것만 export (사용하지 않는 배너/전면 광고 제거)
export default {
  useRewardedAd,
};
