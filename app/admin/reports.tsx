import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { createNotification } from '@/lib/notifications';
import { 
  Report,
  ReportStatus,
  ReportType,
  ReportReason,
  ReportStats
} from '@/types';
import { 
  collection, 
  doc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toTimestamp } from '@/utils/timeUtils';

// 개선된 색상 팔레트
const colors = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  yellow: {
    50: '#fefce8',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#ef4444',
    600: '#dc2626',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
  },
};

export default function AdminReportsScreen() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'all'>('all');
  const [selectedType, setSelectedType] = useState<ReportType | 'all'>('all');
  
  // 모달 상태들
  const [processingReport, setProcessingReport] = useState<Report | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationData, setNotificationData] = useState({
    targetUserId: '',
    type: 'general' as 'general' | 'warning',
    title: '',
    message: ''
  });
  
  // 폼 상태들
  const [newStatus, setNewStatus] = useState<ReportStatus>('pending');
  const [actionNote, setActionNote] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  // 관리자 권한 확인
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      Alert.alert(
        '접근 권한 없음',
        '관리자만 접근할 수 있습니다.',
        [{ text: '확인', onPress: () => router.back() }]
      );
    }
  }, [user]);

  // 신고 목록 가져오기 (직접 Firestore 쿼리)
  const fetchReports = async (
    status?: ReportStatus,
    type?: ReportType
  ): Promise<Report[]> => {
    try {
      let q = query(
        collection(db, 'reports'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      if (status) {
        q = query(q, where('status', '==', status));
      }
      if (type) {
        q = query(q, where('targetType', '==', type));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[];
    } catch (error) {
      console.error('신고 목록 조회 실패:', error);
      throw error;
    }
  };

  // 신고 통계 가져오기 (직접 계산)
  const fetchReportStats = async (): Promise<ReportStats> => {
    try {
      const allReportsSnapshot = await getDocs(collection(db, 'reports'));
      const allReports = allReportsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Report[];
      
      // 신고 사유별 통계 계산
      const reportsByReason: Record<ReportReason, number> = {
        spam: 0,
        inappropriate: 0,
        harassment: 0,
        fake: 0,
        copyright: 0,
        privacy: 0,
        violence: 0,
        sexual: 0,
        hate: 0,
        other: 0,
      };
      
      // 신고 타입별 통계 계산
      const reportsByType: Record<ReportType, number> = {
        post: 0,
        comment: 0,
        user: 0,
      };
      
      allReports.forEach(report => {
        if (report.reason && reportsByReason.hasOwnProperty(report.reason)) {
          reportsByReason[report.reason]++;
        }
        if (report.targetType && reportsByType.hasOwnProperty(report.targetType)) {
          reportsByType[report.targetType]++;
        }
      });
      
      // 최근 신고 10개
      const recentReports = allReports
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
        .slice(0, 10);
      
      const stats: ReportStats = {
        totalReports: allReports.length,
        pendingReports: allReports.filter(r => r.status === 'pending').length,
        resolvedReports: allReports.filter(r => r.status === 'resolved').length,
        rejectedReports: allReports.filter(r => r.status === 'rejected').length,
        reportsByReason,
        reportsByType,
        recentReports,
      };
      
      return stats;
    } catch (error) {
      console.error('신고 통계 조회 실패:', error);
      throw error;
    }
  };

  // 데이터 로드
  const fetchData = async () => {
    try {
      const [reportsData, statsData] = await Promise.all([
        fetchReports(
          selectedStatus === 'all' ? undefined : selectedStatus,
          selectedType === 'all' ? undefined : selectedType
        ),
        fetchReportStats()
      ]);

      setReports(reportsData || []);
      setStats(statsData);
    } catch (error) {
      console.error('데이터 조회 실패:', error);
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchData();
    }
  }, [user, selectedStatus, selectedType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // 신고 처리
  const handleProcessReport = async () => {
    if (!user || !processingReport) {
      console.error('사용자 정보나 신고 정보가 없습니다:', { user, processingReport });
      Alert.alert('오류', '사용자 정보나 신고 정보가 없습니다.');
      return;
    }

    console.log('신고 처리 시작:', { 
      reportId: processingReport.id, 
      status: newStatus, 
      adminNote: actionNote || undefined, 
      actionTaken: actionTaken || undefined,
      adminId: user.uid
    });

    try {
      // Firestore 직접 업데이트
      const docRef = doc(db, 'reports', processingReport.id);
      
      const updateData: any = {
        status: newStatus,
        adminId: user.uid,
        updatedAt: Timestamp.now().toMillis(),
      };

      if (actionNote.trim()) {
        updateData.adminNote = actionNote.trim();
      }
      
      if (actionTaken.trim()) {
        updateData.actionTaken = actionTaken.trim();
      }
      
      if (newStatus === 'resolved') {
        updateData.resolvedAt = Timestamp.now().toMillis();
      }

      console.log('Firestore 업데이트 데이터:', updateData);
      
      await updateDoc(docRef, updateData);
      
      console.log('Firestore 업데이트 성공');
      Alert.alert('성공', '신고가 처리되었습니다.');
      closeProcessModal();
      await fetchData();
    } catch (error) {
      console.error('신고 처리 실패:', error);
      Alert.alert('오류', '신고 처리에 실패했습니다: ' + (error as Error).message);
    }
  };

  // 알림 발송
  const handleSendNotification = async () => {
    console.log('알림 발송 시작:', notificationData);
    
    // 입력값 검증
    if (!notificationData.targetUserId || !notificationData.title || !notificationData.message) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }
    
    try {
      const result = await createNotification({
        userId: notificationData.targetUserId.trim(),
        type: notificationData.type,
        title: notificationData.title.trim(),
        message: notificationData.message.trim(),
      });
      
      console.log('알림 발송 성공:', result);
      Alert.alert('성공', '알림이 발송되었습니다.');
      setShowNotificationModal(false);
      setNotificationData({
        targetUserId: '',
        type: 'general',
        title: '',
        message: ''
      });
    } catch (error) {
      console.error('알림 발송 실패:', error);
      Alert.alert('오류', '알림 발송에 실패했습니다.');
    }
  };

  // 모달 관련 함수들
  const openProcessModal = (report: Report) => {
    console.log('모달 열기:', report);
    setProcessingReport(report);
    setNewStatus(report.status);
    setActionNote('');
    setActionTaken('');
    setShowProcessModal(true);
  };

  const closeProcessModal = () => {
    setProcessingReport(null);
    setActionNote('');
    setActionTaken('');
    setNewStatus('pending');
    setShowProcessModal(false);
  };

  const openNotificationModal = (userId: string, isReporter: boolean) => {
    setNotificationData({
      targetUserId: userId,
      type: 'general',
      title: isReporter ? '신고자 알림' : '사용자 알림',
      message: ''
    });
    setShowNotificationModal(true);
  };

  // URL 생성 함수
  const getPostUrl = (report: Report) => {
    if (!report.boardCode) return null;
    
    if (report.targetType === 'post') {
      if (report.schoolId) {
        return `https://inschoolz.com/community/school/${report.schoolId}/${report.boardCode}/${report.targetId}`;
      } else if (report.regions) {
        return `https://inschoolz.com/community/region/${report.regions.sido}/${report.regions.sigungu}/${report.boardCode}/${report.targetId}`;
      } else {
        return `https://inschoolz.com/community/national/${report.boardCode}/${report.targetId}`;
      }
    } else if (report.targetType === 'comment' && report.postId) {
      if (report.schoolId) {
        return `https://inschoolz.com/community/school/${report.schoolId}/${report.boardCode}/${report.postId}`;
      } else if (report.regions) {
        return `https://inschoolz.com/community/region/${report.regions.sido}/${report.regions.sigungu}/${report.boardCode}/${report.postId}`;
      } else {
        return `https://inschoolz.com/community/national/${report.boardCode}/${report.postId}`;
      }
    }
    return null;
  };

  // 원문보기
  const openPost = (report: Report) => {
    const url = getPostUrl(report);
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert('오류', '게시글 링크를 생성할 수 없습니다.');
    }
  };

  // 유틸리티 함수들
  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'pending':
        return { text: '대기중', color: colors.yellow[500] };
      case 'reviewing':
        return { text: '검토중', color: colors.blue[500] };
      case 'resolved':
        return { text: '처리완료', color: colors.primary[500] };
      case 'rejected':
        return { text: '반려', color: colors.red[500] };
      default:
        return { text: status, color: colors.gray[500] };
    }
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

  const getTargetTypeLabel = (type: ReportType) => {
    switch (type) {
      case 'post':
        return '게시글';
      case 'comment':
        return '댓글';
      case 'user':
        return '사용자';
      default:
        return type;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 신고 내용 파싱
  const parsePostContent = (targetContent: string) => {
    try {
      const parsed = JSON.parse(targetContent);
      if (parsed.title && parsed.content) {
        return { title: parsed.title, content: parsed.content };
      }
    } catch (e) {
      if (targetContent.includes('제목: ') && targetContent.includes(', 내용: ')) {
        const titleMatch = targetContent.match(/제목: (.*?), 내용: /);
        const contentMatch = targetContent.match(/, 내용: (.*)/);
        if (titleMatch && contentMatch) {
          return { title: titleMatch[1], content: contentMatch[1] };
        }
      }
    }
    return { title: null, content: targetContent };
  };

  const stripHtmlTags = (html: string) => {
    return html.replace(/<[^>]*>/g, '').trim();
  };

  if (!user || user.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="security" size={48} color={colors.primary[300]} />
          <Text style={styles.accessDeniedText}>접근 권한이 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>신고 관리</Text>
          <TouchableOpacity onPress={onRefresh} disabled={loading} style={styles.refreshButton}>
            <MaterialIcons 
              name="refresh" 
              size={20} 
              color={colors.primary[600]} 
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          사용자 신고를 검토하고 처리할 수 있습니다.
        </Text>
      </View>

      {/* 통계 카드 */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.totalCard]}>
              <MaterialIcons name="analytics" size={20} color={colors.primary[600]} />
              <Text style={[styles.statNumber, { color: colors.primary[600] }]}>{stats.totalReports}</Text>
              <Text style={styles.statLabel}>전체</Text>
            </View>
            <View style={[styles.statCard, styles.pendingCard]}>
              <MaterialIcons name="schedule" size={20} color={colors.yellow[600]} />
              <Text style={[styles.statNumber, { color: colors.yellow[600] }]}>{stats.pendingReports}</Text>
              <Text style={styles.statLabel}>대기중</Text>
            </View>
            <View style={[styles.statCard, styles.resolvedCard]}>
              <MaterialIcons name="check-circle" size={20} color={colors.primary[600]} />
              <Text style={[styles.statNumber, { color: colors.primary[600] }]}>{stats.resolvedReports}</Text>
              <Text style={styles.statLabel}>처리완료</Text>
            </View>
            <View style={[styles.statCard, styles.rejectedCard]}>
              <MaterialIcons name="cancel" size={20} color={colors.red[600]} />
              <Text style={[styles.statNumber, { color: colors.red[600] }]}>{stats.rejectedReports}</Text>
              <Text style={styles.statLabel}>반려</Text>
            </View>
          </View>
        </View>
      )}

      {/* 신고 목록 */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text>로딩 중...</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="inbox" size={48} color={colors.primary[300]} />
            <Text style={styles.emptyText}>조건에 맞는 신고가 없습니다</Text>
          </View>
        ) : (
          <View style={styles.reportsContainer}>
            {reports.map((report) => {
              const statusBadge = getStatusBadge(report.status);
              const postUrl = getPostUrl(report);
              const { title, content } = report.targetContent 
                ? parsePostContent(report.targetContent) 
                : { title: null, content: null };

              return (
                <View key={report.id} style={styles.reportCard}>
                  {/* 신고 헤더 */}
                  <View style={styles.reportHeader}>
                    <View style={styles.reportTitleContainer}>
                      <Text style={styles.reportTitle}>
                        {getTargetTypeLabel(report.targetType)} 신고
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}>
                        <Text style={[styles.statusText, { color: statusBadge.color }]}>
                          {statusBadge.text}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reportMeta}>
                      <Text style={styles.reportMetaText}>
                        신고자: {report.reporterInfo.displayName}
                      </Text>
                      <Text style={styles.reportMetaText}>
                        신고일: {formatDate(toTimestamp(report.createdAt))}
                      </Text>
                    </View>
                  </View>

                  {/* 신고 내용 */}
                  <View style={styles.reportContent}>
                    <Text style={styles.reportReason}>
                      신고 사유: {getReasonLabel(report.reason)}
                      {report.customReason && ` - ${report.customReason}`}
                    </Text>
                    
                    {report.description && (
                      <Text style={styles.reportDescription}>
                        상세 설명: {report.description}
                      </Text>
                    )}

                    {report.targetContent && (
                      <View style={styles.targetContentContainer}>
                        <Text style={styles.targetContentLabel}>신고 대상:</Text>
                        {title ? (
                          <View style={styles.targetContentParsed}>
                            <Text style={styles.targetContentTitle}>
                              제목: {stripHtmlTags(title)}
                            </Text>
                            <Text style={styles.targetContentBody} numberOfLines={2}>
                              내용: {stripHtmlTags(content)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.targetContentBody} numberOfLines={2}>
                            {stripHtmlTags(content)}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* 액션 버튼들 */}
                  <View style={styles.actionButtons}>
                    <View style={styles.primaryActionsRow}>
                      {postUrl && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.primaryButton]}
                          onPress={() => openPost(report)}
                        >
                          <MaterialIcons name="open-in-new" size={16} color="white" />
                          <Text style={styles.primaryButtonText}>원문보기</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.actionButton, styles.processButton]}
                        onPress={() => openProcessModal(report)}
                      >
                        <MaterialIcons name="gavel" size={16} color={colors.red[500]} />
                        <Text style={styles.processButtonText}>처리</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.notificationActionsRow}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={() => openNotificationModal(report.reporterId, true)}
                      >
                        <MaterialIcons name="notifications" size={16} color={colors.primary[600]} />
                        <Text style={styles.secondaryButtonText}>신고자에게 알림</Text>
                      </TouchableOpacity>

                      {report.targetAuthorId && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.secondaryButton]}
                          onPress={() => openNotificationModal(report.targetAuthorId!, false)}
                        >
                          <MaterialIcons name="person" size={16} color={colors.primary[600]} />
                          <Text style={styles.secondaryButtonText}>사용자에게 알림</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 신고 처리 모달 */}
      <Modal
        visible={showProcessModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>신고 처리</Text>
            <TouchableOpacity onPress={closeProcessModal}>
              <MaterialIcons name="close" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {processingReport && (
              <>
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>신고 내용</Text>
                  <Text style={styles.modalText}>
                    {getReasonLabel(processingReport.reason)}
                    {processingReport.customReason && ` - ${processingReport.customReason}`}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>처리 상태</Text>
                  <View style={styles.statusSelector}>
                    {(['pending', 'reviewing', 'resolved', 'rejected'] as ReportStatus[]).map((status) => {
                      const badge = getStatusBadge(status);
                      return (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusOption,
                            newStatus === status && styles.statusOptionSelected
                          ]}
                          onPress={() => setNewStatus(status)}
                        >
                          <Text style={[
                            styles.statusOptionText,
                            newStatus === status && { color: 'white' }
                          ]}>
                            {badge.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>처리 결과</Text>
                  <TextInput
                    style={styles.textArea}
                    value={actionTaken}
                    onChangeText={setActionTaken}
                    placeholder="취한 조치를 입력하세요 (예: 경고, 3일 정지, 게시글 삭제 등)"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>관리자 메모 (선택사항)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={actionNote}
                    onChangeText={setActionNote}
                    placeholder="내부 메모를 입력하세요"
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeProcessModal}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.confirmButton, !newStatus && styles.confirmButtonDisabled]} 
              onPress={handleProcessReport}
              disabled={!newStatus}
            >
              <Text style={styles.confirmButtonText}>처리 완료</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 알림 발송 모달 */}
      <Modal
        visible={showNotificationModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>알림 발송</Text>
            <TouchableOpacity onPress={() => setShowNotificationModal(false)}>
              <MaterialIcons name="close" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>알림 유형</Text>
              <View style={styles.notificationTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    notificationData.type === 'general' && styles.typeOptionSelected
                  ]}
                  onPress={() => setNotificationData(prev => ({ ...prev, type: 'general' }))}
                >
                  <Text style={[
                    styles.typeOptionText,
                    notificationData.type === 'general' && { color: 'white' }
                  ]}>
                    일반 알림
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    notificationData.type === 'warning' && styles.typeOptionSelected
                  ]}
                  onPress={() => setNotificationData(prev => ({ ...prev, type: 'warning' }))}
                >
                  <Text style={[
                    styles.typeOptionText,
                    notificationData.type === 'warning' && { color: 'white' }
                  ]}>
                    경고 알림
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>제목</Text>
              <TextInput
                style={styles.textInput}
                value={notificationData.title}
                onChangeText={(text) => setNotificationData(prev => ({ ...prev, title: text }))}
                placeholder="알림 제목을 입력하세요"
              />
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>메시지</Text>
              <TextInput
                style={styles.textArea}
                value={notificationData.message}
                onChangeText={(text) => setNotificationData(prev => ({ ...prev, message: text }))}
                placeholder="알림 메시지를 입력하세요"
                multiline
                numberOfLines={4}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowNotificationModal(false)}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.confirmButton,
                (!notificationData.title || !notificationData.message) && styles.confirmButtonDisabled
              ]} 
              onPress={handleSendNotification}
              disabled={!notificationData.title || !notificationData.message}
            >
              <Text style={styles.confirmButtonText}>알림 발송</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: colors.primary[600],
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 16,
    color: colors.primary[500],
    fontWeight: '500',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.gray[800],
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  refreshButton: {
    padding: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    textAlign: 'center',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: 'white',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  totalCard: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  pendingCard: {
    backgroundColor: colors.yellow[50],
    borderColor: colors.yellow[200],
  },
  resolvedCard: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  rejectedCard: {
    backgroundColor: colors.red[50],
    borderColor: colors.red[200],
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray[800],
  },
  statLabel: {
    fontSize: 10,
    color: colors.gray[600],
    textAlign: 'center',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  reportsContainer: {
    padding: 16,
    gap: 12,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  reportHeader: {
    marginBottom: 12,
  },
  reportTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reportMeta: {
    gap: 2,
  },
  reportMetaText: {
    fontSize: 12,
    color: colors.gray[600],
  },
  reportContent: {
    gap: 8,
    marginBottom: 12,
  },
  reportReason: {
    fontSize: 14,
    color: colors.gray[700],
    fontWeight: '500',
  },
  reportDescription: {
    fontSize: 14,
    color: colors.gray[600],
  },
  targetContentContainer: {
    gap: 4,
  },
  targetContentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
  },
  targetContentParsed: {
    gap: 2,
  },
  targetContentTitle: {
    fontSize: 12,
    color: colors.gray[600],
  },
  targetContentBody: {
    fontSize: 12,
    color: colors.gray[500],
  },
  actionButtons: {
    gap: 8,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  notificationActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  secondaryButtonText: {
    color: colors.gray[600],
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  processButton: {
    backgroundColor: colors.red[50],
    borderWidth: 1,
    borderColor: colors.red[100],
  },
  processButtonText: {
    color: colors.red[500],
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // 모달 스타일들
  modalContainer: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.gray[800],
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: colors.gray[600],
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: 'white',
  },
  statusOptionSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  statusOptionText: {
    fontSize: 14,
    color: colors.gray[600],
    fontWeight: '500',
  },
  notificationTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: 'white',
    alignItems: 'center',
  },
  typeOptionSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  typeOptionText: {
    fontSize: 14,
    color: colors.gray[600],
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: 'white',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.gray[600],
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  confirmButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
}); 