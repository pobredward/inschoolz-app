import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FirebaseTimestamp } from '@/types';

const { width } = Dimensions.get('window');

interface PollOption {
  text: string;
  imageUrl?: string;
  voteCount: number;
  index: number;
}

interface PollData {
  isActive: boolean;
  question: string;
  options: PollOption[];
  expiresAt?: FirebaseTimestamp;
  multipleChoice: boolean;
  voters?: string[]; // 투표한 사용자 ID 목록
  userVotes?: { [userId: string]: number }; // 사용자별 투표 선택지 기록
}

interface PollVotingProps {
  postId: string;
  poll: PollData;
  onVoteUpdate?: (updatedPoll: PollData) => void;
}

export const PollVoting = ({ postId, poll, onVoteUpdate }: PollVotingProps) => {
  const { user } = useAuthStore();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [localPoll, setLocalPoll] = useState<PollData>(poll);

  // 사용자가 이미 투표했는지 확인 및 기존 투표 선택지 설정
  useEffect(() => {
    if (user && localPoll.userVotes) {
      const userPreviousVote = localPoll.userVotes[user.uid];
      if (userPreviousVote !== undefined) {
        setHasVoted(true);
        setSelectedOption(userPreviousVote);
      }
    } else if (user && localPoll.voters) {
      setHasVoted(localPoll.voters.includes(user.uid));
    }
  }, [user, localPoll.voters, localPoll.userVotes]);

  // 총 투표 수 계산
  const totalVotes = localPoll.options.reduce((sum, option) => sum + option.voteCount, 0);

  // 투표 처리
  const handleVote = async (optionIndex: number) => {
    if (!user) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    if (!localPoll.isActive) {
      Alert.alert('알림', '투표가 종료되었습니다.');
      return;
    }

    setIsVoting(true);

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        Alert.alert('오류', '게시글을 찾을 수 없습니다.');
        return;
      }

      const currentPoll = postDoc.data().poll as PollData;
      const updatedOptions = [...currentPoll.options];
      const currentVoters = currentPoll.voters || [];
      const currentUserVotes = currentPoll.userVotes || {};

      // 기존 투표가 있다면 해당 옵션의 카운트 감소 (userVotes가 있는 경우에만)
      if (hasVoted && currentUserVotes[user.uid] !== undefined) {
        const previousOptionIndex = currentUserVotes[user.uid];
        if (previousOptionIndex >= 0 && previousOptionIndex < updatedOptions.length) {
          updatedOptions[previousOptionIndex].voteCount = Math.max(0, updatedOptions[previousOptionIndex].voteCount - 1);
        }
      }

      // 새로운 투표 추가
      updatedOptions[optionIndex].voteCount += 1;

      // 사용자 투표 기록 업데이트
      const updatedUserVotes = {
        ...currentUserVotes,
        [user.uid]: optionIndex
      };

      const updatedPoll = {
        ...currentPoll,
        options: updatedOptions,
        voters: hasVoted ? currentVoters : [...currentVoters, user.uid],
        userVotes: updatedUserVotes
      };

      // Firestore 업데이트
      await updateDoc(postRef, {
        poll: updatedPoll
      });

      // 로컬 상태 업데이트
      setLocalPoll(updatedPoll);
      setSelectedOption(optionIndex);
      setHasVoted(true);
      
      if (onVoteUpdate) {
        onVoteUpdate(updatedPoll);
      }

      Alert.alert('성공', hasVoted ? '투표를 변경했습니다.' : '투표가 완료되었습니다.');
    } catch (error) {
      console.error('투표 오류:', error);
      Alert.alert('오류', '투표 처리 중 오류가 발생했습니다.');
    } finally {
      setIsVoting(false);
    }
  };

  // 투표 취소
  const handleRemoveVote = () => {
    Alert.alert(
      '투표 취소',
      '정말로 투표를 취소하시겠습니까?',
      [
        { text: '아니오', style: 'cancel' },
        { text: '예', onPress: confirmRemoveVote }
      ]
    );
  };

  const confirmRemoveVote = async () => {
    if (!user || !hasVoted) return;

    setIsVoting(true);

    try {
      const postRef = doc(db, 'posts', postId);
      
      // 현재 데이터를 다시 가져와서 정확한 상태 확인
      const postDoc = await getDoc(postRef);
      if (!postDoc.exists()) {
        Alert.alert('오류', '게시글을 찾을 수 없습니다.');
        return;
      }

      const currentPoll = postDoc.data().poll as PollData;
      const updatedVoters = (currentPoll.voters || []).filter(voterId => voterId !== user.uid);
      const currentUserVotes = currentPoll.userVotes || {};
      
      // 기존 투표한 옵션의 카운트 감소
      if (currentUserVotes[user.uid] !== undefined) {
        const userVotedOptionIndex = currentUserVotes[user.uid];
        const updatedOptions = [...currentPoll.options];
        updatedOptions[userVotedOptionIndex].voteCount = Math.max(0, updatedOptions[userVotedOptionIndex].voteCount - 1);
        
        // 사용자 투표 기록에서 제거
        const updatedUserVotes = { ...currentUserVotes };
        delete updatedUserVotes[user.uid];
        
        const updatedPoll = {
          ...currentPoll,
          options: updatedOptions,
          voters: updatedVoters,
          userVotes: updatedUserVotes
        };
        
        await updateDoc(postRef, {
          poll: updatedPoll
        });

        setLocalPoll(updatedPoll);
        setHasVoted(false);
        setSelectedOption(null);
        
        if (onVoteUpdate) {
          onVoteUpdate(updatedPoll);
        }

        Alert.alert('성공', '투표를 취소했습니다.');
      }
    } catch (error) {
      console.error('투표 취소 오류:', error);
      Alert.alert('오류', '투표 취소 중 오류가 발생했습니다.');
    } finally {
      setIsVoting(false);
    }
  };

  // 투표 결과 보기 여부 (투표한 사람만 결과 볼 수 있음)
  const showResults = hasVoted || !localPoll.isActive;

  return (
    <View style={styles.container}>
      {/* 투표 상태 뱃지 */}
      <View style={styles.badges}>
        {!localPoll.isActive && (
          <View style={[styles.badge, styles.endedBadge]}>
            <Ionicons name="time-outline" size={12} color="#6b7280" />
            <Text style={styles.badgeText}>종료</Text>
          </View>
        )}
        {showResults && (
          <View style={[styles.badge, styles.voteBadge]}>
            <Ionicons name="people-outline" size={12} color="#3b82f6" />
            <Text style={[styles.badgeText, { color: '#3b82f6' }]}>{totalVotes}표</Text>
          </View>
        )}
      </View>

      {/* 투표 옵션들 */}
      <View style={styles.optionsContainer}>
        {localPoll.options.map((option, index) => {
          const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
          const isSelected = selectedOption === index;
          const hasImage = !!option.imageUrl;
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                hasImage && styles.optionButtonWithImage,
                showResults && styles.optionButtonResult,
                isSelected && showResults && styles.selectedOption,
                !user && styles.disabledOption,
                !showResults && styles.optionButtonVoting
              ]}
              onPress={() => {
                if (!showResults && user && localPoll.isActive && !isVoting) {
                  handleVote(index);
                }
              }}
              disabled={isVoting || !user || (!localPoll.isActive && !showResults)}
            >
              {/* 투표 결과 배경 */}
              {showResults && (
                <View 
                  style={[
                    styles.resultBackground,
                    { width: `${percentage}%` }
                  ]}
                />
              )}
              
              <View style={styles.optionContent}>
                <View style={styles.optionTextContainer}>
                  <View style={styles.textAndCheck}>
                    <Text style={[
                      styles.optionText,
                      isSelected && showResults && styles.selectedOptionText
                    ]}>
                      {option.text}
                    </Text>
                    {isSelected && showResults && (
                      <Ionicons name="checkmark" size={16} color="#3b82f6" style={styles.checkIcon} />
                    )}
                  </View>
                  
                  {showResults && (
                    <View style={styles.voteInfo}>
                      <Text style={styles.voteCount}>{option.voteCount}표</Text>
                      <Text style={styles.percentage}>({percentage.toFixed(1)}%)</Text>
                    </View>
                  )}
                </View>
                
                {/* 이미지 표시 - 오른쪽 끝에 박스 높이와 동일하게 */}
                {option.imageUrl && (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: option.imageUrl }}
                      style={styles.optionImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 투표 상태 및 액션 */}
      <View style={styles.footer}>
        <Text style={styles.statusText}>
          {!user ? (
            "로그인 후 투표할 수 있습니다"
          ) : !localPoll.isActive ? (
            "투표가 종료되었습니다"
          ) : hasVoted ? (
            "투표에 참여했습니다"
          ) : (
            "선택지를 터치해서 투표하세요"
          )}
        </Text>
        
        {user && hasVoted && localPoll.isActive && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleRemoveVote}
            disabled={isVoting}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Text style={styles.cancelButtonText}>투표 취소</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  endedBadge: {
    backgroundColor: '#f3f4f6',
  },
  voteBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 100,
  },
  optionButtonWithImage: {
    minHeight: 100,
  },
  optionButtonResult: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  optionButtonVoting: {
    backgroundColor: '#fafafa',
  },
  selectedOption: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  disabledOption: {
    opacity: 0.5,
  },
  resultBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#dbeafe',
    opacity: 0.3,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
  },
  optionTextContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  textAndCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  selectedOptionText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 8,
  },
  voteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  voteCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  percentage: {
    fontSize: 12,
    color: '#9ca3af',
  },
  imageContainer: {
    height: '100%',
    alignSelf: 'stretch',
  },
  optionImage: {
    width: 80,
    height: '100%',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
}); 