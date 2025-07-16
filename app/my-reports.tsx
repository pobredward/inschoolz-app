import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getUserReports, cancelReport } from '../lib/reports';
import { SafeScreenContainer } from '../components/SafeScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import { Report, ReportReason, ReportStatus, UserReportRecord } from '../types';
import { formatRelativeTime } from '../utils/timeUtils';

// HTML 태그를 제거하는 함수
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

export default function MyReportsScreen() {
  const { user } = useAuthStore();
  const [reportRecord, setReportRecord] = useState<UserReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'made' | 'received'>('made');

  useEffect(() => {
    loadReports();
  }, [user]);

  const loadReports = async () => {
    if (!user?.uid) return;

    try {
      const record = await getUserReports(user.uid);
      setReportRecord(record);
    } catch (error) {
      console.error('신고 기록 조회 실패:', error);
      Alert.alert('오류', '신고 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const handleCancelReport = async (reportId: string) => {
    Alert.alert(
      '신고 취소',
      '정말로 신고를 취소하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelReport(reportId);
              Alert.alert('완료', '신고가 취소되었습니다.');
              await loadReports();
            } catch (error) {
              console.error('신고 취소 실패:', error);
              Alert.alert('오류', '신고 취소에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  // 게시글 URL 생성 함수
  const getPostRoute = (report: Report) => {
    if (!report.boardCode) return null;
    
    if (report.targetType === 'post') {
      // 게시글 경로 생성
      if (report.schoolId) {
        return `/board/school/${report.schoolId}/${report.boardCode}/${report.targetId}`;
      } else if (report.regions) {
        return `/board/regional/${report.regions.sido}/${report.regions.sigungu}/${report.boardCode}/${report.targetId}`;
      } else {
        return `/board/national/${report.boardCode}/${report.targetId}`;
      }
    } else if (report.targetType === 'comment' && report.postId) {
      // 댓글이 있는 게시글 경로 생성
      if (report.schoolId) {
        return `/board/school/${report.schoolId}/${report.boardCode}/${report.postId}`;
      } else if (report.regions) {
        return `/board/regional/${report.regions.sido}/${report.regions.sigungu}/${report.boardCode}/${report.postId}`;
      } else {
        return `/board/national/${report.boardCode}/${report.postId}`;
      }
    }
    return null;
  };

  // 신고 카드 클릭 핸들러
  const handleReportPress = (report: Report) => {
    const route = getPostRoute(report);
    if (route) {
      router.push(route as any);
    }
  };

  // 신고 대상 내용에서 HTML 태그 제거
  const getCleanContent = (content: string) => {
    if (!content) return '';
    return stripHtmlTags(content);
  };

  // 게시글 신고 시 제목과 내용 분리하는 함수
  const parsePostContent = (targetContent: string | undefined, targetType: string) => {
    if (!targetContent || targetType !== 'post') {
      return { title: null, content: targetContent || '' };
    }

    try {
      // JSON 형태로 저장된 경우 파싱 시도
      const parsed = JSON.parse(targetContent);
      if (parsed.title && parsed.content) {
        return {
          title: parsed.title,
          content: parsed.content
        };
      }
    } catch {
      // JSON이 아닌 경우 구분자로 분리 시도
      if (targetContent.includes('|||')) {
        const [title, content] = targetContent.split('|||');
        return {
          title: title?.trim() || null,
          content: content?.trim() || targetContent
        };
      }
    }

    // 분리할 수 없는 경우 모든 내용을 content로 처리
    return { title: null, content: targetContent };
  };

  const getStatusBadge = (status: ReportStatus) => {
    const statusConfig = {
      pending: { text: '대기중', color: '#f59e0b', icon: 'time' },
      reviewing: { text: '검토중', color: '#3b82f6', icon: 'eye' },
      resolved: { text: '처리완료', color: '#10b981', icon: 'checkmark-circle' },
      rejected: { text: '반려', color: '#ef4444', icon: 'close-circle' }
    };
    
    return statusConfig[status] || { text: status, color: '#6b7280', icon: 'help-circle' };
  };

  const getReasonLabel = (reason: ReportReason) => {
    const reasonMap: Record<ReportReason, string> = {
      spam: '스팸/도배',
      inappropriate: '부적절한 내용',
      harassment: '괴롭힘/욕설',
      fake: '허위정보',
      copyright: '저작권 침해',
      privacy: '개인정보 노출',
      violence: '폭력적 내용',
      sexual: '성적 내용',
      hate: '혐오 발언',
      other: '기타',
    };
    return reasonMap[reason] || reason;
  };

  const getTargetTypeLabel = (type: string) => {
    switch (type) {
      case 'post': return '게시글';
      case 'comment': return '댓글';
      case 'user': return '사용자';
      default: return type;
    }
  };

  const formatDate = (timestamp: number) => {
    return formatRelativeTime(timestamp);
  };

  const renderReportItem = ({ item: report }: { item: Report }) => {
    const statusConfig = getStatusBadge(report.status);
    const canCancel = report.status === 'pending' && selectedTab === 'made';

    return (
      <TouchableOpacity 
        style={styles.reportCard}
        onPress={() => handleReportPress(report)}
        activeOpacity={0.7}
      >
        <View style={styles.reportHeader}>
          <View style={styles.reportTypeContainer}>
            <Text style={styles.reportType}>
              {getTargetTypeLabel(report.targetType)} 신고{selectedTab === 'received' ? '' : ''}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
              <Ionicons name={statusConfig.icon as any} size={12} color="white" />
              <Text style={styles.statusText}>{statusConfig.text}</Text>
            </View>
          </View>
          <Text style={styles.reportDate}>{formatDate(report.createdAt)}</Text>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" style={styles.chevronIcon} />
        </View>

        <View style={styles.reportContent}>
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonLabel}>신고 사유: </Text>
            <Text style={styles.reasonText}>{getReasonLabel(report.reason)}</Text>
            {report.customReason && (
              <Text style={styles.customReason}> - {report.customReason}</Text>
            )}
          </View>

          {/* 신고한 유저 아이디 표시 (내가 신고한 내역에서만) */}
          {selectedTab === 'made' && report.targetType === 'user' && report.targetId && (
            <View style={styles.targetUserContainer}>
              <Text style={styles.targetUserLabel}>신고한 유저: </Text>
              <Text style={styles.targetUserText}>@{report.targetId}</Text>
            </View>
          )}

          {report.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>
                {selectedTab === 'received' ? '신고 상세 설명' : '상세 설명'}: 
              </Text>
              <Text style={styles.descriptionText}>{report.description}</Text>
            </View>
          )}

          {report.targetContent && (
            <View style={styles.targetContentContainer}>
              <Text style={styles.targetContentLabel}>
                {selectedTab === 'received' ? '신고된 내용' : '신고 대상 내용'}:
              </Text>
              <View style={styles.targetContentBox}>
                {(() => {
                  const { title, content } = parsePostContent(report.targetContent, report.targetType);
                  return (
                    <View style={styles.contentContainer}>
                      {title && (
                        <View style={styles.titleContainer}>
                          <Text style={styles.contentTypeLabel}>제목:</Text>
                          <Text style={styles.titleText} numberOfLines={1}>
                            {getCleanContent(title)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.bodyContainer}>
                        {title && <Text style={styles.contentTypeLabel}>내용:</Text>}
                        <Text style={styles.targetContentText} numberOfLines={2}>
                          {getCleanContent(content)}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {report.status === 'resolved' && report.actionTaken && (
            <View style={styles.actionContainer}>
              <Text style={styles.actionLabel}>처리 결과: </Text>
              <Text style={styles.actionText}>{report.actionTaken}</Text>
            </View>
          )}

          {report.status === 'rejected' && report.adminNote && (
            <View style={styles.actionContainer}>
              <Text style={styles.actionLabel}>반려 사유: </Text>
              <Text style={[styles.actionText, { color: '#ef4444' }]}>{report.adminNote}</Text>
            </View>
          )}

          {canCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={(e) => {
                e.stopPropagation();
                handleCancelReport(report.id);
              }}
            >
              <Ionicons name="trash" size={16} color="#ef4444" />
              <Text style={styles.cancelButtonText}>신고 취소</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={selectedTab === 'made' ? "flag-outline" : "shield-checkmark-outline"} 
        size={80} 
        color={selectedTab === 'made' ? "#f59e0b" : "#10b981"} 
      />
      <Text style={styles.emptyTitle}>
        {selectedTab === 'made' ? '신고한 내역이 없습니다' : '신고받은 내역이 없습니다'}
      </Text>
      <Text style={styles.emptyDescription}>
        {selectedTab === 'made' 
          ? '부적절한 내용을 발견하시면 신고해주세요.' 
          : '깨끗한 활동을 유지하고 계시네요!'}
      </Text>
    </View>
  );

  const renderStats = () => {
    if (!reportRecord) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{reportRecord.stats.totalReportsMade}</Text>
          <Text style={styles.statLabel}>내가 신고한 수</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{reportRecord.stats.totalReportsReceived}</Text>
          <Text style={styles.statLabel}>신고받은 수</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{reportRecord.stats.warningsReceived}</Text>
          <Text style={styles.statLabel}>받은 경고</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>신고 기록</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>로딩 중...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const currentData = selectedTab === 'made' 
    ? reportRecord?.reportsMade || []
    : reportRecord?.reportsReceived || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>신고 기록</Text>
          <View style={styles.placeholder} />
        </View>

        {renderStats()}

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'made' && styles.activeTab]}
            onPress={() => setSelectedTab('made')}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, selectedTab === 'made' && styles.activeTabText]}>
                내가 신고한 내역
              </Text>
              <View style={[styles.tabBadge, selectedTab === 'made' && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, selectedTab === 'made' && styles.activeTabBadgeText]}>
                  {reportRecord?.reportsMade.length || 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'received' && styles.activeTab]}
            onPress={() => setSelectedTab('received')}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, selectedTab === 'received' && styles.activeTabText]}>
                신고받은 내역
              </Text>
              <View style={[styles.tabBadge, selectedTab === 'received' && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, selectedTab === 'received' && styles.activeTabBadgeText]}>
                  {reportRecord?.reportsReceived.length || 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.tabHeaderContainer}>
          <Text style={styles.tabHeaderTitle}>
            {selectedTab === 'made' ? '내가 신고한 내역' : '나를 신고한 내역'}
          </Text>
          <View style={styles.tabHeaderBadge}>
            <Text style={styles.tabHeaderBadgeText}>{currentData.length}개</Text>
          </View>
        </View>

        <FlatList
          data={currentData}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 0,
    shadowOpacity: 0,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 36,
    height: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#10b981',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#10b981',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: '#10b981',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabBadgeText: {
    color: 'white',
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabHeaderBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tabHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  listContainer: {
    flexGrow: 1,
    backgroundColor: '#f9fafb',
  },
  reportCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reportHeader: {
    marginBottom: 12,
  },
  reportTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
    marginLeft: 4,
  },
  reportDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  chevronIcon: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  reportContent: {
    gap: 12,
  },
  reasonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  reasonText: {
    fontSize: 14,
    color: '#1f2937',
  },
  customReason: {
    fontSize: 14,
    color: '#6b7280',
  },
  targetUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetUserLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  targetUserText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  descriptionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  targetContentContainer: {
    marginTop: 4,
  },
  targetContentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  targetContentBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  targetContentText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  actionText: {
    fontSize: 14,
    color: '#10b981',
    flex: 1,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  contentContainer: {
    gap: 8,
  },
  titleContainer: {
    gap: 4,
  },
  bodyContainer: {
    gap: 4,
  },
  contentTypeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  titleText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 18,
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  safeArea: {
    flex: 1,
  },
}); 