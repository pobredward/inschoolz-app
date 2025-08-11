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
import { updateGameScore } from '../../lib/games';
import { useAuthStore } from '../../store/authStore';

type GameState = 'waiting' | 'playing' | 'finished';

interface Tile {
  id: number;
  value: number;
  isFlipped: boolean;
  isMatched: boolean;
}

const { width } = Dimensions.get('window');
const tileSize = (width - 80) / 4; // 4x4 그리드

export default function TileGameScreen() {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flippedTiles, setFlippedTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<number>(0);

  const totalPairs = 8; // 4x4 grid with 8 pairs
  const maxTime = 120; // 2 minutes
  
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
    setFinalScore(0);
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
    if (gameState !== 'playing') return;
    
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
          setMatches(prev => prev + 1);
          setFlippedTiles([]);
          
          // 모든 매치 완료 체크
          if (matches + 1 === totalPairs) {
            finishGame();
          }
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
    
    // 점수 계산: 기본 점수 1000에서 시간과 움직임에 따라 감점
    const timeBonus = Math.max(0, maxTime - totalTime) * 10;
    const moveBonus = Math.max(0, (totalPairs * 2) - moves) * 20;
    const score = Math.max(100, 1000 + timeBonus + moveBonus);
    
    setFinalScore(score);
    setGameState('finished');

    // Firebase에 점수 저장
    try {
      const result = await updateGameScore('temp-user-id', 'tileGame', score);
      if (result.success) {
        let message = `점수: ${score}점`;
        
        if (result.leveledUp) {
          message += `\n🎉 레벨업! ${result.oldLevel} → ${result.newLevel}`;
        }
        
        if (result.isHighScore) {
          message += '\n🏆 새로운 최고 점수!';
        }
        
        if (score >= 800) {
          message += '\n⭐ 경험치 +20 XP 획득!';
        } else {
          message += '\n💡 800점 이상 시 경험치를 획득할 수 있습니다.';
        }
        
        Alert.alert(
          result.leveledUp ? '레벨업! 🎉' : result.isHighScore ? '신기록! 🏆' : '게임 완료',
          message,
          [{ text: '확인' }]
        );
      } else {
        Alert.alert('오류', result.message);
      }
    } catch (error) {
      console.error('게임 점수 저장 실패:', error);
      Alert.alert(
        '게임 완료',
        `점수: ${score}점\n점수 저장 중 오류가 발생했습니다.`,
        [{ text: '확인' }]
      );
    }
  };

  // 타이머
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (gameState === 'playing') {
      interval = setInterval(() => {
        const elapsed = Math.floor((performance.now() - gameStartTime) / 1000);
        setTimeElapsed(elapsed);
        
        if (elapsed >= maxTime) {
          finishGame();
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, gameStartTime]);

  // 게임 초기화 (컴포넌트 마운트 시)
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const getEmojiForValue = (value: number) => {
    const emojis = ['🍎', '🍌', '🍇', '🍊', '🍓', '🥝', '🍑', '🥭'];
    return emojis[value - 1] || '❓';
  };

  const resetGame = () => {
    setGameState('waiting');
    initializeGame();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🧩 타일 매칭 게임</Text>
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
              <Text style={styles.gameIcon}>🧩</Text>
              <Text style={styles.gameTitle}>타일 매칭 게임</Text>
              <Text style={styles.gameDescription}>
                같은 그림의 타일 두 개를 찾아 매칭하세요!{'\n'}
                빠른 시간과 적은 움직임으로 높은 점수를 획득하세요.
              </Text>
              <TouchableOpacity style={styles.startButton} onPress={startGame}>
                <Text style={styles.startButtonText}>🎮 게임 시작</Text>
              </TouchableOpacity>
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
                  <Text style={styles.resultLabel}>최종 점수</Text>
                  <Text style={[styles.resultValue, { color: '#3b82f6' }]}>{finalScore}점</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>완료 시간</Text>
                  <Text style={[styles.resultValue, { color: '#10b981' }]}>{timeElapsed}초</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>총 움직임</Text>
                  <Text style={[styles.resultValue, { color: '#8b5cf6' }]}>{moves}회</Text>
                </View>
              </View>

              {finalScore >= 800 && (
                <View style={styles.xpBadge}>
                  <Text style={styles.xpBadgeText}>⭐ 경험치 +20 XP 획득!</Text>
                </View>
              )}

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

        {/* 게임 설명 */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>🎯 게임 방법</Text>
          <View style={styles.instructionsContent}>
            <View style={styles.instructionSection}>
              <Text style={styles.instructionSectionTitle}>목표</Text>
              <Text style={styles.instructionText}>• 4x4 격자에서 8쌍의 타일을 모두 매칭</Text>
              <Text style={styles.instructionText}>• 빠른 시간과 적은 움직임으로 고득점 달성</Text>
              <Text style={styles.instructionText}>• 800점 이상 시 경험치 +20 XP 획득</Text>
            </View>
            <View style={styles.instructionSection}>
              <Text style={styles.instructionSectionTitle}>점수 계산</Text>
              <Text style={styles.instructionText}>• 기본 점수: 1000점</Text>
              <Text style={styles.instructionText}>• 시간 보너스: 남은 시간 × 10점</Text>
              <Text style={styles.instructionText}>• 움직임 보너스: 최소 움직임 대비 × 20점</Text>
              <Text style={styles.instructionText}>• 제한 시간: 2분</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  gameIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  gameDescription: {
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
    gap: 8,
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
    marginBottom: 8,
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
  xpBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  xpBadgeText: {
    color: '#92400e',
    fontWeight: '600',
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
}); 