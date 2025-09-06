import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { getExperienceSettings, updateExperienceSettings, ExperienceSettings as LibExperienceSettings } from '@/lib/experience';

// 파스텔 그린 색상 팔레트
const pastelGreenColors = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

interface ExperienceSettings {
  community: {
    postXP: number;
    commentXP: number;
    likeXP: number;
    dailyPostLimit: number;
    dailyCommentLimit: number;
    dailyLikeLimit: number;
  };
  games: {
    reactionGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
    tileGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
  };

  attendance: {
    dailyXP: number;
    streakBonus: number;
    weeklyBonusXP: number;
  };
  
  referral: {
    referrerXP: number;    // 추천인(A)이 받는 경험치
    refereeXP: number;     // 추천받은 사람(B)이 받는 경험치
    enabled: boolean;      // 추천인 시스템 활성화 여부
  };
}

export default function ExperienceManagementScreen() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<ExperienceSettings>({
    community: {
      postXP: 10,
      commentXP: 5,
      likeXP: 1,
      dailyPostLimit: 3,
      dailyCommentLimit: 5,
      dailyLikeLimit: 50,
    },
    games: {
      reactionGame: {
        enabled: true,
        dailyLimit: 5,
        thresholds: [
          { minScore: 100, xpReward: 15 },
          { minScore: 200, xpReward: 10 },
          { minScore: 300, xpReward: 5 },
        ],
      },
      tileGame: {
        enabled: true,
        dailyLimit: 5,
        thresholds: [
          { minScore: 50, xpReward: 5 },
          { minScore: 100, xpReward: 10 },
          { minScore: 150, xpReward: 15 },
        ],
      },
    },

    attendance: {
      dailyXP: 10,
      streakBonus: 5,
      weeklyBonusXP: 50,
    },
    
    referral: {
      referrerXP: 30,     // 추천인이 받는 경험치 (기본값)
      refereeXP: 30,      // 추천받은 사람이 받는 경험치 (기본값)
      enabled: true,      // 추천인 시스템 활성화
    },
  });

  const [isLoading, setIsLoading] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      Alert.alert(
        '접근 권한 없음',
        '관리자만 접근할 수 있습니다.',
        [{ text: '확인', onPress: () => router.back() }]
      );
    } else {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await getExperienceSettings();
      setSettings(response);
    } catch (error) {
      console.error('설정 로드 실패:', error);
      Alert.alert('오류', '설정을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      await updateExperienceSettings(settings);
      Alert.alert('성공', '설정이 저장되었습니다.');
    } catch (error) {
      console.error('설정 저장 실패:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateCommunitySettings = (key: keyof ExperienceSettings['community'], value: number) => {
    setSettings(prev => ({
      ...prev,
      community: {
        ...prev.community,
        [key]: value,
      },
    }));
  };

  const updateGameSettings = (
    game: keyof ExperienceSettings['games'],
    key: string,
    value: any
  ) => {
    setSettings(prev => ({
      ...prev,
      games: {
        ...prev.games,
        [game]: {
          ...prev.games[game],
          [key]: value,
        },
      },
    }));
  };

  const updateThreshold = (
    game: keyof ExperienceSettings['games'],
    index: number,
    field: 'minScore' | 'xpReward',
    value: number
  ) => {
    setSettings(prev => {
      const newThresholds = [...prev.games[game].thresholds];
      newThresholds[index] = {
        ...newThresholds[index],
        [field]: value,
      };
      return {
        ...prev,
        games: {
          ...prev.games,
          [game]: {
            ...prev.games[game],
            thresholds: newThresholds,
          },
        },
      };
    });
  };

  const addThreshold = (game: keyof ExperienceSettings['games']) => {
    setSettings(prev => ({
      ...prev,
      games: {
        ...prev.games,
        [game]: {
          ...prev.games[game],
          thresholds: [
            ...prev.games[game].thresholds,
            { minScore: 0, xpReward: 0 },
          ],
        },
      },
    }));
  };

  const removeThreshold = (game: keyof ExperienceSettings['games'], index: number) => {
    setSettings(prev => ({
      ...prev,
      games: {
        ...prev.games,
        [game]: {
          ...prev.games[game],
          thresholds: prev.games[game].thresholds.filter((_, i) => i !== index),
        },
      },
    }));
  };

  const renderNumberInput = (
    label: string,
    value: number,
    onChangeText: (value: number) => void,
    placeholder?: string
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.numberInput}
        value={value.toString()}
        onChangeText={(text) => onChangeText(parseInt(text) || 0)}
        placeholder={placeholder}
        keyboardType="numeric"
        placeholderTextColor={pastelGreenColors[400]}
      />
    </View>
  );

  if (!user || user.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="security" size={48} color={pastelGreenColors[300]} />
          <Text style={styles.accessDeniedText}>접근 권한이 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color={pastelGreenColors[600]} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <MaterialIcons name="star" size={24} color={pastelGreenColors[600]} />
          <Text style={styles.headerTitle}>경험치 관리</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, { opacity: isLoading ? 0.6 : 1 }]}
          onPress={saveSettings}
          disabled={isLoading}
        >
          <MaterialIcons name="save" size={20} color="white" />
          <Text style={styles.saveButtonText}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* 커뮤니티 활동 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>커뮤니티 활동</Text>
          <View style={styles.sectionContent}>
            {renderNumberInput(
              '게시글 작성 경험치',
              settings.community.postXP,
              (value) => updateCommunitySettings('postXP', value)
            )}
            {renderNumberInput(
              '댓글 작성 경험치',
              settings.community.commentXP,
              (value) => updateCommunitySettings('commentXP', value)
            )}
            {renderNumberInput(
              '좋아요 경험치',
              settings.community.likeXP,
              (value) => updateCommunitySettings('likeXP', value)
            )}
            <View style={styles.divider} />
            <Text style={styles.subsectionTitle}>일일 제한</Text>
            {renderNumberInput(
              '게시글 작성 제한 (회)',
              settings.community.dailyPostLimit,
              (value) => updateCommunitySettings('dailyPostLimit', value)
            )}
            {renderNumberInput(
              '댓글 작성 제한 (회)',
              settings.community.dailyCommentLimit,
              (value) => updateCommunitySettings('dailyCommentLimit', value)
            )}
            {renderNumberInput(
              '좋아요 제한 (회)',
              settings.community.dailyLikeLimit,
              (value) => updateCommunitySettings('dailyLikeLimit', value)
            )}
          </View>
        </View>

        {/* 게임 설정 */}
        {Object.entries(settings.games).map(([gameKey, gameSettings]) => (
          <View key={gameKey} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {gameKey === 'reactionGame' ? '반응속도 게임' : '타일 맞추기 게임'}
            </Text>
            <View style={styles.sectionContent}>
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>게임 활성화</Text>
                <Switch
                  value={gameSettings.enabled}
                  onValueChange={(value) => updateGameSettings(gameKey as any, 'enabled', value)}
                  trackColor={{ false: pastelGreenColors[200], true: pastelGreenColors[400] }}
                  thumbColor={gameSettings.enabled ? pastelGreenColors[600] : '#f4f3f4'}
                />
              </View>

              {gameSettings.enabled && (
                <>
                  {renderNumberInput(
                    '일일 플레이 제한 (회)',
                    gameSettings.dailyLimit,
                    (value) => updateGameSettings(gameKey as any, 'dailyLimit', value)
                  )}

                  <Text style={styles.subsectionTitle}>점수별 경험치</Text>
                  {gameSettings.thresholds.map((threshold, index) => (
                    <View key={index} style={styles.thresholdContainer}>
                      <View style={styles.thresholdInputs}>
                        <View style={styles.thresholdInput}>
                          <Text style={styles.thresholdLabel}>최소 점수</Text>
                          <TextInput
                            style={styles.thresholdTextInput}
                            value={threshold.minScore.toString()}
                            onChangeText={(text) =>
                              updateThreshold(gameKey as any, index, 'minScore', parseInt(text) || 0)
                            }
                            keyboardType="numeric"
                            placeholderTextColor={pastelGreenColors[400]}
                          />
                        </View>
                        <View style={styles.thresholdInput}>
                          <Text style={styles.thresholdLabel}>경험치</Text>
                          <TextInput
                            style={styles.thresholdTextInput}
                            value={threshold.xpReward.toString()}
                            onChangeText={(text) =>
                              updateThreshold(gameKey as any, index, 'xpReward', parseInt(text) || 0)
                            }
                            keyboardType="numeric"
                            placeholderTextColor={pastelGreenColors[400]}
                          />
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeThreshold(gameKey as any, index)}
                      >
                        <MaterialIcons name="remove-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => addThreshold(gameKey as any)}
                  >
                    <MaterialIcons name="add-circle" size={20} color={pastelGreenColors[600]} />
                    <Text style={styles.addButtonText}>임계값 추가</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}

        {/* 레벨 시스템 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>레벨 시스템 정보</Text>
          <View style={styles.sectionContent}>
            <Text style={styles.infoText}>
              레벨 시스템은 고정된 규칙을 따릅니다:
            </Text>
            <Text style={styles.infoText}>• 1→2레벨: 10 경험치</Text>
            <Text style={styles.infoText}>• 2→3레벨: 20 경험치</Text>
            <Text style={styles.infoText}>• 3→4레벨: 30 경험치</Text>
            <Text style={styles.infoText}>• 이런 식으로 오름차순으로 증가</Text>
          </View>
        </View>

        {/* 출석 체크 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>출석 체크</Text>
          <View style={styles.sectionContent}>
            {renderNumberInput(
              '일일 출석 경험치',
              settings.attendance.dailyXP,
              (value) => setSettings(prev => ({
                ...prev,
                attendance: { ...prev.attendance, dailyXP: value }
              }))
            )}
            {renderNumberInput(
              '연속 출석 보너스',
              settings.attendance.streakBonus,
              (value) => setSettings(prev => ({
                ...prev,
                attendance: { ...prev.attendance, streakBonus: value }
              }))
            )}
            {renderNumberInput(
              '주간 완주 보너스',
              settings.attendance.weeklyBonusXP,
              (value) => setSettings(prev => ({
                ...prev,
                attendance: { ...prev.attendance, weeklyBonusXP: value }
              }))
            )}
          </View>
        </View>

        {/* 추천인 시스템 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추천인 시스템</Text>
          <View style={styles.sectionContent}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>추천인 시스템 활성화</Text>
              <Switch
                value={settings.referral.enabled}
                onValueChange={(value) => setSettings(prev => ({
                  ...prev,
                  referral: { ...prev.referral, enabled: value }
                }))}
                trackColor={{ false: pastelGreenColors[200], true: pastelGreenColors[400] }}
                thumbColor={settings.referral.enabled ? pastelGreenColors[600] : '#f4f3f4'}
              />
            </View>
            
            {settings.referral.enabled && (
              <>
                {renderNumberInput(
                  '추천인이 받는 경험치',
                  settings.referral.referrerXP,
                  (value) => setSettings(prev => ({
                    ...prev,
                    referral: { ...prev.referral, referrerXP: value }
                  })),
                  'A가 추천인으로 설정되었을 때 A가 받는 경험치'
                )}
                {renderNumberInput(
                  '추천받은 사람이 받는 경험치',
                  settings.referral.refereeXP,
                  (value) => setSettings(prev => ({
                    ...prev,
                    referral: { ...prev.referral, refereeXP: value }
                  })),
                  'B가 A를 추천인으로 설정했을 때 B가 받는 경험치'
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: pastelGreenColors[600],
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pastelGreenColors[500],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pastelGreenColors[200],
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: pastelGreenColors[800],
    padding: 16,
    backgroundColor: pastelGreenColors[50],
    borderBottomWidth: 1,
    borderBottomColor: pastelGreenColors[200],
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'monospace',
  },
  sectionContent: {
    padding: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: pastelGreenColors[700],
    marginTop: 16,
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: pastelGreenColors[700],
    marginBottom: 8,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: pastelGreenColors[800],
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: pastelGreenColors[700],
  },
  divider: {
    height: 1,
    backgroundColor: pastelGreenColors[200],
    marginVertical: 16,
  },
  thresholdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  thresholdInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  thresholdInput: {
    flex: 1,
  },
  thresholdLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: pastelGreenColors[600],
    marginBottom: 4,
  },
  thresholdTextInput: {
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: 'white',
    color: pastelGreenColors[800],
  },
  removeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: pastelGreenColors[300],
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    color: pastelGreenColors[600],
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
    color: pastelGreenColors[600],
    marginBottom: 8,
    lineHeight: 20,
  },
}); 