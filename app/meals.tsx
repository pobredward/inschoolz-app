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
import { useAuthStore } from '../store/authStore';
import { getTodayMeals, getWeeklyMealPlan } from '../lib/meals';
import MealCard from '../components/meals/MealCard';
import { MealInfo, WeeklyMealPlan as WeeklyMealPlanType } from '../types';
import { router } from 'expo-router';

type TabType = 'today' | 'weekly';

export default function MealsScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [todayMeals, setTodayMeals] = useState<MealInfo[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlanType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 오늘의 급식 정보 로드
  const loadTodayMeals = async () => {
    if (!user?.school?.id) return;

    setIsLoading(true);
    try {
      const response = await getTodayMeals(user.school.id);
      
      if (response.success) {
        setTodayMeals(response.data);
        setLastUpdated(new Date());
      } else {
        Alert.alert('오류', response.message || '급식 정보를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('오늘의 급식 정보 로드 실패:', error);
      Alert.alert('오류', '급식 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 주간 급식 정보 로드
  const loadWeeklyMeals = async () => {
    if (!user?.school?.id) return;

    setIsLoading(true);
    try {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day;
      const weekStart = new Date(today.setDate(diff));
      const weekStartString = weekStart.toISOString().split('T')[0];

      const plan = await getWeeklyMealPlan(user.school.id, weekStartString);
      setWeeklyPlan(plan);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('주간 급식 정보 로드 실패:', error);
      Alert.alert('오류', '급식 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 데이터 새로고침
  const onRefresh = () => {
    if (activeTab === 'today') {
      loadTodayMeals();
    } else {
      loadWeeklyMeals();
    }
  };

  // 탭 변경
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'today' && todayMeals.length === 0) {
      loadTodayMeals();
    } else if (tab === 'weekly' && !weeklyPlan) {
      loadWeeklyMeals();
    }
  };

  // 초기 로드
  useEffect(() => {
    if (user?.school?.id) {
      loadTodayMeals();
    }
  }, [user?.school?.id]);

  // 로그인하지 않은 경우
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
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
        <View style={styles.alertContainer}>
          <Ionicons name="warning-outline" size={24} color="#F59E0B" />
          <Text style={styles.alertText}>
            급식 정보를 확인하려면 먼저 학교를 설정해주세요.
          </Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.settingsButtonText}>학교 설정하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  // 오늘 날짜
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>급식 정보</Text>
          <Text style={styles.subtitle}>{user.school.name}</Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsIconButton}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Ionicons name="settings-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* 탭 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'today' && styles.activeTab]}
          onPress={() => handleTabChange('today')}
        >
          <Ionicons 
            name="restaurant-outline" 
            size={18} 
            color={activeTab === 'today' ? '#3B82F6' : '#6B7280'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'today' && styles.activeTabText
          ]}>
            오늘의 급식
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'weekly' && styles.activeTab]}
          onPress={() => handleTabChange('weekly')}
        >
          <Ionicons 
            name="calendar-outline" 
            size={18} 
            color={activeTab === 'weekly' ? '#3B82F6' : '#6B7280'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'weekly' && styles.activeTabText
          ]}>
            주간 급식표
          </Text>
        </TouchableOpacity>
      </View>

      {/* 컨텐츠 */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'today' ? (
          // 오늘의 급식
          todayMeals.length === 0 ? (
            <View style={styles.emptyMeals}>
              <Ionicons name="restaurant-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyMealsTitle}>오늘의 급식 정보가 없습니다</Text>
              <Text style={styles.emptyMealsDescription}>
                급식이 제공되지 않거나 정보가 업데이트되지 않았을 수 있습니다.
              </Text>
            </View>
          ) : (
            <View style={styles.mealsContainer}>
              {todayMeals
                .sort((a, b) => {
                  const order = { breakfast: 0, lunch: 1, dinner: 2 };
                  return order[a.mealType] - order[b.mealType];
                })
                .map((meal) => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
            </View>
          )
        ) : (
          // 주간 급식표
          weeklyPlan ? (
            <View style={styles.weeklyContainer}>
              {Object.entries(weeklyPlan.meals)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, dayMeals]) => {
                  if (!dayMeals || Object.keys(dayMeals).length === 0) return null;

                  const isToday = date === today;
                  
                  return (
                    <View key={date} style={styles.dayContainer}>
                      <View style={[
                        styles.dayHeader,
                        isToday && styles.todayHeader
                      ]}>
                        <Text style={[
                          styles.dayTitle,
                          isToday && styles.todayTitle
                        ]}>
                          {formatDate(date)}
                        </Text>
                        {isToday && (
                          <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>오늘</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.dayMeals}>
                        {dayMeals.breakfast && (
                          <MealCard meal={dayMeals.breakfast} compact={true} />
                        )}
                        {dayMeals.lunch && (
                          <MealCard meal={dayMeals.lunch} compact={true} />
                        )}
                        {dayMeals.dinner && (
                          <MealCard meal={dayMeals.dinner} compact={true} />
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          ) : (
            <View style={styles.emptyMeals}>
              <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyMealsTitle}>주간 급식 정보가 없습니다</Text>
              <Text style={styles.emptyMealsDescription}>
                급식 정보를 불러오지 못했습니다. 새로고침해주세요.
              </Text>
            </View>
          )
        )}

        {/* 안내 정보 */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>급식 정보 안내</Text>
          <Text style={styles.infoText}>• 급식 정보는 교육부 NEIS 시스템에서 제공받습니다.</Text>
          <Text style={styles.infoText}>• 급식 정보는 매일 자동으로 업데이트됩니다.</Text>
          <Text style={styles.infoText}>• 알레르기 정보는 숫자로 표시되며, 해당 알레르기 유발 요소를 나타냅니다.</Text>
          <Text style={styles.infoText}>• 급식이 제공되지 않는 날에는 정보가 표시되지 않습니다.</Text>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  settingsIconButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  mealsContainer: {
    padding: 16,
  },
  weeklyContainer: {
    padding: 16,
  },
  dayContainer: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  todayHeader: {
    borderBottomColor: '#3B82F6',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  todayTitle: {
    color: '#3B82F6',
  },
  todayBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  todayBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  dayMeals: {
    gap: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  alertContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  alertText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginVertical: 16,
  },
  settingsButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyMeals: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyMealsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMealsDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
});
