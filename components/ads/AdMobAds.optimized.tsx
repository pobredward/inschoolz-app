import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

// Expo Go 환경 감지
const isExpoGo = Constants.appOwnership === 'expo';

// Expo Go가 아닌 경우에만 AdMob 모듈 import (리워드 광고만)
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

// 리워드 광고 훅 (최적화된 버전 - 사용하는 것만)
export function useRewardedAd(onRewardEarned?: (reward: any) => void) {
  const [rewarded, setRewarded] = useState<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Expo Go 환경이거나 AdMob 모듈이 없는 경우 early return
    if (isExpoGo || !RewardedAd || !REWARDED_AD_UNIT_ID) {
      return;
    }

    // 지연 로딩으로 성능 개선 - 3초 후에 광고 로드
    const loadTimer = setTimeout(() => {
      try {
        const rewardedAd = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID!, {
          requestNonPersonalizedAdsOnly: false,
        });

        const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
          setIsLoaded(true);
          console.log('리워드 광고 로드 완료 (최적화된 버전)');
        });

        const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
          console.log('리워드 광고 오류:', error);
          setIsLoaded(false);
        });

        const unsubscribeEarned = rewardedAd.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          (reward: any) => {
            console.log('리워드 획득:', reward);
            if (onRewardEarned) {
              onRewardEarned(reward);
            }
          },
        );

        const unsubscribeClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
          console.log('리워드 광고 닫힘');
          setIsLoaded(false);
          // 새로운 광고 로드 (5초 지연)
          setTimeout(() => {
            rewardedAd.load();
          }, 5000);
        });

        setRewarded(rewardedAd);
        rewardedAd.load();
        
        return () => {
          unsubscribeLoaded();
          unsubscribeError();
          unsubscribeEarned();
          unsubscribeClosed();
        };
      } catch (error) {
        console.error('리워드 광고 초기화 실패:', error);
      }
    }, 3000); // 3초 지연 로딩

    return () => {
      clearTimeout(loadTimer);
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

// 스타일은 필요한 것만
const styles = StyleSheet.create({
  // 현재는 리워드 광고만 사용하므로 스타일 불필요
});

// 실제 사용하는 것만 export
export default {
  useRewardedAd,
};
