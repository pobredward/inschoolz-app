import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { Post } from '../types';
import { getPostPreviewImages, formatSmartTime } from '../utils/timeUtils';

// HTML을 텍스트로 변환하면서 줄바꿈 보존
const parseContentWithLineBreaks = (content: string): string => {
  if (!content) return '';
  
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
};

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
      {/* 헤더 - 모든 뱃지들을 한 줄에 정렬 */}
      {showBadges && (
        <View style={styles.postHeader}>
          <View style={styles.allBadgesContainer}>
            {typeBadgeText && (
              <Text style={styles.postTypeBadge}>{typeBadgeText}</Text>
            )}
            {boardBadgeText && (
              <Text style={styles.postBoardBadge}>{boardBadgeText}</Text>
            )}
            {previewImages.length > 0 && (
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>📷 사진</Text>
              </View>
            )}
            {post.poll && (
              <View style={styles.pollBadge}>
                <Text style={styles.pollBadgeText}>📊 투표</Text>
              </View>
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
          
          {(post.previewContent || post.content) && (
            <Text style={styles.postPreview} numberOfLines={2}>
              {post.previewContent || parseContentWithLineBreaks(post.content).slice(0, 150) || ''}
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
          {post.authorInfo?.isAnonymous ? (
            <Text style={styles.postStatItem}>
              익명 | {formatSmartTime(post.createdAt)}
            </Text>
          ) : (
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/users/${post.authorId}`);
              }}
            >
              <Text style={styles.postStatItem}>
                <Text style={styles.clickableAuthor}>{post.authorInfo?.displayName || '사용자'}</Text> | {formatSmartTime(post.createdAt)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.postStatsRight}>
          <Text style={styles.postStatItem}>👁 {post.stats?.viewCount || 0}</Text>
          <Text style={styles.postStatItem}>👍 {post.stats?.likeCount || 0}</Text>
          <Text style={styles.postStatItem}>💬 {post.stats?.commentCount || 0}</Text>
          <Text style={styles.postStatItem}>🔖 {post.stats?.scrapCount || 0}</Text>
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
    marginBottom: 8,
  },
  allBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  postTypeBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803d',
    backgroundColor: '#f0fdf4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  postBoardBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
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
    lineHeight: 20,
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

  photoBadge: {
    backgroundColor: '#fff7ed',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  photoBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#c2410c',
  },
  pollBadge: {
    backgroundColor: '#faf5ff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  pollBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#7c3aed',
  },
  clickableAuthor: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});

// React.memo로 불필요한 리렌더링 방지
export default React.memo(PostListItem, (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id &&
         prevProps.post.updatedAt === nextProps.post.updatedAt &&
         prevProps.post.stats?.likeCount === nextProps.post.stats?.likeCount &&
         prevProps.post.stats?.commentCount === nextProps.post.stats?.commentCount;
}); 