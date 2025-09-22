import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MealInfo } from '../../types';

interface MealCardProps {
  meal: MealInfo;
  showDate?: boolean;
  style?: ViewStyle;
}

export default function MealCard({
  meal,
  showDate = false,
  style
}: MealCardProps) {
  const getMealTypeLabel = (type: string) => {
    switch (type) {
      case 'breakfast':
        return '조식';
      case 'lunch':
        return '중식';
      case 'dinner':
        return '석식';
      default:
        return '급식';
    }
  };

  const getMealTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'breakfast':
        return 'sunny-outline';
      case 'lunch':
        return 'restaurant-outline';
      case 'dinner':
        return 'moon-outline';
      default:
        return 'restaurant-outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  return (
    <View style={[styles.container, style]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons 
            name={getMealTypeIcon(meal.mealType)} 
            size={20} 
            color="#10B981" 
            style={styles.icon}
          />
          <Text style={styles.mealType}>{getMealTypeLabel(meal.mealType)}</Text>
          {showDate && (
            <Text style={styles.date}>{formatDate(meal.date)}</Text>
          )}
        </View>
        {meal.calories && (
          <View style={styles.caloriesContainer}>
            <Ionicons name="flash-outline" size={16} color="#6B7280" />
            <Text style={styles.calories}>{meal.calories}</Text>
          </View>
        )}
      </View>

      {/* 메뉴 목록 */}
      <View style={styles.menuContainer}>
        {meal.menu.map((item, index) => (
          <View key={index} style={styles.menuItem}>
            <View style={styles.bulletPoint} />
            <Text style={styles.menuText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  mealType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  calories: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
  },
  menuContainer: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginTop: 6,
    marginRight: 12,
    flexShrink: 0,
  },
  menuText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
});