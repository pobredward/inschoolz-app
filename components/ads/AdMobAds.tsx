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
    ios: 'ca-app-pub-5100840159526765/6241709090',
    android: 'ca-app-pub-5100840159526765/5519530651',
  })
) : null;

/**
 * 리워드 광고 훅 (클릭 시 로딩 버전)
 * - 클릭할 때만 광고 로드로 리소스 절약
 * - 로딩 실패 시 자동 재시도 로직
 * - 향상된 사용자 피드백
 */
export function useRewardedAd(onRewardEarned?: (reward: any) => void) {
  const [rewarded, setRewarded] = useState<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const [loadStartTime, setLoadStartTime] = useState<number>(0);

  // 광고 로드 함수 (개선된 버전)
  const loadRewardedAd = (isRetry: boolean = false) => {
    // Expo Go 환경이거나 AdMob 모듈이 없는 경우 early return
    if (isExpoGo || !RewardedAd || !REWARDED_AD_UNIT_ID) {
      console.log('AdMob을 사용할 수 없는 환경입니다');
      return;
    }

    // 너무 빈번한 로드 방지 (30초 간격)
    const now = Date.now();
    if (!isRetry && now - lastLoadTime < 30000) {
      console.log('광고 로드 요청이 너무 빈번합니다. 잠시 후 시도하세요.');
      return;
    }

    if (isLoading) {
      console.log('이미 광고를 로딩 중입니다');
      return;
    }

    if (isLoaded && rewarded) {
      console.log('광고가 이미 로드되어 있습니다');
      return;
    }

    // 최대 재시도 횟수 제한 (3회)
    if (loadAttempts >= 3) {
      console.log('광고 로드 최대 재시도 횟수 초과');
      return;
    }

    setIsLoading(true);
    setLastLoadTime(now);
    setLoadStartTime(now);
    setLoadAttempts(prev => prev + 1);
    console.log(`🎬 리워드 광고 로드 시작 (시도 ${loadAttempts + 1}/3)`);

    try {
      const rewardedAd = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID!, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setIsLoaded(true);
        setIsLoading(false);
        setLoadAttempts(0); // 성공 시 재시도 카운터 리셋
        console.log('✅ 리워드 광고 로드 완료');
      });

      const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log('❌ 리워드 광고 오류:', error);
        setIsLoaded(false);
        setIsLoading(false);
        
        // 자동 재시도 (3초 후)
        if (loadAttempts < 3) {
          console.log(`🔄 3초 후 자동 재시도 (${loadAttempts + 1}/3)`);
          setTimeout(() => {
            loadRewardedAd(true);
          }, 3000);
        }
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
        
        // 다음 광고는 클릭할 때 로드
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
      
      // 초기화 실패 시에도 재시도
      if (loadAttempts < 3) {
        setTimeout(() => {
          loadRewardedAd(true);
        }, 5000);
      }
    }
  };

  // 사전 로딩 제거 - 클릭할 때만 로드

  const showRewardedAd = () => {
    if (isLoaded && rewarded) {
      rewarded.show();
    } else if (!isLoading) {
      // 광고가 로드되지 않은 경우 즉시 로드 시작
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

  // 로딩 시간 계산 (초 단위)
  const getLoadingTime = () => {
    if (!isLoading || loadStartTime === 0) return 0;
    return Math.floor((Date.now() - loadStartTime) / 1000);
  };

  return { 
    showRewardedAd, 
    isLoaded, 
    isLoading,
    loadRewardedAd, // 수동 로드를 위한 함수 제공
    loadAttempts, // 재시도 횟수 정보 제공
    loadingTime: getLoadingTime() // 현재 로딩 시간
  };
}

// 실제 사용하는 것만 export (사용하지 않는 배너/전면 광고 제거)
export default {
  useRewardedAd,
};
