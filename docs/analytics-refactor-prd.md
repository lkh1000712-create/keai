# KEAI 방문통계 리팩토링 PRD

## 상태: 완료

## 목표
KPFC 프로젝트(F:\pola_homepage\4.20th_ijonghyun_KPFC) 스타일로 방문통계 대시보드 개선

## 완료된 작업

### 1. Airtable API 캐시 구현 (js/analytics.js)
- [x] localStorage 기반 24시간 캐시 (`keai_analytics_cache`)
- [x] 1년치 데이터 한 번에 로드
- [x] 캐시 상태 표시 (캐시됨/실시간)
- [x] 새로고침 버튼으로 캐시 강제 갱신

### 2. 기간탭 UI (dashboard/analytics.html)
- [x] 일간/주간/월간 탭 추가
- [x] 날짜 필터 제거, 기간탭으로 대체
- [x] 기간 변경 시 자동 데이터 재계산

### 3. 차트 높이 확대 (css/dashboard.css)
- [x] 데스크톱: 150px → 300px
- [x] 태블릿(768px): 125px → 250px
- [x] 모바일(480px): 90px → 180px

### 4. 테이블 월별 그룹화 (js/analytics.js)
- [x] 월별 헤더 행 (펼치기/접기)
- [x] 상세 데이터 토글
- [x] 월별 소계 행
- [x] 현재 월 하이라이트

### 5. 인사이트 섹션 (js/analytics.js)
- [x] 자동 추세 분석 (연속 상승/하락)
- [x] 최고 기록 알림
- [x] 전환율 변화 분석
- [x] 체류시간 분석
- [x] 접수 추세 분석
- [x] 페이지 탐색률 분석

### 6. CSS 스타일 업데이트
- [x] 캐시 배지 스타일
- [x] 새로고침 버튼 스타일
- [x] 기간탭 모바일 반응형
- [x] 월별 그룹 헤더 스타일
- [x] 인사이트 카드 스타일

### 7. public 폴더 동기화
- [x] js/analytics.js → public/js/analytics.js
- [x] css/dashboard.css → public/css/dashboard.css
- [x] dashboard/analytics.html → public/dashboard/analytics.html

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `js/analytics.js` | 캐시, 기간탭, 월별 그룹화, 인사이트 로직 |
| `dashboard/analytics.html` | 기간탭 UI, 캐시 상태, 로딩 표시 |
| `css/dashboard.css` | 차트 높이 증가, 월별 그룹 스타일 |
| `public/js/analytics.js` | 동기화됨 |
| `public/dashboard/analytics.html` | 동기화됨 |
| `public/css/dashboard.css` | 동기화됨 |

## 데이터 흐름

```
1. 페이지 로드
   ↓
2. localStorage 캐시 확인
   ↓ (캐시 있고 24시간 이내)
   ├─→ 캐시 데이터 사용 → 대시보드 렌더링
   ↓ (캐시 없거나 만료)
3. API 호출 (/api/analytics?startDate=...&endDate=...)
   ↓
4. 1년치 데이터 수신
   ↓
5. 데이터 가공 (일간/주간/월간)
   ↓
6. localStorage에 캐시 저장
   ↓
7. 대시보드 렌더링
```

## 테스트 항목

- [ ] 첫 방문 시 API 호출 확인
- [ ] 새로고침 시 캐시 사용 확인
- [ ] 24시간 후 캐시 만료 확인
- [ ] 기간탭 전환 작동 확인
- [ ] 월별 그룹 펼치기/접기 확인
- [ ] 인사이트 자동 생성 확인
- [ ] 모바일 반응형 확인

## 배포 명령어

```bash
# Git 푸시
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_lkh" git push origin master

# Vercel 배포
vercel --yes --token 1xZoE0DnlfFN9CbtfEs4v2N7 --prod
```
