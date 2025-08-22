import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateGameScore, getUserGameStats } from '../../lib/games';
import { getExperienceSettings } from '../../lib/experience';
import { Ionicons } from '@expo/vector-icons';

type GameState = 'waiting' | 'ready' | 'active' | 'finished';

interface GameResult {
  reactionTime: number;
  round: number;
}

interface RankingUser {
  id: string;
  nickname: string;
  bestReactionTime: number; // ms 단위
  schoolName?: string;
}

export default function ReactionGameScreen() {
  const { user, setupRealtimeUserListener } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [result, setResult] = useState<GameResult | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [experienceThresholds, setExperienceThresholds] = useState<Array<{minReactionTime: number; xpReward: number}>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const maxAttempts = 5;

  // 랭킹 데이터 로드
  const loadRankings = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('gameStats.reactionGame.bestReactionTime', '>', 0),
        orderBy('gameStats.reactionGame.bestReactionTime', 'asc'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const rankingData: RankingUser[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const bestReactionTime = userData.gameStats?.reactionGame?.bestReactionTime;
        
        if (bestReactionTime) {
          rankingData.push({
            id: doc.id,
            nickname: userData.profile?.userName || '익명',
            bestReactionTime: bestReactionTime,
            schoolName: userData.school?.name
          });
        }
      });
      
      setRankings(rankingData);
    } catch (error) {
      console.error('랭킹 데이터 로드 실패:', error);
    }
  };

  // 경험치 설정 로드 (Firebase 직접 호출)
  const loadExperienceSettings = async () => {
    try {
      // 캐시 무효화하여 최신 Firebase 설정 가져오기
      const { invalidateSystemSettingsCache } = await import('@/lib/experience');
      invalidateSystemSettingsCache();
      
      const settings = await getExperienceSettings();
      
      if (settings.games?.reactionGame?.thresholds) {
        // Firebase threshold를 직접 사용 (minScore를 ms로 해석)
        const timeBasedThresholds = settings.games.reactionGame.thresholds.map((threshold: any) => ({
          minReactionTime: threshold.minScore, // minScore가 실제로는 ms 값
          xpReward: threshold.xpReward
        })).sort((a: any, b: any) => a.minReactionTime - b.minReactionTime); // 빠른 시간 순으로 정렬
        
        setExperienceThresholds(timeBasedThresholds);
        console.log('Experience thresholds loaded:', timeBasedThresholds);
      }
    } catch (error) {
      console.error('경험치 설정 로드 실패:', error);
    }
  };

  // 남은 기회 실시간 조회
  const loadRemainingAttempts = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoadingStats(true);
      const statsResponse = await getUserGameStats(user.uid);
      
      if (statsResponse.success && statsResponse.data) {
        const todayPlays = statsResponse.data.todayPlays.reactionGame || 0;
        const maxPlays = statsResponse.data.maxPlays || 5;
        const remaining = Math.max(0, maxPlays - todayPlays);
        
        setRemainingAttempts(remaining);
        setCurrentAttempt(todayPlays + 1);
      }
    } catch (error) {
      console.error('게임 통계 로드 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadRankings();
      loadExperienceSettings();
      loadRemainingAttempts();
    }
  }, [user?.uid]);

  // Firebase 실시간 리스너는 AuthStore에서 중앙 관리됨

  // 새로고침
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadRankings(),
      loadExperienceSettings(),
      loadRemainingAttempts()
    ]);
    setRefreshing(false);
  };

  // 게임 시작 (색상 변경 시작)
  const startGame = async () => {
    if (gameState !== 'waiting' || remainingAttempts <= 0) return;
    
    // 플레이 전 제한 재확인
    if (user?.uid) {
      try {
        const { checkDailyLimit } = await import('../../lib/experience');
        const limitCheck = await checkDailyLimit(user.uid, 'games', 'reactionGame');
        if (!limitCheck.canEarnExp) {
          Alert.alert(
            '플레이 제한',
            `오늘의 반응속도 게임 플레이 횟수를 모두 사용했습니다. (${limitCheck.currentCount}/${limitCheck.limit})`
          );
          loadRemainingAttempts(); // 상태 새로고침
          return;
        }
      } catch (error) {
        console.error('제한 확인 오류:', error);
        Alert.alert('오류', '게임을 시작할 수 없습니다.');
        return;
      }
    }
    
    setGameState('ready');
    setResult(null);
    
    // 2-5초 후 랜덤하게 색상 변경
    const delay = Math.random() * 3000 + 2000;
    const id = setTimeout(() => {
      setGameState('active');
      setStartTime(performance.now());
    }, delay);
    
    setTimeoutId(id);
  };

  // 게임 영역 터치 처리
  const handleGamePress = () => {
    if (gameState === 'waiting') {
      startGame();
    } else if (gameState === 'active') {
      const endTime = performance.now();
      const reactionTime = endTime - startTime;
      
      // timeout 정리
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      
      setResult({
        reactionTime,
        round: currentAttempt
      });
      setGameState('finished');
      
      // 게임 결과 저장
      finishGame(reactionTime);
    } else if (gameState === 'ready') {
      // 너무 빨리 터치한 경우
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      
      Alert.alert('너무 빨라요!', '초록색으로 변할 때까지 기다리세요.');
      setGameState('waiting');
    }
  };

  // 게임 종료 및 점수 저장
  const finishGame = async (reactionTime: number) => {
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    console.log(`finishGame - 반응시간: ${reactionTime}ms`);
    console.log('finishGame - 현재 경험치 임계값:', experienceThresholds);

    try {
      // 반응시간을 점수로 변환 (반응시간이 빠를수록 높은 점수)
      // 1000ms 기준으로 점수 계산
      const score = Math.max(1, Math.round(1000 - reactionTime + 100));
      console.log(`finishGame - 계산된 점수: ${score}`);
      
      const result = await updateGameScore(user.uid, 'reactionGame', score, reactionTime);
      console.log('finishGame - updateGameScore 결과:', result);
      
      if (result.success) {
        // 경험치 얼럿 표시
        if (result.leveledUp && result.oldLevel && result.newLevel) {
          Alert.alert(
            '🎉 레벨업!',
            `축하합니다! 레벨 ${result.oldLevel}에서 레벨 ${result.newLevel}로 레벨업했습니다!\\n경험치 +${result.xpEarned} XP 획득!`,
            [{ text: '확인' }]
          );
        } else if (result.xpEarned && result.xpEarned > 0) {
          Alert.alert(
            '⭐ 경험치 획득!',
            `반응속도 게임 완료!\\n${(reactionTime / 1000).toFixed(3)}초 기록\\n경험치 +${result.xpEarned} XP 획득!`,
            [{ text: '확인' }]
          );
        } else {
          console.log('finishGame - 경험치를 얻지 못함:', result.xpEarned);
          Alert.alert(
            '게임 완료',
            `반응속도: ${(reactionTime / 1000).toFixed(3)}초\\n경험치를 얻지 못했습니다.`,
            [{ text: '확인' }]
          );
        }
        
        // 성공 시 랭킹 새로고침 및 남은 기회 업데이트
        loadRankings();
        loadRemainingAttempts();
      } else {
        Alert.alert('오류', result.message || '점수 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('게임 결과 저장 실패:', error);
      Alert.alert('오류', '게임 결과 저장 중 오류가 발생했습니다.');
    }
  };

  // 다시 하기
  const resetGame = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setGameState('waiting');
    setResult(null);
    
    // 남은 기회 새로고침
    loadRemainingAttempts();
  };

  const getGameButtonText = () => {
    if (remainingAttempts <= 0) return ['오늘의 기회 소진'];
    if (gameState === 'waiting') return ['게임 시작', '(터치하세요!)'];
    if (gameState === 'ready') return ['초록색으로 변하면', '터치!'];
    if (gameState === 'active') return ['지금 터치!'];
    if (gameState === 'finished') return ['게임 완료'];
    return ['게임 시작'];
  };

  const getGameButtonColor = () => {
    if (remainingAttempts <= 0) return '#9CA3AF'; // gray-400
    if (gameState === 'waiting') return '#EF4444'; // red-500
    if (gameState === 'ready') return '#EAB308'; // yellow-500
    if (gameState === 'active') return '#22C55E'; // green-500
    if (gameState === 'finished') return '#3B82F6'; // blue-500
    return '#EF4444';
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginPrompt}>
          <Text style={styles.loginTitle}>로그인이 필요합니다</Text>
          <Text style={styles.loginDescription}>
            반응속도 게임을 플레이하려면 로그인해주세요.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      
      {/* 고정 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>반응속도 게임</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 스크롤 가능한 컨텐츠 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingTop: insets.top + 56 } // 헤더 높이만큼 상단 패딩
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

          {/* 게임 영역 */}
          <View style={styles.gameArea}>
            <Text style={styles.gameDescription}>
              초록색으로 바뀌는 순간 최대한 빠르게 터치하세요!
            </Text>
            
            {/* 남은 기회 표시 */}
            <View style={styles.attemptsContainer}>
              {isLoadingStats ? (
                <Text style={styles.loadingText}>로딩중...</Text>
              ) : (
                <Text style={styles.attemptsText}>
                  오늘 남은 기회: {remainingAttempts}/{maxAttempts}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={[
                styles.gameButton,
                { backgroundColor: getGameButtonColor() },
                remainingAttempts <= 0 && styles.disabledButton,
              ]}
              onPress={handleGamePress}
              disabled={remainingAttempts <= 0 || gameState === 'ready'}
            >
              <View style={styles.gameButtonTextContainer}>
                {getGameButtonText().map((text, index) => (
                  <Text 
                    key={index} 
                    style={[
                      styles.gameButtonText,
                      index === 1 && styles.gameButtonSubText
                    ]}
                  >
                    {text}
                  </Text>
                ))}
              </View>
            </TouchableOpacity>

            {/* 게임 결과 */}
            {result && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>게임 결과</Text>
                <View style={styles.resultGrid}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultValue}>
                      {(result.reactionTime / 1000).toFixed(3)}초
                    </Text>
                    <Text style={styles.resultLabel}>반응 시간</Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultValue}>
                      {Math.round(100000 / result.reactionTime)}점
                    </Text>
                    <Text style={styles.resultLabel}>점수</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 게임 버튼들 */}
            <View style={styles.buttonContainer}>
              {gameState === 'finished' && remainingAttempts > 0 && (
                <TouchableOpacity style={styles.playAgainButton} onPress={resetGame}>
                  <Text style={styles.playAgainText}>▶ 다시 하기</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 경험치 정보 */}
          {experienceThresholds.length > 0 && (
            <View style={styles.xpContainer}>
              <Text style={styles.xpTitle}>⭐ 경험치 정보</Text>
              <Text style={styles.xpDescription}>
                반응속도가 빠를수록 더 많은 경험치를 획득할 수 있습니다!
              </Text>
              {experienceThresholds
                .sort((a, b) => a.minReactionTime - b.minReactionTime)
                .map((threshold, index) => (
                  <View key={index} style={styles.xpItem}>
                    <Text style={styles.xpText}>{threshold.minReactionTime}ms 이하</Text>
                    <View style={styles.xpBadge}>
                      <Text style={styles.xpBadgeText}>+{threshold.xpReward} XP</Text>
                    </View>
                  </View>
                ))}
              <Text style={styles.xpTip}>
                💡 팁: 100ms 이하로 반응하면 최대 경험치를 획득할 수 있어요!
              </Text>
            </View>
          )}

          {/* TOP 10 랭킹 */}
          <View style={styles.rankingContainer}>
            <Text style={styles.rankingTitle}>🏆 TOP 10 랭킹</Text>
            {rankings.length > 0 ? (
              rankings.map((user, index) => (
                <View key={user.id} style={styles.rankingItem}>
                  <View style={styles.rankingLeft}>
                    <View style={[
                      styles.rankBadge,
                      index === 0 ? styles.goldBadge :
                      index === 1 ? styles.silverBadge :
                      index === 2 ? styles.bronzeBadge :
                      styles.defaultBadge
                    ]}>
                      <Text style={[
                        styles.rankText,
                        index < 3 ? styles.medalText : styles.defaultRankText
                      ]}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>{user.nickname}</Text>
                      {user.schoolName && (
                        <Text style={styles.schoolName} numberOfLines={1}>{user.schoolName}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.rankingRight}>
                    <Text style={styles.reactionTime}>{user.bestReactionTime.toFixed(2)}ms</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>아직 랭킹 데이터가 없습니다.</Text>
            )}
          </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 10,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    zIndex: 1000,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  attemptsContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  attemptsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  gameArea: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gameButton: {
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  gameButtonTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  gameButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gameButtonSubText: {
    fontSize: 14,
    marginTop: 4,
  },
  gameDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 15,
  },
  resultContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resultItem: {
    alignItems: 'center',
  },
  resultValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  resultLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  playAgainButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  playAgainText: {
    color: 'white',
    fontWeight: '600',
  },
  xpContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 3,
  },
  xpTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  xpDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  xpItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  xpText: {
    fontSize: 14,
    color: '#4B5563',
  },
  xpBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  xpTip: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  rankingContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 3,
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  goldBadge: {
    backgroundColor: '#EAB308',
  },
  silverBadge: {
    backgroundColor: '#9CA3AF',
  },
  bronzeBadge: {
    backgroundColor: '#D97706',
  },
  defaultBadge: {
    backgroundColor: '#F3F4F6',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  medalText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  defaultRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
  },
  schoolName: {
    fontSize: 12,
    color: '#6B7280',
  },
  rankingRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 60,
  },
  reactionTime: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  noDataText: {
    textAlign: 'center',
    color: '#6B7280',
    paddingVertical: 20,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  loginDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: '600',
  },
}); 