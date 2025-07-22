import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 약관 미리보기 내용
const TERMS_PREVIEW = {
  terms: `제1조 (목적)
이 약관은 온마인드랩(사업자등록번호: 166-22-02407)이 운영하는 인스쿨즈(이하 "서비스")의 이용과 관련하여 회사와 이용자간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 온마인드랩이 제공하는 학교 커뮤니티 플랫폼 "인스쿨즈"를 의미합니다.
2. "이용자"란 이 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.

제3조 (서비스의 제공)
회사는 다음과 같은 서비스를 제공합니다:
- 학교별 커뮤니티 서비스
- 지역별 커뮤니티 서비스  
- 게시판 및 댓글 서비스`,
  
  privacy: `제1조 (개인정보의 처리 목적)
인스쿨즈는 다음의 목적을 위하여 개인정보를 처리합니다:
1. 회원가입 및 관리
2. 학교 커뮤니티 서비스 제공
3. 학교 인증 서비스

제2조 (처리하는 개인정보 항목)
필수항목: 이메일, 비밀번호, 사용자명(아이디), 실명, 학교정보, 지역정보
선택항목: 성별, 생년월일, 휴대폰번호

제3조 (개인정보 보호책임자)
성명: 신선웅 (대표)
연락처: 010-6711-7933, pobredward@gmail.com`,
  
  location: `제1조 (목적)
본 약관은 인스쿨즈에서 제공하는 위치기반서비스에 대해 회사와 개인위치정보주체간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (서비스 내용)
회사는 다음과 같은 위치기반서비스를 제공합니다:
- 지역별 커뮤니티 서비스
- 주변 학교 정보 제공
- 위치 기반 맞춤 콘텐츠
- 지역별 랭킹 서비스`
};

export default function Step5Terms({ formData, updateForm, onSubmit, prevStep, isSubmitting }: {
  formData: any;
  updateForm: (data: Partial<any>) => void;
  onSubmit: () => void;
  prevStep: () => void;
  isSubmitting: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const handleAgree = (key: string) => {
    updateForm({ [key]: !formData[key] });
  };

  const handleAllAgree = () => {
    const allAgreed = formData.termsAgreed && formData.privacyAgreed && formData.locationAgreed && formData.marketingAgreed;
    updateForm({
      termsAgreed: !allAgreed,
      privacyAgreed: !allAgreed,
      locationAgreed: !allAgreed,
      marketingAgreed: !allAgreed,
    });
  };

  const showTermsPreview = (type: 'terms' | 'privacy' | 'location', title: string) => {
    Alert.alert(
      title,
      TERMS_PREVIEW[type],
      [
        { text: '전체보기', onPress: () => {
          // 실제 구현에서는 웹뷰나 외부 브라우저로 연결
          console.log(`Opening full ${type} terms`);
        }},
        { text: '닫기', style: 'cancel' }
      ],
      { cancelable: true }
    );
  };

  const handleSubmit = () => {
    if (!formData.termsAgreed || !formData.privacyAgreed || !formData.locationAgreed) {
      setError('필수 약관에 모두 동의해야 합니다.');
      return;
    }
    setError(null);
    onSubmit();
  };

  const allRequired = formData.termsAgreed && formData.privacyAgreed && formData.locationAgreed;
  const allAgreed = allRequired && formData.marketingAgreed;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 단계 표시 */}
      <Text style={styles.stepIndicator}>5 / 5</Text>
      
      {/* 제목 */}
      <View style={styles.header}>
        <Ionicons name="document-text" size={24} color="#4F46E5" />
        <Text style={styles.title}>약관 동의</Text>
      </View>
      
      {/* 중요 안내사항 */}
      <View style={styles.infoBox}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle" size={20} color="#2563EB" />
          <Text style={styles.infoTitle}>📋 서비스 이용을 위한 필수 약관 동의</Text>
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoText}>• 서비스 이용을 위해 아래 필수 약관에 모두 동의해주세요.</Text>
          <Text style={styles.infoText}>• 각 약관의 상세 내용은 '미리보기' 버튼을 통해 확인하실 수 있습니다.</Text>
          <Text style={styles.infoText}>• 필수 약관에 동의하지 않을 경우 서비스 이용이 제한됩니다.</Text>
          <Text style={styles.infoText}>• 만 14세 미만은 법정대리인의 동의가 필요합니다.</Text>
        </View>
      </View>

      {/* 전체 동의 */}
      <TouchableOpacity style={styles.allAgreeBox} onPress={handleAllAgree}>
        <View style={styles.allAgreeRow}>
          <View style={[styles.checkbox, allAgreed && styles.checked]}>
            {allAgreed && <Ionicons name="checkmark" size={16} color="white" />}
          </View>
          <Text style={styles.allAgreeText}>✅ 전체 약관에 동의합니다 (필수 + 선택)</Text>
        </View>
        <Text style={styles.allAgreeSubtext}>아래 모든 약관을 한 번에 동의하시려면 체크해주세요.</Text>
      </TouchableOpacity>

      {/* 구분선 */}
      <View style={styles.separator} />

      {/* 필수 약관 섹션 */}
      <View style={styles.sectionHeader}>
        <View style={styles.requiredBadge}>
          <Text style={styles.requiredBadgeText}>필수</Text>
        </View>
        <Text style={styles.sectionTitle}>반드시 동의해야 하는 약관</Text>
      </View>

      {/* 서비스 이용약관 */}
      <View style={styles.termCard}>
        <View style={styles.termHeader}>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('termsAgreed')}>
            <View style={[styles.checkbox, formData.termsAgreed && styles.checked]}>
              {formData.termsAgreed && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <View style={styles.termLabelContainer}>
              <Ionicons name="document-text" size={16} color="#2563EB" />
              <Text style={styles.termLabel}>[필수] 서비스 이용약관</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.previewButton}
            onPress={() => showTermsPreview('terms', '서비스 이용약관')}
          >
            <Ionicons name="eye" size={14} color="#6B7280" />
            <Text style={styles.previewButtonText}>미리보기</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.termDescription}>
          서비스 이용 규칙, 회원의 권리와 의무, 서비스 제공 범위 등에 대한 기본 약관입니다.
        </Text>
      </View>

      {/* 개인정보 처리방침 */}
      <View style={styles.termCard}>
        <View style={styles.termHeader}>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('privacyAgreed')}>
            <View style={[styles.checkbox, formData.privacyAgreed && styles.checked]}>
              {formData.privacyAgreed && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <View style={styles.termLabelContainer}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={styles.termLabel}>[필수] 개인정보 처리방침</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.previewButton}
            onPress={() => showTermsPreview('privacy', '개인정보 처리방침')}
          >
            <Ionicons name="eye" size={14} color="#6B7280" />
            <Text style={styles.previewButtonText}>미리보기</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.termDescription}>
          개인정보 수집·이용 목적, 수집 항목, 보유기간, 제3자 제공 등에 대한 처리방침입니다.
        </Text>
      </View>

      {/* 위치기반 서비스 이용약관 */}
      <View style={styles.termCard}>
        <View style={styles.termHeader}>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('locationAgreed')}>
            <View style={[styles.checkbox, formData.locationAgreed && styles.checked]}>
              {formData.locationAgreed && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <View style={styles.termLabelContainer}>
              <Ionicons name="location" size={16} color="#EA580C" />
              <Text style={styles.termLabel}>[필수] 위치기반 서비스 이용약관</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.previewButton}
            onPress={() => showTermsPreview('location', '위치기반 서비스 이용약관')}
          >
            <Ionicons name="eye" size={14} color="#6B7280" />
            <Text style={styles.previewButtonText}>미리보기</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.termDescription}>
          지역별 커뮤니티, 주변 학교 정보 등 위치 기반 서비스 제공을 위한 약관입니다.
        </Text>
      </View>

      {/* 구분선 */}
      <View style={styles.separator} />

      {/* 선택 약관 섹션 */}
      <View style={styles.sectionHeader}>
        <View style={styles.optionalBadge}>
          <Text style={styles.optionalBadgeText}>선택</Text>
        </View>
        <Text style={styles.sectionTitle}>선택적으로 동의하는 약관</Text>
      </View>

      {/* 마케팅 정보 수신 동의 */}
      <View style={[styles.termCard, styles.optionalTermCard]}>
        <TouchableOpacity style={styles.checkboxRow} onPress={() => handleAgree('marketingAgreed')}>
          <View style={[styles.checkbox, formData.marketingAgreed && styles.checked]}>
            {formData.marketingAgreed && <Ionicons name="checkmark" size={16} color="white" />}
          </View>
          <View style={styles.termLabelContainer}>
            <Ionicons name="mail" size={16} color="#7C3AED" />
            <Text style={styles.termLabel}>[선택] 마케팅 정보 수신 동의</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.termDescription}>
          새로운 소식, 이벤트 정보, 맞춤형 콘텐츠 추천 등을 이메일과 알림으로 받아보실 수 있습니다. 
          언제든지 설정에서 변경 가능합니다.
        </Text>
      </View>

      {/* 약관 관련 추가 정보 */}
      <View style={styles.additionalInfo}>
        <Text style={styles.additionalInfoTitle}>📌 약관 관련 안내사항</Text>
        <Text style={styles.additionalInfoText}>• 약관은 서비스 개선을 위해 변경될 수 있으며, 변경 시 7일 전 공지됩니다.</Text>
        <Text style={styles.additionalInfoText}>• 개인정보 처리방침은 개인정보보호법에 따라 작성되었습니다.</Text>
        <Text style={styles.additionalInfoText}>• 위치정보는 서비스 제공 목적으로만 사용되며, 1년 후 자동 삭제됩니다.</Text>
        <Text style={styles.additionalInfoText}>• 마케팅 수신 동의는 언제든지 철회할 수 있습니다.</Text>
        <Text style={styles.additionalInfoText}>• 문의사항: 010-6711-7933, pobredward@gmail.com</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* 버튼 영역 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={prevStep}>
          <Text style={styles.backButtonText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.submitButton, !allRequired && styles.submitButtonDisabled]} 
          onPress={handleSubmit} 
          disabled={isSubmitting || !allRequired}
        >
          <Text style={[styles.submitButtonText, !allRequired && styles.submitButtonTextDisabled]}>
            {isSubmitting ? '가입 처리 중...' : '가입하기'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 여백 */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  stepIndicator: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 8,
  },
  infoBox: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 6,
  },
  infoContent: {
    marginLeft: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#1d4ed8',
    marginBottom: 2,
  },
     allAgreeBox: {
     backgroundColor: '#f0fdf4',
     borderWidth: 2,
     borderColor: '#86efac',
     borderRadius: 12,
     padding: 16,
     marginBottom: 20,
   },
  allAgreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  allAgreeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#065f46',
    marginLeft: 12,
    flex: 1,
  },
  allAgreeSubtext: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 36,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  requiredBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  requiredBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  optionalBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  optionalBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  termCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionalTermCard: {
    backgroundColor: '#f9fafb',
  },
  termHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  termLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    flex: 1,
  },
  termLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 6,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: 'white',
  },
  previewButtonText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  termDescription: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 32,
    lineHeight: 16,
  },
  additionalInfo: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  additionalInfoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  additionalInfoText: {
    fontSize: 10,
    color: '#6b7280',
    lineHeight: 14,
    marginBottom: 2,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButtonTextDisabled: {
    color: '#9ca3af',
  },
  bottomSpacing: {
    height: 40,
  },
}); 