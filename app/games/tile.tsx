import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { updateGameScore, getUserGameStats } from '../../lib/games';
import { useAuthStore } from '../../store/authStore';

type GameState = 'waiting' | 'playing' | 'finished';

interface Tile {
  id: number;
  value: number;
  isFlipped: boolean;
  isMatched: boolean;
}

const { width } = Dimensions.get('window');
const tilesPerRow = 3; // 3x4 그리드
const containerPadding = 40; // 좌우 패딩
const tileGap = 8; // 타일 간격
const totalGaps = (tilesPerRow - 1) * tileGap; // 총 간격
const availableWidth = width - containerPadding - totalGaps;
const tileSize = Math.floor(availableWidth / tilesPerRow);

export default function TileGameScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flippedTiles, setFlippedTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const totalPairs = 6; // 3x4 grid with 6 pairs
  const maxTime = 120; // 2 minutes
  const maxAttempts = 3;

  // 남은 기회 실시간 조회
  const loadRemainingAttempts = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoadingStats(true);
      const statsResponse = await getUserGameStats(user.uid);
      
      if (statsResponse.success && statsResponse.data) {
        const todayPlays = statsResponse.data.todayPlays.tileGame || 0;
        const maxPlays = 3; // 타일 게임은 3번으로 고정
        const remaining = Math.max(0, maxPlays - todayPlays);
        
        setRemainingAttempts(remaining);
      }
    } catch (error) {
      console.error('게임 통계 로드 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };
  
  // 게임 초기화
  const initializeGame = useCallback(() => {
    const values = [];
    for (let i = 1; i <= totalPairs; i++) {
      values.push(i, i); // 각 숫자를 두 번씩 추가
    }
    
    // 카드 섞기
    const shuffled = values.sort(() => Math.random() - 0.5);
    
    const newTiles: Tile[] = shuffled.map((value, index) => ({
      id: index,
      value,
      isFlipped: false,
      isMatched: false,
    }));
    
    setTiles(newTiles);
    setFlippedTiles([]);
    setMoves(0);
    setMatches(0);
    setTimeElapsed(0);
  }, [totalPairs]);

  // 게임 시작
  const startGame = async () => {
    const { user } = useAuthStore.getState();
    if (!user?.uid) {
      return;
    }
    
    // 플레이 전 제한 재확인
    try {
      const { checkDailyLimit } = await import('../../lib/experience');
      const limitCheck = await checkDailyLimit(user.uid, 'games', 'tileGame');
      if (!limitCheck.canEarnExp) {
        Alert.alert(
          '플레이 제한',
          `오늘의 타일 게임 플레이 횟수를 모두 사용했습니다. (${limitCheck.currentCount}/${limitCheck.limit})`
        );
        return;
      }
    } catch (error) {
      console.error('제한 확인 오류:', error);
      Alert.alert('오류', '게임을 시작할 수 없습니다.');
      return;
    }
    
    initializeGame();
    setGameState('playing');
    setGameStartTime(performance.now());
  };

  // 타일 클릭 처리
  const handleTileClick = (tileId: number) => {
    if (gameState !== 'playing' || flippedTiles.length >= 2) return;
    
    const tile = tiles.find(t => t.id === tileId);
    if (!tile || tile.isFlipped || tile.isMatched) return;
    
    const newFlippedTiles = [...flippedTiles, tileId];
    setFlippedTiles(newFlippedTiles);
    
    // 타일 뒤집기
    setTiles(prev => prev.map(t => 
      t.id === tileId ? { ...t, isFlipped: true } : t
    ));

    if (newFlippedTiles.length === 2) {
      setMoves(prev => prev + 1);
      
      const [firstId, secondId] = newFlippedTiles;
      const firstTile = tiles.find(t => t.id === firstId);
      const secondTile = tiles.find(t => t.id === secondId);
      
      if (firstTile && secondTile && firstTile.value === secondTile.value) {
        // 매치 성공
        setTimeout(() => {
          setTiles(prev => prev.map(t => 
            t.id === firstId || t.id === secondId 
              ? { ...t, isMatched: true }
              : t
          ));
          setMatches(prev => {
            const newMatches = prev + 1;
            // 모든 매치 완료 체크
            if (newMatches === totalPairs) {
              // 약간의 지연을 두고 게임 완료
              setTimeout(() => finishGame(), 500);
            }
            return newMatches;
          });
          setFlippedTiles([]);
        }, 1000);
      } else {
        // 매치 실패
        setTimeout(() => {
          setTiles(prev => prev.map(t => 
            t.id === firstId || t.id === secondId 
              ? { ...t, isFlipped: false }
              : t
          ));
          setFlippedTiles([]);
        }, 1000);
      }
    }
  };

  // 게임 종료
  const finishGame = async () => {
    const endTime = performance.now();
    const totalTime = Math.floor((endTime - gameStartTime) / 1000);
    setTimeElapsed(totalTime);
    setGameState('finished');

    // Firebase에 움직임 횟수 저장 및 경험치 계산
    const { user } = useAuthStore.getState();
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    try {
      // 움직임 횟수를 점수로 전달 (경험치 계산용)
      console.log(`타일 게임 완료 - 움직임 횟수: ${moves}번`);
      const result = await updateGameScore(user.uid, 'tileGame', moves);
      if (result.success) {
        let message = `움직임 횟수: ${moves}번`;
        
        if (result.leveledUp) {
          message += `\n🎉 레벨업! ${result.oldLevel} → ${result.newLevel}`;
        }
        
        if (result.isHighScore) {
          message += '\n🏆 새로운 최소 움직임 기록!';
        }
        
        if (result.xpEarned && result.xpEarned > 0) {
          message += `\n⭐ 경험치 +${result.xpEarned} XP 획득!`;
        } else {
          message += '\n💡 더 적은 움직임으로 경험치를 획득하세요.';
        }
        
        Alert.alert(
          result.leveledUp ? '레벨업! 🎉' : result.isHighScore ? '신기록! 🏆' : '게임 완료',
          message,
          [{ text: '확인' }]
        );
        
        // 성공 시 남은 기회 업데이트
        loadRemainingAttempts();
      } else {
        Alert.alert('오류', result.message);
      }
    } catch (error) {
      console.error('게임 점수 저장 실패:', error);
      Alert.alert(
        '게임 완료',
        `움직임 횟수: ${moves}번\n점수 저장 중 오류가 발생했습니다.`,
        [{ text: '확인' }]
      );
    }
  };

  // 타이머
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (gameState === 'playing' && gameStartTime > 0) {
      interval = setInterval(() => {
        const elapsed = Math.floor((performance.now() - gameStartTime) / 1000);
        setTimeElapsed(elapsed);
        
        if (elapsed >= maxTime) {
          finishGame();
        }
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
  }, [gameState, gameStartTime, maxTime]);

  // 게임 초기화 및 사용자 데이터 로드 (컴포넌트 마운트 시) - 무한 루프 방지
  useEffect(() => {
    initializeGame();
    if (user?.uid) {
      loadRemainingAttempts();
    }
  }, [user?.uid]); // initializeGame 의존성 제거로 무한 루프 방지

  const getEmojiForValue = (value: number) => {
    const emojis = ['🍎', '🍌', '🍇', '🍊', '🍓', '🥝'];
    return emojis[value - 1] || '❓';
  };

  const resetGame = () => {
    setGameState('waiting');
    setFlippedTiles([]);
    setMoves(0);
    setMatches(0);
    setTimeElapsed(0);
    setGameStartTime(0);
    initializeGame();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      
      {/* 고정 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>타일 매칭 게임</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 스크롤 가능한 컨텐츠 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          { paddingTop: insets.top + 56 } // 헤더 높이만큼 상단 패딩
        ]}
        showsVerticalScrollIndicator={false}
      >
        
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

        {/* 게임 상태 */}
        {gameState === 'playing' && (
          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>매치</Text>
              <Text style={styles.statusValue}>{matches}/{totalPairs}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>움직임</Text>
              <Text style={styles.statusValue}>{moves}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>시간</Text>
              <Text style={styles.statusValue}>{timeElapsed}초</Text>
            </View>
          </View>
        )}

        {/* 게임 영역 */}
        <View style={styles.gameContainer}>
          {gameState === 'waiting' && (
            <View style={styles.waitingContainer}>
              {!user ? (
                <View style={styles.loginContainer}>
                  <Text style={styles.gameIcon}>🧩</Text>
                  <Text style={styles.loginText}>로그인이 필요합니다</Text>
                  <Text style={styles.loginDescription}>타일 매칭 게임을 플레이하려면 로그인해주세요.</Text>
                  <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
                    <Text style={styles.loginButtonText}>로그인하기</Text>
                  </TouchableOpacity>
                </View>
              ) : remainingAttempts <= 0 ? (
                <View style={styles.noAttemptsContainer}>
                  <Text style={styles.gameIcon}>😴</Text>
                  <Text style={styles.noAttemptsTitle}>오늘의 기회 소진</Text>
                  <Text style={styles.noAttemptsText}>내일 다시 도전해보세요!</Text>
                  <TouchableOpacity style={[styles.startButton, styles.disabledButton]} disabled>
                    <Text style={[styles.startButtonText, styles.disabledButtonText]}>기회 소진</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.readyContainer}>
                  <Text style={styles.gameIcon}>🧩</Text>
                  <Text style={styles.readyTitle}>타일 매칭 게임</Text>
                  <Text style={styles.readyDescription}>
                    3x4 격자에서 6쌍의 타일을 모두 매칭하세요!{'\n'}
                    적은 움직임으로 완료할수록 더 많은 경험치를 획득합니다.
                  </Text>
                  <TouchableOpacity style={styles.startButton} onPress={startGame}>
                    <Text style={styles.startButtonText}>🎮 게임 시작 (클릭하세요!)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {gameState === 'playing' && (
            <View style={styles.tilesContainer}>
              {tiles.map((tile) => (
                <TouchableOpacity
                  key={tile.id}
                  style={[
                    styles.tile,
                    tile.isMatched && styles.tileMatched,
                    tile.isFlipped && !tile.isMatched && styles.tileFlipped,
                  ]}
                  onPress={() => handleTileClick(tile.id)}
                  disabled={tile.isFlipped || tile.isMatched}
                >
                  <Text style={styles.tileText}>
                    {tile.isFlipped || tile.isMatched ? getEmojiForValue(tile.value) : '?'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {gameState === 'finished' && (
            <View style={styles.finishedContainer}>
              <Text style={styles.gameIcon}>🎉</Text>
              <Text style={styles.finishedTitle}>게임 완료!</Text>
              
              <View style={styles.resultsContainer}>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>총 움직임</Text>
                  <Text style={[styles.resultValue, { color: '#3b82f6' }]}>{moves}회</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>완료 시간</Text>
                  <Text style={[styles.resultValue, { color: '#10b981' }]}>{timeElapsed}초</Text>
                </View>
              </View>

              {/* Firebase 설정에서 실제 경험치 계산됨 */}

              <View style={styles.finishedButtons}>
                <TouchableOpacity style={styles.replayButton} onPress={resetGame}>
                  <Text style={styles.replayButtonText}>🔄 다시 플레이</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backToGamesButton} onPress={() => router.back()}>
                  <Text style={styles.backToGamesButtonText}>게임 목록으로</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 경험치 정보 */}
        <View style={styles.xpContainer}>
          <Text style={styles.xpTitle}>⭐ 경험치 정보</Text>
          <Text style={styles.xpDescription}>
            움직임 횟수가 적을수록 더 많은 경험치를 획득할 수 있습니다!
          </Text>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>7번 이하</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+15 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>8-10번</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+10 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>11-13번</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+5 XP</Text>
            </View>
          </View>
          <View style={styles.xpItem}>
            <Text style={styles.xpText}>14번 이상</Text>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+0 XP</Text>
            </View>
          </View>
          <Text style={styles.xpTip}>
            💡 팁: 최적 움직임은 6번입니다. 7번 이하로 완료하면 경험치를 획득할 수 있어요!
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
    marginTop: 20,
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
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  gameContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loginContainer: {
    alignItems: 'center',
  },
  noAttemptsContainer: {
    alignItems: 'center',
  },
  readyContainer: {
    alignItems: 'center',
  },
  gameIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  loginText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  loginDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  noAttemptsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  noAttemptsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  readyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  readyDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignSelf: 'center',
  },
  tile: {
    width: tileSize,
    height: tileSize,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    flexBasis: '30%', // 3개씩 배치를 위해 30% 설정
    maxWidth: tileSize,
  },
  tileFlipped: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  tileMatched: {
    backgroundColor: '#dcfce7',
    borderColor: '#10b981',
  },
  tileText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  finishedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  finishedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  resultItem: {
    alignItems: 'center',
    flex: 1,
  },
  resultLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  finishedButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  replayButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  replayButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  backToGamesButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToGamesButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  instructions: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  instructionsContent: {
    gap: 16,
  },
  instructionSection: {
    gap: 4,
  },
  instructionSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  disabledButtonText: {
    color: '#6b7280',
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
}); 