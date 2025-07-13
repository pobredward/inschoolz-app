# Firebase Firestore 인덱스 설정 가이드

## 📋 개요
Inschoolz 프로젝트에서 학교 관리 기능을 위해 Firebase Firestore 복합 인덱스가 필요합니다.

## 🔧 인덱스 배포 방법

### 1. Firebase CLI 설치 (처음 사용하는 경우)
```bash
npm install -g firebase-tools
```

### 2. Firebase 로그인
```bash
firebase login
```

### 3. 프로젝트 디렉토리에서 Firebase 초기화 (처음 사용하는 경우)
```bash
firebase init firestore
```

### 4. 인덱스 배포
```bash
firebase deploy --only firestore:indexes
```

## 📊 생성되는 인덱스 목록

### schools 컬렉션 인덱스
1. **주요 정렬 인덱스**: `favoriteCount (desc)` → `memberCount (desc)` → `__name__ (desc)`
2. **대체 정렬 인덱스**: `memberCount (desc)` → `favoriteCount (desc)` → `__name__ (desc)`
3. **멤버 수 인덱스**: `memberCount (asc)` → `__name__ (asc)`
4. **즐겨찾기 수 인덱스**: `favoriteCount (asc)` → `__name__ (asc)`
5. **🆕 학교명 검색 인덱스**: `KOR_NAME (asc/desc)` - 학교명 기반 검색 최적화

## 🚀 성능 개선 효과

### 기존 방식 (비효율적)
- **학교 목록**: 2개의 복잡한 쿼리 병렬 실행, 클라이언트 측 중복 제거 및 정렬
- **학교 검색**: 모든 학교 문서(10,000+) 읽기 후 클라이언트 측 필터링
- 높은 읽기 비용 및 지연시간

### 개선된 방식 (효율적)
- **학교 목록**: 단일 인덱스 기반 쿼리, Firestore 서버 측 정렬
- **🆕 학교 검색**: Firebase range query로 검색어로 시작하는 학교만 조회 (최대 100개)
- 빠른 응답 시간 및 낮은 비용

### 검색 최적화 상세
- **기존**: "가락" 검색 시 → 10,000+ 문서 읽기 → 클라이언트에서 학교명/주소 모두 검색
- **🆕 개선**: "가락" 검색 시 → "가락"으로 시작하는 학교명만 Firebase에서 직접 조회
- **결과**: 읽기 횟수 대폭 감소, 학교명만 검색으로 정확도 향상

## 📝 인덱스 상태 확인

Firebase Console → Firestore → 인덱스 탭에서 확인:
- 🟢 **성공**: 인덱스가 성공적으로 생성됨
- 🟡 **생성 중**: 인덱스 생성이 진행 중 (몇 분 소요)
- 🔴 **오류**: 인덱스 생성 실패

## ⚠️ 주의사항

1. **인덱스 생성 시간**: 데이터량에 따라 몇 분에서 몇 시간 소요될 수 있습니다.
2. **비용**: 인덱스는 추가 저장 공간을 사용하므로 약간의 비용이 발생합니다.
3. **쿼리 최적화**: 인덱스가 생성된 후에만 최적화된 성능을 경험할 수 있습니다.

## 🔍 트러블슈팅

### 인덱스 생성 실패 시
```bash
# 기존 인덱스 상태 확인
firebase firestore:indexes

# 특정 인덱스 삭제 (필요시)
firebase firestore:indexes:delete

# 다시 배포
firebase deploy --only firestore:indexes
```

### 권한 오류 시
```bash
# 프로젝트 설정 확인
firebase projects:list

# 올바른 프로젝트로 설정
firebase use [PROJECT_ID]
```

## 📞 지원

인덱스 설정 중 문제가 발생하면:
1. Firebase Console에서 인덱스 상태 확인
2. Firebase CLI 로그 확인: `firebase logs`
3. 개발팀에 문의

---
*이 문서는 Inschoolz 프로젝트의 Firebase 인덱스 설정을 위한 가이드입니다.* 