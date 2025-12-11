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
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useQuest } from '../../providers/QuestProvider';

type GameState = 'waiting' | 'playing' | 'finished';

interface Tile {
  id: number;
  value: number;
  isFlipped: boolean;
  isMatched: boolean;
}

interface RankingUser {
  id: string;
  nickname: string;
  bestMoves: number; // 최소 움직임 횟수 (낮을수록 좋음)
  schoolName?: string;
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
  const { trackAction } = useQuest();
  const insets = useSafeAreaInsets();
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flippedTiles, setFlippedTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [rankings, setRankings] = useState<RankingUser[]>([]);

  const totalPairs = 6; // 3x4 grid with 6 pairs
  const maxTime = 120; // 2 minutes
  const maxAttempts = 5;

  // 남은 기회 실시간 조회
  const loadRemainingAttempts = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoadingStats(true);
      const statsResponse = await getUserGameStats(user.uid);
      
      if (statsResponse.success && statsResponse.data) {
        const todayPlays = statsResponse.data.todayPlays.tileGame || 0;
        const remaining = Math.max(0, maxAttempts - todayPlays);
        
        setRemainingAttempts(remaining);
      }
    } catch (error) {
      console.error('게임 통계 로드 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 랭킹 데이터 로드 (최소 움직임 횟수 기준)
  const loadRankings = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('gameStats.tileGame.bestMoves', '>', 0),
        orderBy('gameStats.tileGame.bestMoves', 'asc'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const rankingData: RankingUser[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const bestMoves = userData.gameStats?.tileGame?.bestMoves;
        
        if (bestMoves) {
          rankingData.push({
            id: doc.id,
            nickname: userData.profile?.userName || '익명',
            bestMoves: bestMoves,
            schoolName: userData.school?.name
          });
        }
      });
      
      setRankings(rankingData);
    } catch (error) {
      console.error('랭킹 데이터 로드 실패:', error);
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
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }
    
    // 게임 시작 시 횟수 차감
    try {
      const { startGamePlay } = await import('../../lib/games');
      const result = await startGamePlay(user.uid, 'tileGame');
      
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
      
      // 퀘스트 트래킹: 게임 플레이 (7단계)
      try {
        await trackAction('play_game');
        console.log('✅ 퀘스트 트래킹: 게임 플레이 (타일)');
      } catch (questError) {
        console.error('❌ 퀘스트 트래킹 오류:', questError);
      }
      
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
        loadRankings(); // 랭킹 데이터 새로고침
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
    loadRankings(); // 랭킹 데이터 로드
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
                  <Text style={[styles.resultValue, { color: '#10b981' }]}>{moves}회</Text>
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
                    styles.bestMoves,
                    user?.uid === rankUser.id && styles.myBestMoves
                  ]}>
                    {rankUser.bestMoves}번
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  readyDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  startButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    flexBasis: '30%',
    maxWidth: tileSize,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tileFlipped: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  tileMatched: {
    backgroundColor: '#D1FAE5',
    borderColor: '#059669',
    opacity: 0.8,
  },
  tileText: {
    fontSize: 32,
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
    backgroundColor: '#10B981',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  replayButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  backToGamesButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backToGamesButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
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
  // 랭킹 스타일
  rankingContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  myRankingItem: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goldBadge: {
    backgroundColor: '#eab308',
  },
  silverBadge: {
    backgroundColor: '#9ca3af',
  },
  bronzeBadge: {
    backgroundColor: '#d97706',
  },
  defaultBadge: {
    backgroundColor: '#f3f4f6',
  },
  rankText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  medalText: {
    color: '#fff',
    fontSize: 8,
  },
  defaultRankText: {
    color: '#6b7280',
    fontSize: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  myUserName: {
    color: '#1d4ed8',
    fontWeight: 'bold',
  },
  myIndicator: {
    color: '#2563eb',
    fontSize: 12,
  },
  schoolName: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  rankingRight: {
    alignItems: 'flex-end',
  },
  bestMoves: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  myBestMoves: {
    color: '#1d4ed8',
  },
  noDataText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    paddingVertical: 16,
  },
}); 