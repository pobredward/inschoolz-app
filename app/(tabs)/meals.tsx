import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getWeeklyMealPlan } from '../../lib/meals';
import MealCard from '../../components/meals/MealCard';
import { WeeklyMealPlan as WeeklyMealPlanType } from '../../types';
import { router } from 'expo-router';

export default function MealsScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlanType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('');

  // 이번 주 시작일 계산
  const getWeekStart = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day;
    const weekStart = new Date(date.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  };

  // 주간 날짜 배열 생성
  const getWeekDates = (weekStart: string) => {
    const dates = [];
    const start = new Date(weekStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  };

  // 날짜 포맷팅
  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return { month, day, dayOfWeek };
  };

  // 주간 급식 정보 로드
  const loadWeeklyMeals = async (weekStart: string) => {
    if (!user?.school?.id) return;

    setIsLoading(true);
    try {
      const plan = await getWeeklyMealPlan(user.school.id, weekStart);
      setWeeklyPlan(plan);
      
    } catch (error) {
      console.error('주간 급식 정보 로드 실패:', error);
      Alert.alert('오류', '급식 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 이전/다음 주로 이동
  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart);
    const newDate = new Date(current);
    newDate.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
    const newWeekStart = getWeekStart(newDate);
    setCurrentWeekStart(newWeekStart);
  };

  // 새로고침
  const handleRefresh = () => {
    if (currentWeekStart) {
      loadWeeklyMeals(currentWeekStart);
    }
  };

  // 초기화
  useEffect(() => {
    const today = new Date();
    const weekStart = getWeekStart(today);
    setCurrentWeekStart(weekStart);
  }, []);

  // 주차 변경 시 데이터 로드
  useEffect(() => {
    if (currentWeekStart) {
      loadWeeklyMeals(currentWeekStart);
    }
  }, [currentWeekStart, user?.school?.id]);

  // 로그인하지 않은 경우
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>급식 정보 서비스</Text>
          <Text style={styles.emptyDescription}>
            로그인하시면 학교별 급식 정보를 확인할 수 있습니다.
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 학교 정보가 없는 경우
  if (!user.school?.id) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>학교 설정 필요</Text>
          <Text style={styles.emptyDescription}>
            급식 정보를 확인하려면 먼저 학교를 설정해주세요.
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/profile-edit')}
          >
            <Text style={styles.loginButtonText}>학교 설정하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const weekDates = currentWeekStart ? getWeekDates(currentWeekStart) : [];

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>급식 정보</Text>
          <Text style={styles.subtitle}>{user.school.name}의 급식 정보</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
      >
        {/* 주간 네비게이션 */}
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={() => navigateWeek('prev')}>
            <Ionicons name="chevron-back" size={24} color="#6B7280" />
          </TouchableOpacity>
          
          <View style={styles.weekTitleContainer}>
            <Text style={styles.weekTitle}>
              {currentWeekStart && weekDates.length > 0 && (
                `${formatDateHeader(currentWeekStart).month}월 ${formatDateHeader(currentWeekStart).day}일 ~ ${formatDateHeader(weekDates[6] || currentWeekStart).month}월 ${formatDateHeader(weekDates[6] || currentWeekStart).day}일`
              )}
            </Text>
            <Text style={styles.schoolBadge}>{user.school.name}</Text>
          </View>
          
          <TouchableOpacity onPress={() => navigateWeek('next')}>
            <Ionicons name="chevron-forward" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* 전체 주간 급식 정보 (스크롤 방식) */}
        {weeklyPlan ? (
          <View style={styles.weeklyMealsContainer}>
            {weekDates.map((date) => {
              const dayMeals = weeklyPlan.meals[date];
              if (!dayMeals || Object.keys(dayMeals).length === 0) return null;

              const { month, day, dayOfWeek } = formatDateHeader(date);
              const isToday = date === new Date().toISOString().split('T')[0];

              return (
                <View key={date} style={styles.dayMealsContainer}>
                  <View style={[styles.dayHeader, isToday && styles.todayDayHeader]}>
                    <Text style={[styles.dayTitle, isToday && styles.todayDayTitle]}>
                      {month}월 {day}일 ({dayOfWeek})
                    </Text>
                    {isToday && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayBadgeText}>오늘</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.dayMealsContent}>
                    {dayMeals.breakfast && (
                      <MealCard 
                        meal={dayMeals.breakfast}
                        style={styles.mealCard}
                      />
                    )}
                    {dayMeals.lunch && (
                      <MealCard 
                        meal={dayMeals.lunch}
                        style={styles.mealCard}
                      />
                    )}
                    {dayMeals.dinner && (
                      <MealCard 
                        meal={dayMeals.dinner}
                        style={styles.mealCard}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyMealsContainer}>
            <Ionicons name="restaurant-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyMealsText}>급식 정보를 불러올 수 없습니다</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  weekTitleContainer: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  schoolBadge: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  weeklyMealsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  dayMealsContainer: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  todayDayHeader: {
    borderBottomColor: '#10B981',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  todayDayTitle: {
    color: '#10B981',
  },
  todayBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dayMealsContent: {
    gap: 12,
  },
  mealCard: {
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyMealsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyMealsText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
});