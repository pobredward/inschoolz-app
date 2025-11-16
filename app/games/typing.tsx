import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { updateGameScore } from '../../lib/games';
import { englishWords, WordPair } from '../../data/english-words';
import { Ionicons } from '@expo/vector-icons';

type GameState = 'waiting' | 'playing' | 'finished';

export default function TypingGameScreen() {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [currentWord, setCurrentWord] = useState<WordPair | null>(null);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [usedWords, setUsedWords] = useState<Set<number>>(new Set());
  const inputRef = useRef<TextInput>(null);
  
  const { user } = useAuthStore();

  // 랜덤 단어 선택 (중복 방지)
  const getRandomWord = useCallback((): WordPair => {
    const availableIndices = englishWords
      .map((_, index) => index)
      .filter(index => !usedWords.has(index));
    
    // 모든 단어를 사용했으면 초기화
    if (availableIndices.length === 0) {
      setUsedWords(new Set());
      const randomIndex = Math.floor(Math.random() * englishWords.length);
      setUsedWords(new Set([randomIndex]));
      return englishWords[randomIndex];
    }
    
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    setUsedWords(prev => new Set([...prev, randomIndex]));
    return englishWords[randomIndex];
  }, [usedWords]);

  // 게임 시작
  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setTimeLeft(20);
    setUserInput('');
    setUsedWords(new Set());
    const firstWord = getRandomWord();
    setCurrentWord(firstWord);
    
    // 입력 필드에 포커스
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // 타이머
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState('finished');
          Keyboard.dismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // 입력 처리
  const handleInputChange = (value: string) => {
    const lowerValue = value.toLowerCase();
    setUserInput(lowerValue);

    // 정답 체크
    if (currentWord && lowerValue === currentWord.english.toLowerCase()) {
      setScore(prev => prev + 1);
      setUserInput('');
      const nextWord = getRandomWord();
      setCurrentWord(nextWord);
    }
  };

  // 게임 종료 시 점수 저장
  useEffect(() => {
    if (gameState === 'finished' && user) {
      const saveScore = async () => {
        try {
          console.log('Saving typing game score:', score);
          const result = await updateGameScore(user.id, 'typingGame', score);
          console.log('Update result:', result);
          
          if (result.xpGained > 0) {
            console.log('XP gained:', result.xpGained);
            Alert.alert(
              '경험치 획득! 🎉',
              `${result.xpGained} XP를 획득했습니다!${result.leveledUp ? '\n\n🎊 레벨 업!' : ''}`,
              [{ text: '확인' }]
            );
          }
        } catch (error) {
          console.error('Failed to save typing game score:', error);
        }
      };
      saveScore();
    }
  }, [gameState, score, user]);

  // 재시작
  const resetGame = () => {
    setGameState('waiting');
    setScore(0);
    setTimeLeft(20);
    setUserInput('');
    setUsedWords(new Set());
    setCurrentWord(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>영단어 타이핑</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* 대기 화면 */}
        {gameState === 'waiting' && (
          <View style={styles.waitingContainer}>
            <Text style={styles.emoji}>⌨️</Text>
            <Text style={styles.subtitle}>
              화면에 나타나는 영단어를 빠르게 입력하세요!
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>📚 한글 뜻을 보고 스펠링을 연습하세요</Text>
              <Text style={styles.infoText}>⏱️ 제한시간: 20초</Text>
              <Text style={styles.infoText}>🎯 목표: 최대한 많은 단어 입력</Text>
            </View>
            <TouchableOpacity style={styles.startButton} onPress={startGame}>
              <Text style={styles.startButtonText}>게임 시작</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 플레이 화면 */}
        {gameState === 'playing' && currentWord && (
          <View style={styles.playingContainer}>
            {/* 상태 바 */}
            <View style={styles.statusBar}>
              <View style={styles.badge}>
                <Ionicons name="trophy" size={16} color="#8B5CF6" />
                <Text style={styles.badgeText}>{score}개</Text>
              </View>
              <View style={[styles.badge, timeLeft <= 5 && styles.badgeDanger]}>
                <Ionicons name="time" size={16} color={timeLeft <= 5 ? "#EF4444" : "#8B5CF6"} />
                <Text style={[styles.badgeText, timeLeft <= 5 && styles.badgeTextDanger]}>
                  {timeLeft}초
                </Text>
              </View>
            </View>

            {/* 단어 표시 영역 */}
            <View style={styles.wordContainer}>
              <Text style={styles.englishWord}>{currentWord.english.toLowerCase()}</Text>
              <Text style={styles.koreanWord}>{currentWord.korean}</Text>
            </View>

            {/* 입력 필드 */}
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={userInput}
                onChangeText={handleInputChange}
                placeholder="여기에 입력하세요"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <Text style={styles.inputHint}>💡 소문자로 입력해도 됩니다</Text>
            </View>

            {/* 진행 바 */}
            <View style={styles.progressBarContainer}>
              <View
                style={[styles.progressBar, { width: `${(timeLeft / 20) * 100}%` }]}
              />
            </View>
          </View>
        )}

        {/* 결과 화면 */}
        {gameState === 'finished' && (
          <View style={styles.finishedContainer}>
            <Text style={styles.emoji}>
              {score >= 15 ? '🏆' : score >= 10 ? '🎉' : '💪'}
            </Text>
            <Text style={styles.resultLabel}>최종 점수</Text>
            <Text style={styles.resultScore}>{score}개</Text>
            
            <View style={styles.evaluationBox}>
              <View style={styles.evaluationHeader}>
                <Ionicons name="flash" size={20} color="#8B5CF6" />
                <Text style={styles.evaluationTitle}>평가</Text>
              </View>
              <Text style={styles.evaluationText}>
                {score >= 20 ? '놀라워요! 🌟' : 
                 score >= 15 ? '훌륭해요! 🎯' : 
                 score >= 10 ? '잘했어요! 👍' : 
                 '연습하면 더 잘할 수 있어요! 💪'}
              </Text>
              <Text style={styles.evaluationSubtext}>
                {score >= 15 ? '15개 이상: 15 XP 획득!' :
                 score >= 12 ? '12개 이상: 10 XP 획득!' :
                 score >= 9 ? '9개 이상: 5 XP 획득!' :
                 '9개 이상부터 경험치를 얻을 수 있어요'}
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetGame}>
                <Text style={styles.secondaryButtonText}>처음으로</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={startGame}>
                <Text style={styles.primaryButtonText}>다시 하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 설명 카드 */}
        {gameState === 'waiting' && (
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>게임 방법</Text>
            <Text style={styles.instructionText}>• 화면에 영단어와 한글 뜻이 표시됩니다</Text>
            <Text style={styles.instructionText}>• 영단어를 정확하게 입력하세요 (대소문자 무관)</Text>
            <Text style={styles.instructionText}>• 20초 안에 최대한 많은 단어를 입력하세요</Text>
            <Text style={styles.instructionText}>• 9개 이상: 5 XP / 12개 이상: 10 XP / 15개 이상: 15 XP</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // 대기 화면
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    width: '100%',
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  startButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  // 플레이 화면
  playingContainer: {
    flex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginLeft: 6,
  },
  badgeTextDanger: {
    color: '#EF4444',
  },
  wordContainer: {
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  englishWord: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 2,
    marginBottom: 16,
  },
  koreanWord: {
    fontSize: 24,
    color: '#4B5563',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#A78BFA',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 20,
    textAlign: 'center',
  },
  inputHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#8B5CF6',
  },
  // 결과 화면
  finishedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 56,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 32,
  },
  evaluationBox: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  evaluationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  evaluationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginLeft: 8,
  },
  evaluationText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  evaluationSubtext: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // 설명 카드
  instructionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
});

