import React from 'react';
import { View, StyleSheet, Platform, ScrollView, ViewStyle, RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function SafeScreenContainer({ 
  children, 
  scrollable = false, 
  style,
  contentContainerStyle,
  refreshControl 
}: SafeScreenContainerProps) {
  const insets = useSafeAreaInsets();
  
  // Bottom navigation 높이 (탭바 높이 + safe area)
  const bottomNavHeight = 60 + insets.bottom;
  
  const containerStyle = [
    styles.container,
    {
      // 상단은 SafeAreaView가 이미 처리하므로 추가 여백 최소화
      paddingTop: 16,
      // 하단은 bottom navigation을 고려한 여백
      paddingBottom: bottomNavHeight + 16,
    },
    style,
  ];

  if (scrollable) {
    return (
      <ScrollView 
        style={[styles.container, style]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 16,
            paddingBottom: bottomNavHeight + 16,
          },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={containerStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
}); 