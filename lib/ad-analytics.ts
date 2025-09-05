import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// 광고 시청 통계 타입
export interface AdWatchStats {
  totalUsers: number;
  totalWatches: number;
  avgWatchesPerUser: number;
  topWatchers: Array<{
    userId: string;
    watchCount: number;
    lastWatchTime: number;
  }>;
  dailyStats: Array<{
    date: string;
    uniqueUsers: number;
    totalWatches: number;
  }>;
}

// 특정 날짜의 광고 시청 통계 조회
export async function getDailyAdStats(date: string): Promise<AdWatchStats> {
  try {
    const adWatchQuery = collection(db, 'users');
    const usersSnapshot = await getDocs(adWatchQuery);
    
    let totalUsers = 0;
    let totalWatches = 0;
    const userWatches: Array<{ userId: string; watchCount: number; lastWatchTime: number }> = [];
    
    // 모든 사용자의 해당 날짜 광고 시청 데이터 조회
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const adWatchDocRef = collection(db, 'users', userId, 'adWatchData');
      const dateQuery = query(adWatchDocRef, where('date', '==', date));
      const adWatchSnapshot = await getDocs(dateQuery);
      
      if (!adWatchSnapshot.empty) {
        const adData = adWatchSnapshot.docs[0].data();
        totalUsers++;
        totalWatches += adData.count || 0;
        
        userWatches.push({
          userId,
          watchCount: adData.count || 0,
          lastWatchTime: adData.lastWatchTime || 0
        });
      }
    }
    
    // 상위 시청자 정렬
    const topWatchers = userWatches
      .sort((a, b) => b.watchCount - a.watchCount)
      .slice(0, 10);
    
    return {
      totalUsers,
      totalWatches,
      avgWatchesPerUser: totalUsers > 0 ? totalWatches / totalUsers : 0,
      topWatchers,
      dailyStats: [{
        date,
        uniqueUsers: totalUsers,
        totalWatches
      }]
    };
  } catch (error) {
    console.error('광고 통계 조회 오류:', error);
    throw error;
  }
}

// 사용자별 광고 시청 기록 조회
export async function getUserAdHistory(userId: string, limitCount: number = 30) {
  try {
    const adWatchRef = collection(db, 'users', userId, 'adWatchData');
    const adHistoryQuery = query(
      adWatchRef,
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(adHistoryQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('사용자 광고 기록 조회 오류:', error);
    throw error;
  }
}

// 광고 수익 예상 계산
export function calculateEstimatedRevenue(watchCount: number): {
  daily: number;
  monthly: number;
  yearly: number;
} {
  // AdMob 리워드 광고 평균 eCPM: $12.00
  const eCPM = 12.00;
  const dailyRevenue = (watchCount * eCPM) / 1000;
  
  return {
    daily: Math.round(dailyRevenue * 100) / 100,
    monthly: Math.round(dailyRevenue * 30 * 100) / 100,
    yearly: Math.round(dailyRevenue * 365 * 100) / 100
  };
}

// 실시간 광고 시청 모니터링 (관리자용)
export async function getRealtimeAdStats(): Promise<{
  todayStats: AdWatchStats;
  estimatedRevenue: ReturnType<typeof calculateEstimatedRevenue>;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await getDailyAdStats(today);
    const estimatedRevenue = calculateEstimatedRevenue(todayStats.totalWatches);
    
    return {
      todayStats,
      estimatedRevenue
    };
  } catch (error) {
    console.error('실시간 광고 통계 조회 오류:', error);
    throw error;
  }
}
