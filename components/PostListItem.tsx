import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Post } from '../types';
import { getPostPreviewImages, formatSmartTime } from '../utils/timeUtils';

interface PostListItemProps {
  post: Post & { boardName?: string; previewContent?: string };
  onPress: (post: Post & { boardName?: string; previewContent?: string }) => void;
  showBadges?: boolean;
  imageSize?: 'small' | 'medium';
  variant?: 'home' | 'community' | 'profile';
  typeBadgeText?: string;
  boardBadgeText?: string;
}

const PostListItem: React.FC<PostListItemProps> = ({
  post,
  onPress,
  showBadges = true,
  imageSize = 'medium',
  variant = 'community',
  typeBadgeText,
  boardBadgeText
}) => {
  const previewImages = getPostPreviewImages(post);
  const imageWidth = imageSize === 'small' ? 48 : 60;
  const imageHeight = imageSize === 'small' ? 48 : 60;

  return (
    <TouchableOpacity 
      style={styles.postCard}
      onPress={() => onPress(post)}
    >
      {/* 헤더 - 뱃지들 */}
      {showBadges && (
        <View style={styles.postHeader}>
          <View style={styles.postBadgeContainer}>
            {typeBadgeText && (
              <Text style={styles.postTypeBadge}>{typeBadgeText}</Text>
            )}
            {boardBadgeText && (
              <Text style={styles.postBoardBadge}>{boardBadgeText}</Text>
            )}
            {previewImages.length > 0 && (
              <Text style={styles.imageBadge}>📷</Text>
            )}
          </View>
        </View>
      )}

      {/* 메인 콘텐츠 - 제목, 내용, 이미지 */}
      <View style={styles.postContentContainer}>
        <View style={styles.postTextContainer}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {post.title}
          </Text>
          
          {(post as any).previewContent && (
            <Text style={styles.postPreview} numberOfLines={2}>
              {(post as any).previewContent}
            </Text>
          )}
        </View>
        
        {/* 이미지 미리보기 */}
        {previewImages.length > 0 && (
          <View style={styles.postImagePreviewContainer}>
            {previewImages.map((imageUrl, index) => (
              <View
                key={index}
                style={[
                  styles.postImagePreview,
                  { width: imageWidth, height: imageHeight }
                ]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.postImage}
                  resizeMode="cover"
                  onError={() => {
                    console.log('이미지 로드 실패:', imageUrl);
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
      
      {/* 하단 통계 정보 */}
      <View style={styles.postStats}>
        <View style={styles.postStatsLeft}>
          <Text style={styles.postStatItem}>
            {post.authorInfo?.displayName || '익명'} | {formatSmartTime(post.createdAt)}
          </Text>
        </View>
        <View style={styles.postStatsRight}>
          <Text style={styles.postStatItem}>👁 {post.stats?.viewCount || 0}</Text>
          <Text style={styles.postStatItem}>👍 {post.stats?.likeCount || 0}</Text>
          <Text style={styles.postStatItem}>💬 {post.stats?.commentCount || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postBadgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  postTypeBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    backgroundColor: '#e0e7ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  postBoardBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    backgroundColor: '#d1fae5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  imageBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    backgroundColor: '#fed7aa',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  postContentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  postTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  postPreview: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  postImagePreviewContainer: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  postImagePreview: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStatsLeft: {
    flex: 1,
  },
  postStatsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  postStatItem: {
    fontSize: 12,
    color: '#6b7280',
  },
});

export default PostListItem; 