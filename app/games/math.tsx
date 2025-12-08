import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateGameScore, getUserGameStats } from '../../lib/games';
import { Ionicons } from '@expo/vector-icons';
import { useQuest } from '../../providers/QuestProvider';

type GameState = 'waiting' | 'playing' | 'finished';

interface MathProblem {
  num1: number;
  num2: number;
  operator: '+' | '-';
  answer: number;
}

interface RankingUser {
  id: string;
  nickname: string;
  bestScore: number;
  schoolName?: string;
}

export default function MathGameScreen() {
  const { user } = useAuthStore();
  const { trackAction } = useQuest();
  const insets = useSafeAreaInsets();
  
  // 게임 상태
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [totalProblems, setTotalProblems] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  
  // 통계 및 랭킹
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const maxAttempts = 5;

  // 랜덤 문제 생성 (1~20 범위 덧셈/뺄셈)
  const generateProblem = useCallback((): MathProblem => {
    const num1 = Math.floor(Math.random() * 20) + 1; // 1-20
    const num2 = Math.floor(Math.random() * 20) + 1; // 1-20
    const operator = Math.random() < 0.5 ? '+' : '-';
    
    let answer: number;
    let finalNum1: number;
    let finalNum2: number;
    
    if (operator === '-') {
      finalNum1 = Math.max(num1, num2);
      finalNum2 = Math.min(num1, num2);
      answer = finalNum1 - finalNum2;
    } else {
      finalNum1 = num1;
      finalNum2 = num2;
      answer = finalNum1 + finalNum2;
    }
    
    return {
      num1: finalNum1,
      num2: finalNum2,
      operator,
      answer
    };
  }, []);

  // 랭킹 데이터 로드
  const loadRankings = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('gameStats.mathGame.bestReactionTime', '>', 0),
        orderBy('gameStats.mathGame.bestReactionTime', 'desc'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const rankingData: RankingUser[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const bestScore = userData.gameStats?.mathGame?.bestReactionTime;
        
        if (bestScore) {
          rankingData.push({
            id: doc.id,
            nickname: userData.profile?.userName || '익명',
            bestScore: bestScore,
            schoolName: userData.school?.name
          });
        }
      });
      
      setRankings(rankingData);
    } catch (error) {
      console.error('랭킹 데이터 로드 실패:', error);
    }
  };

  // 남은 기회 실시간 조회
  const loadRemainingAttempts = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoadingStats(true);
      const statsResponse = await getUserGameStats(user.uid);
      
      if (statsResponse.success && statsResponse.data) {
        const todayPlays = statsResponse.data.todayPlays.mathGame || 0;
        const maxPlays = statsResponse.data.maxPlays || 5;
        const remaining = Math.max(0, maxPlays - todayPlays);
        
        setRemainingAttempts(remaining);
        
        const best = statsResponse.data.bestReactionTimes.mathGame || null;
        setBestScore(best);
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
      loadRemainingAttempts();
    }
  }, [user?.uid]);

  // 새로고침
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadRankings(),
      loadRemainingAttempts()
    ]);
    setRefreshing(false);
  };

  // 타이머 관리
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && timeLeft === 0) {
      finishGame();
    }
  }, [gameState, timeLeft]);

  // 게임 시작
  const startGame = async () => {
    if (remainingAttempts <= 0) {
      Alert.alert('알림', '오늘의 플레이 횟수를 모두 사용했습니다.');
      return;
    }
    
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }
    
    // 게임 시작 시 횟수 차감
    try {
      const { startGamePlay } = await import('../../lib/games');
      const result = await startGamePlay(user.uid, 'mathGame');
      
      if (!result.success) {
        Alert.alert('플레이 제한', result.message || '게임을 시작할 수 없습니다.');
        loadRemainingAttempts();
        return;
      }
    } catch (error) {
      console.error('게임 시작 오류:', error);
      Alert.alert('오류', '게임을 시작할 수 없습니다.');
      return;
    }
    
    setGameState('playing');
    setScore(0);
    setTimeLeft(20);
    setTotalProblems(0);
    setCorrectCount(0);
    setUserAnswer('');
    setCurrentProblem(generateProblem());
  };

  // 답안 제출
  const submitAnswer = () => {
    if (!currentProblem || userAnswer === '') return;
    
    const isCorrect = parseInt(userAnswer) === currentProblem.answer;
    
    if (isCorrect) {
      setScore(score + 1);
      setCorrectCount(correctCount + 1);
    }
    
    setTotalProblems(totalProblems + 1);
    setUserAnswer('');
    setCurrentProblem(generateProblem());
  };

  // 숫자 버튼 클릭
  const handleNumberClick = (num: number) => {
    if (gameState !== 'playing') return;
    setUserAnswer(userAnswer + num.toString());
  };

  // 지우기
  const handleBackspace = () => {
    setUserAnswer(userAnswer.slice(0, -1));
  };

  // 게임 종료
  const finishGame = async () => {
    setGameState('finished');
    
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    try {
      console.log('🎮 게임 종료 - 점수:', score);
      const result = await updateGameScore(user.uid, 'mathGame', score, score);
      console.log('🎮 updateGameScore 결과:', result);
      
      // 퀘스트 트래킹: 게임 플레이 (7단계)
      try {
        await trackAction('play_game');
        console.log('✅ 퀘스트 트래킹: 게임 플레이 (수학)');
      } catch (questError) {
        console.error('❌ 퀘스트 트래킹 오류:', questError);
      }
      
      if (result.success) {
        if (result.leveledUp && result.oldLevel && result.newLevel) {
          console.log('🎉 레벨업!', result.oldLevel, '→', result.newLevel);
          Alert.alert(
            '🎉 레벨업!',
            `축하합니다! 레벨 ${result.oldLevel}에서 레벨 ${result.newLevel}로 레벨업했습니다!\n경험치 +${result.xpEarned} XP 획득!`,
            [{ text: '확인' }]
          );
        } else if (result.xpEarned && result.xpEarned > 0) {
          console.log('⭐ 경험치 획득:', result.xpEarned);
          Alert.alert(
            '⭐ 경험치 획득!',
            `빠른 계산 게임 완료!\n${score}개 정답\n경험치 +${result.xpEarned} XP 획득!`,
            [{ text: '확인' }]
          );
        } else {
          console.log('❌ 경험치 없음 - xpEarned:', result.xpEarned);
          Alert.alert(
            '게임 완료',
            `정답 개수: ${score}개\n경험치를 얻지 못했습니다.`,
            [{ text: '확인' }]
          );
        }
        
        loadRankings();
        loadRemainingAttempts();
      } else {
        console.error('❌ 게임 저장 실패:', result.message);
        Alert.alert('오류', result.message || '점수 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('게임 결과 저장 실패:', error);
      Alert.alert('오류', '게임 결과 저장 중 오류가 발생했습니다.');
    }
  };

  // 다시 하기
  const resetGame = () => {
    setGameState('waiting');
    setScore(0);
    setTimeLeft(20);
    setTotalProblems(0);
    setCorrectCount(0);
    setUserAnswer('');
    setCurrentProblem(null);
    loadRemainingAttempts();
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginPrompt}>
          <Text style={styles.loginTitle}>로그인이 필요합니다</Text>
          <Text style={styles.loginDescription}>
            빠른 계산 게임을 플레이하려면 로그인해주세요.
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
        <Text style={styles.headerTitle}>빠른 계산 릴레이</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 스크롤 가능한 컨텐츠 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingTop: insets.top + 56 }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 게임 영역 */}
        <View style={styles.gameArea}>
          <Text style={styles.gameDescription}>
            20초 동안 최대한 많은 문제를 풀어보세요!
          </Text>
          
          {/* 남은 기회 표시 */}
          <View style={styles.attemptsContainer}>
            {isLoadingStats ? (
              <Text style={styles.loadingText}>로딩중...</Text>
            ) : (
              <>
                <Text style={styles.attemptsText}>
                  오늘 남은 기회: {remainingAttempts}/{maxAttempts}
                </Text>
                {bestScore !== null && (
                  <Text style={styles.bestScoreText}>
                    최고 기록: {bestScore}개
                  </Text>
                )}
              </>
            )}
          </View>

          {gameState === 'waiting' && (
            <View style={styles.waitingContainer}>
              <Ionicons name="calculator" size={64} color="#3B82F6" style={styles.icon} />
              <Text style={styles.waitingTitle}>빠른 계산 릴레이</Text>
              <Text style={styles.waitingDescription}>
                20초 동안 한 자리 수 덧셈/뺄셈 문제를 풀어보세요!
              </Text>
              <TouchableOpacity
                style={[styles.startButton, remainingAttempts <= 0 && styles.disabledButton]}
                onPress={startGame}
                disabled={remainingAttempts <= 0}
              >
                <Text style={styles.startButtonText}>
                  {remainingAttempts <= 0 ? '오늘의 기회 소진' : '게임 시작'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {gameState === 'playing' && currentProblem && (
            <View style={styles.playingContainer}>
              {/* 타이머와 점수 */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>남은 시간</Text>
                  <Text style={[styles.statValue, timeLeft <= 5 && styles.statValueDanger]}>
                    {timeLeft}초
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>정답 수</Text>
                  <Text style={[styles.statValue, styles.statValueSuccess]}>
                    {score}개
                  </Text>
                </View>
              </View>

              {/* 문제 */}
              <View style={styles.problemContainer}>
                <Text style={styles.problemText}>
                  {currentProblem.num1} {currentProblem.operator} {currentProblem.num2} = ?
                </Text>
                <TextInput
                  style={styles.answerInput}
                  value={userAnswer}
                  editable={false}
                  placeholder="답을 입력하세요"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* 숫자 패드 */}
              <View style={styles.numPad}>
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.numButton}
                    onPress={() => handleNumberClick(num)}
                  >
                    <Text style={styles.numButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.numButton, styles.deleteButton]}
                  onPress={handleBackspace}
                >
                  <Text style={styles.deleteButtonText}>←</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.numButton]}
                  onPress={() => handleNumberClick(0)}
                >
                  <Text style={styles.numButtonText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.numButton, styles.submitButton, userAnswer === '' && styles.disabledButton]}
                  onPress={submitAnswer}
                  disabled={userAnswer === ''}
                >
                  <Text style={styles.submitButtonText}>✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {gameState === 'finished' && (
            <View style={styles.finishedContainer}>
              <Text style={styles.finishedTitle}>게임 종료!</Text>
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>정답 개수</Text>
                <Text style={styles.resultValue}>{score}개</Text>
              </View>
              <View style={styles.resultGrid}>
                <View style={styles.resultItem}>
                  <Text style={styles.resultItemLabel}>총 문제 수</Text>
                  <Text style={styles.resultItemValue}>{totalProblems}개</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultItemLabel}>정확도</Text>
                  <Text style={styles.resultItemValue}>
                    {totalProblems > 0 ? Math.round((correctCount / totalProblems) * 100) : 0}%
                  </Text>
                </View>
              </View>
              {remainingAttempts > 0 && (
                <TouchableOpacity style={styles.playAgainButton} onPress={resetGame}>
                  <Text style={styles.playAgainText}>다시 하기</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* TOP 10 랭킹 */}
        <View style={styles.rankingContainer}>
          <Text style={styles.rankingTitle}>🏆 TOP 10 랭킹</Text>
          {rankings.length > 0 ? (
            rankings.map((rankUser, index) => (
              <View
                key={rankUser.id}
                style={[
                  styles.rankingItem,
                  user?.uid === rankUser.id && styles.myRankingItem
                ]}
              >
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
                    <Text
                      style={[
                        styles.userName,
                        user?.uid === rankUser.id && styles.myUserName
                      ]}
                      numberOfLines={1}
                    >
                      {rankUser.nickname}
                      {user?.uid === rankUser.id && (
                        <Text style={styles.myIndicator}> (나)</Text>
                      )}
                    </Text>
                    {rankUser.schoolName && (
                      <Text style={styles.schoolName} numberOfLines={1}>{rankUser.schoolName}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.rankingRight}>
                  <Text style={[
                    styles.scoreText,
                    user?.uid === rankUser.id && styles.myScoreText
                  ]}>
                    {rankUser.bestScore}개
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>아직 랭킹 데이터가 없습니다.</Text>
          )}
        </View>

        {/* 경험치 정보 */}
        <View style={styles.xpContainer}>
          <Text style={styles.xpTitle}>⭐ 경험치 정보</Text>
          <Text style={styles.xpDescription}>
            더 많은 문제를 맞출수록 더 많은 경험치를 획득할 수 있습니다!
          </Text>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>15개 이상</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+15 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>12-14개</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+10 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>9-11개</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+5 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>8개 이하</Text>
            <View style={[styles.xpBadge, styles.xpBadgeGray]}>
              <Text style={[styles.xpBadgeText, styles.xpBadgeTextGray]}>+0 XP</Text>
            </View>
          </View>
          <Text style={styles.xpTip}>
            💡 팁: 빠르고 정확하게 풀수록 더 높은 점수를 얻을 수 있어요!
          </Text>
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20,
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
  gameDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 15,
  },
  attemptsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  attemptsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  bestScoreText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  icon: {
    marginBottom: 20,
    opacity: 0.9,
  },
  waitingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  waitingDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  playingContainer: {
    paddingVertical: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  statValueDanger: {
    color: '#DC2626',
  },
  statValueSuccess: {
    color: '#16A34A',
  },
  problemContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 28,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  problemText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 16,
    letterSpacing: 2,
    textShadowColor: 'rgba(59, 130, 246, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  answerInput: {
    width: '100%',
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: '#93C5FD',
    borderRadius: 12,
    padding: 18,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  numPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  numButton: {
    width: '30%',
    aspectRatio: 1.5,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  numButtonText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  deleteButtonText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
  },
  submitButton: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
  },
  finishedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  finishedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  resultBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  resultGrid: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  resultItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  resultItemLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  resultItemValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  playAgainButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  playAgainText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  },
  medalText: {
    fontSize: 12,
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
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  noDataText: {
    textAlign: 'center',
    color: '#6B7280',
    paddingVertical: 20,
  },
  myRankingItem: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  myUserName: {
    color: '#1d4ed8',
    fontWeight: 'bold',
  },
  myIndicator: {
    color: '#2563eb',
    fontSize: 12,
  },
  myScoreText: {
    color: '#1d4ed8',
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
    marginBottom: 12,
    textAlign: 'center',
  },
  xpDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  xpItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  xpText: {
    fontSize: 14,
    color: '#4B5563',
  },
  xpBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  xpBadgeGray: {
    backgroundColor: '#F3F4F6',
  },
  xpBadgeTextGray: {
    color: '#6B7280',
  },
  xpTip: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
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

