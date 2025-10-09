import React, { useState } from 'react';
import { Dimensions, Image } from 'react-native';
import RenderHtml from 'react-native-render-html';

const { width } = Dimensions.get('window');

interface HtmlRendererProps {
  html: string;
  contentWidth?: number;
  baseStyle?: Record<string, string | number>;
}

const HtmlRenderer = React.memo(function HtmlRenderer({ 
  html, 
  contentWidth = width - 32, 
  baseStyle = {} 
}: HtmlRendererProps) {
  // HTML 정리 - 줄바꿈을 브라우저에서 렌더링되도록 처리
  const cleanHtml = html
    .replace(/\n/g, '<br>')
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/<\/p>/gi, '<br>')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '<br>')
    .replace(/<div[^>]*>/gi, '');

  const tagsStyles = {
    p: {
      fontSize: 16,
      lineHeight: 24,
      color: '#374151',
      marginBottom: 12,
      ...baseStyle,
    },
    img: {
      marginVertical: 8,
    },
    strong: {
      fontWeight: '600' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    u: {
      textDecorationLine: 'underline' as const,
    },
    h1: {
      fontSize: 24,
      fontWeight: '700' as const,
      marginBottom: 16,
      color: '#111827',
    },
    h2: {
      fontSize: 20,
      fontWeight: '600' as const,
      marginBottom: 12,
      color: '#111827',
    },
    ul: {
      marginBottom: 12,
    },
    ol: {
      marginBottom: 12,
    },
    li: {
      fontSize: 16,
      lineHeight: 24,
      color: '#374151',
      marginBottom: 4,
    },

    code: {
      backgroundColor: '#F3F4F6',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'monospace',
    },
    pre: {
      backgroundColor: '#F3F4F6',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    a: {
      color: '#10B981',
      textDecorationLine: 'underline' as const,
    },
    br: {
      fontSize: 16,
      lineHeight: 24,
    },
  };

  const classesStyles = {
    'ql-align-center': {
      textAlign: 'center' as const,
    },
    'ql-align-right': {
      textAlign: 'right' as const,
    },
    'ql-align-justify': {
      textAlign: 'justify' as const,
    },
  };

  // 이미지 렌더링 커스터마이징
  const renderersProps = {
    img: {
      enableExperimentalPercentWidth: true,
    },
  };

  const renderers = {
    img: (props: any) => {
      const { tnode } = props;
      const { src } = tnode.attributes;
      
      // 이미지 크기 계산
      const maxWidth = contentWidth - 32;
      
      // 이미지 비율을 유지하면서 표시하는 컴포넌트
      const ResponsiveImage = React.memo(function ResponsiveImage() {
        const [imageSize, setImageSize] = useState({ width: maxWidth, height: 200 });
        const [isLoaded, setIsLoaded] = useState(false);
        
        const handleImageLoad = (event: { nativeEvent: { source: { width: number; height: number } } }) => {
          const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
          
          if (imgWidth && imgHeight) {
            // 이미지의 실제 비율 계산
            const aspectRatio = imgHeight / imgWidth;
            const calculatedHeight = maxWidth * aspectRatio;
            
            // 최대 높이 제한 (너무 긴 이미지 방지)
            const finalHeight = Math.min(calculatedHeight, 600);
            
            setImageSize({
              width: maxWidth,
              height: finalHeight
            });
            setIsLoaded(true);
          }
        };
        
        return (
          <Image
            key={`${src}-${maxWidth}`}
            source={{ uri: src }}
            style={{
              width: imageSize.width,
              height: imageSize.height,
              borderRadius: 8,
              marginVertical: 8,
              opacity: isLoaded ? 1 : 0.8,
            }}
            resizeMode="contain"
            onLoad={handleImageLoad}
            onError={() => {
              console.log('이미지 로드 실패:', src);
              setIsLoaded(true);
            }}
          />
        );
      });
      
      return <ResponsiveImage />;
    },
  };

  return (
    <RenderHtml
      contentWidth={contentWidth}
      source={{ html: cleanHtml }}
      tagsStyles={tagsStyles}
      classesStyles={classesStyles}
      renderersProps={renderersProps}
      renderers={renderers}
      systemFonts={[]}
      defaultTextProps={{
        selectable: true,
      }}
      enableExperimentalBRCollapsing={false}
      enableExperimentalMarginCollapsing={false}
    />
  );
});

export default HtmlRenderer; 