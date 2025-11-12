import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const [loadStartTime, setLoadStartTime] = useState<number>(0);
  
  // useRef를 사용하여 동기적으로 값을 관리 (state 업데이트 타이밍 문제 해결)
  const loadAttemptsRef = useRef(0);
  const lastLoadTimeRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 광고 로드 함수 (개선된 버전)
  const loadRewardedAd = useCallback((isRetry: boolean = false) => {
    // Expo Go 환경이거나 AdMob 모듈이 없는 경우 early return
    if (isExpoGo || !RewardedAd || !REWARDED_AD_UNIT_ID) {
      console.log('AdMob을 사용할 수 없는 환경입니다');
      return;
    }

    const now = Date.now();

    // 이미 로딩 중이면 중단
    if (isLoading) {
      console.log('이미 광고를 로딩 중입니다');
      return;
    }

    // 이미 로드된 광고가 있으면 중단
    if (isLoaded && rewarded) {
      console.log('광고가 이미 로드되어 있습니다');
      return;
    }

    // 최대 재시도 횟수 제한 (3회) - ref 사용으로 정확한 값 체크
    if (loadAttemptsRef.current >= 3) {
      console.log('광고 로드 최대 재시도 횟수 초과');
      return;
    }

    // 너무 빈번한 로드 방지 (재시도가 아닌 경우 5초 간격)
    if (!isRetry && now - lastLoadTimeRef.current < 5000) {
      console.log('광고 로드 요청이 너무 빈번합니다. 잠시 후 시도하세요.');
      return;
    }

    // 이전 재시도 타이머 취소
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setIsLoading(true);
    lastLoadTimeRef.current = now;
    setLoadStartTime(now);
    loadAttemptsRef.current += 1;
    console.log(`🎬 리워드 광고 로드 시작 (시도 ${loadAttemptsRef.current}/3)`);

    try {
      const rewardedAd = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID!, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setIsLoaded(true);
        setIsLoading(false);
        loadAttemptsRef.current = 0; // 성공 시 재시도 카운터 리셋
        console.log('✅ 리워드 광고 로드 완료');
      });

      const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log('❌ 리워드 광고 오류:', error);
        setIsLoaded(false);
        setIsLoading(false);
        
        // 자동 재시도 (현재 시도 횟수가 3 미만일 때만)
        const currentAttempts = loadAttemptsRef.current;
        if (currentAttempts < 3) {
          console.log(`🔄 5초 후 자동 재시도 (${currentAttempts}/3)`);
          retryTimeoutRef.current = setTimeout(() => {
            loadRewardedAd(true);
          }, 5000); // 3초 -> 5초로 증가하여 안정성 향상
        } else {
          console.log('❌ 최대 재시도 횟수에 도달했습니다. 광고를 불러올 수 없습니다.');
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
        loadAttemptsRef.current = 0; // 광고 닫힐 때 재시도 카운터 리셋
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
      const currentAttempts = loadAttemptsRef.current;
      if (currentAttempts < 3) {
        console.log(`🔄 5초 후 자동 재시도 (초기화 실패, ${currentAttempts}/3)`);
        retryTimeoutRef.current = setTimeout(() => {
          loadRewardedAd(true);
        }, 5000);
      }
    }
  }, [isLoading, isLoaded, rewarded, onRewardEarned]);

  // 컴포넌트 마운트 시 광고 미리 로드 (사용자 경험 개선)
  useEffect(() => {
    // 5초 후 자동으로 광고 미리 로드 (초기 렌더링 후)
    const preloadTimer = setTimeout(() => {
      if (!isLoaded && !isLoading) {
        console.log('📱 광고 사전 로딩 시작 (사용자 경험 개선)');
        loadRewardedAd();
      }
    }, 5000); // 5초 딜레이로 앱 초기 로딩에 영향 없음

    return () => clearTimeout(preloadTimer);
  }, [isLoaded, isLoading, loadRewardedAd]); // 필요한 의존성 포함

  const showRewardedAd = () => {
    if (isLoaded && rewarded) {
      rewarded.show();
    } else if (!isLoading) {
      // 광고가 로드되지 않은 경우 즉시 로드 시작
      console.log('📱 광고가 로드되지 않음 - 즉시 로딩 시작');
      loadRewardedAd();
    } else {
      console.log('⏳ 리워드 광고 로딩 중...');
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 타이머 정리
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // 광고 리스너 정리
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
    loadAttempts: loadAttemptsRef.current, // 재시도 횟수 정보 제공 (ref 사용)
    loadingTime: getLoadingTime() // 현재 로딩 시간
  };
}

// 실제 사용하는 것만 export (사용하지 않는 배너/전면 광고 제거)
export default {
  useRewardedAd,
};
