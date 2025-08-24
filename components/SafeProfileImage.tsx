import React, { useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SafeProfileImageProps {
  uri?: string;
  size: number;
  style?: any;
  fallbackIcon?: string;
  fallbackColor?: string;
}

export const SafeProfileImage: React.FC<SafeProfileImageProps> = ({
  uri,
  size,
  style,
  fallbackIcon = 'person-circle',
  fallbackColor = '#10B981'
}) => {
  const [imageError, setImageError] = useState(false);

  // 카카오 HTTP URL을 HTTPS로 변환
  const convertToHttps = (url?: string): string | undefined => {
    if (!url || url.trim() === '') return undefined;
    
    // 카카오 CDN HTTP URL을 HTTPS로 변환
    if (url.startsWith('http://k.kakaocdn.net/')) {
      const httpsUrl = url.replace('http://', 'https://');
      console.log('🔒 카카오 이미지 URL HTTP→HTTPS 변환:', {
        original: url,
        converted: httpsUrl
      });
      return httpsUrl;
    }
    
    return url;
  };

  // URL이 유효한지 확인
  const isValidUrl = (url?: string): boolean => {
    if (!url || url.trim() === '') return false;
    try {
      new URL(url);
      return url.startsWith('https://');
    } catch {
      return false;
    }
  };

  // HTTPS로 변환된 URL 사용
  const finalUri = convertToHttps(uri);

  const handleImageError = (error: any) => {
    console.warn('SafeProfileImage - 이미지 로드 실패:', {
      originalUri: uri,
      finalUri,
      error: error.nativeEvent?.error,
      isValidUrl: isValidUrl(finalUri)
    });
    setImageError(true);
  };

  const handleImageLoad = () => {
    console.log('SafeProfileImage - 이미지 로드 성공:', finalUri);
    setImageError(false);
  };

  // URL이 변경될 때마다 에러 상태 초기화
  React.useEffect(() => {
    if (finalUri) {
      setImageError(false);
    }
  }, [finalUri]);

  // URL이 유효하지 않거나 에러가 발생한 경우 fallback 아이콘 표시
  if (!isValidUrl(finalUri) || imageError) {
    return (
      <View style={[styles.fallbackContainer, { width: size, height: size }, style]}>
        <Ionicons name={fallbackIcon as any} size={size} color={fallbackColor} />
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={{ uri: finalUri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        onError={handleImageError}
        onLoad={handleImageLoad}
        // React Native에서 이미지 캐싱 및 로딩 개선
        resizeMode="cover"
        // Android에서 이미지 로딩 개선
        fadeDuration={300}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#f0f0f0',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
