import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { SafeScreenContainer } from '../../components/SafeScreenContainer';

interface Game {
  id: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
}

const games: Game[] = [
  {
    id: 'reaction',
    name: '반응속도',
    icon: '⚡',
    description: '빠른 반응속도로 높은 점수를 획득하세요!',
    isActive: true
  },
  {
    id: 'tile',
    name: '타일 매칭',
    icon: '🧩',
    description: '같은 그림을 찾아 매칭하고 경험치를 획득하세요!',
    isActive: true
  },
  {
    id: 'calculation',
    name: '빠른 계산',
    icon: '🧮',
    description: '곧 출시 예정입니다',
    isActive: false
  },
  {
    id: 'word',
    name: '단어 맞추기',
    icon: '📝',
    description: '곧 출시 예정입니다',
    isActive: false
  }
];

export default function GamesScreen() {
  const { user } = useAuthStore();

  const handlePlayGame = (game: Game) => {
    if (!game.isActive) {
      Alert.alert('준비 중', '곧 출시될 예정입니다! 🚀');
      return;
    }
    
    if (!user) {
      Alert.alert(
        '로그인 필요', 
        '게임을 플레이하려면 로그인이 필요합니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '로그인', onPress: () => router.push('/login') }
        ]
      );
      return;
    }

    if (game.id === 'reaction') {
      router.push('/games/reaction' as any);
    } else if (game.id === 'tile') {
      router.push('/games/tile' as any);
    }
  };

  return (
    <SafeScreenContainer scrollable={true}>
      <View style={styles.header}>
        <Text style={styles.title}>🎮 미니게임</Text>
        <Text style={styles.subtitle}>게임을 플레이하고 경험치를 획득하세요!</Text>
        
        {/* 비회원 안내 메시지 */}
        {!user && (
          <View style={styles.guestNotice}>
            <Text style={styles.guestNoticeText}>
              🎯 게임 목록은 누구나 볼 수 있지만, 실제 게임을 플레이하려면 로그인이 필요합니다.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.gameGrid}>
        {games.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={[
              styles.gameCard,
              !game.isActive && styles.gameCardInactive
            ]}
            onPress={() => handlePlayGame(game)}
          >
            {!game.isActive && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>곧 출시</Text>
              </View>
            )}
            
            <Text style={[
              styles.gameIcon,
              !game.isActive && styles.gameIconInactive
            ]}>
              {game.icon}
            </Text>
            <Text style={[
              styles.gameName,
              !game.isActive && styles.gameNameInactive
            ]}>
              {game.name}
            </Text>
            <Text style={[
              styles.gameDescription,
              !game.isActive && styles.gameDescriptionInactive
            ]}>
              {game.description}
            </Text>
            
            <View style={[
              styles.playButton,
              !game.isActive && styles.playButtonInactive
            ]}>
              <Text style={[
                styles.playButtonText,
                !game.isActive && styles.playButtonTextInactive
              ]}>
                {!game.isActive 
                  ? '준비 중' 
                  : !user 
                    ? '로그인하고 플레이하기' 
                    : '플레이하기'
                }
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </SafeScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  guestNotice: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginHorizontal: 16,
  },
  guestNoticeText: {
    color: '#92400e',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  gameGrid: {
    padding: 16,
    gap: 16,
  },
  gameCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  gameCardInactive: {
    opacity: 0.7,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  gameIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  gameIconInactive: {
    opacity: 0.5,
  },
  gameName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  gameNameInactive: {
    color: '#999',
  },
  gameDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  gameDescriptionInactive: {
    color: '#aaa',
  },
  playButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  playButtonInactive: {
    backgroundColor: '#f1f3f4',
  },
  playButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playButtonTextInactive: {
    color: '#999',
  },
}); 