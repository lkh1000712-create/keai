# TDD: KEAI 방문통계 페이지 KPFC 스타일 리팩토링

## 1. 기술 스택

### 1.1 Frontend
- HTML5
- CSS3 (CSS Variables)
- Vanilla JavaScript
- Chart.js (차트 라이브러리)

### 1.2 Backend
- Vercel Serverless Functions (`/api/analytics`)
- Airtable (데이터 저장)
- Cron 작업 (`/api/cron-analytics`)

---

## 2. 파일 구조

```
33.leeganghee/
├── dashboard/
│   └── analytics.html      # KPFC 구조로 재작성
├── js/
│   └── analytics.js        # KPFC 로직으로 재작성
├── css/
│   └── dashboard.css       # 스타일 추가
├── api/
│   ├── analytics.js        # 기존 유지
│   └── cron-analytics.js   # 기존 유지
├── public/
│   ├── dashboard/analytics.html
│   ├── js/analytics.js
│   └── css/dashboard.css
└── docs/
    ├── analytics-refactoring-prd.md
    └── analytics-refactoring-tdd.md
```

---

## 3. 상세 설계

### 3.1 analytics.html 구조

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <!-- Meta, CSS, Chart.js -->
</head>
<body>
  <div class="dashboard-container">
    <!-- 사이드바 (KEAI 컴포넌트 로드) -->
    <aside class="sidebar"></aside>

    <!-- 메인 콘텐츠 -->
    <main class="main-content">
      <!-- 헤더 (KEAI 컴포넌트 로드) -->
      <header class="dashboard-header"></header>

      <!-- 1. 통합 기간 필터 -->
      <div class="unified-filter-section">
        <div class="filter-header">조회 기간 설정</div>
        <div class="filter-controls">
          <div class="quick-period-btns">
            <button data-days="1">오늘</button>
            <button data-days="7" class="active">7일</button>
            <button data-days="14">14일</button>
            <button data-days="30">30일</button>
            <button data-days="90">90일</button>
          </div>
          <div class="date-range-inputs">
            <input type="date" id="startDate">
            <input type="date" id="endDate">
            <button onclick="applyDateFilter()">적용</button>
          </div>
          <button class="refresh-btn" onclick="refreshData()">새로고침</button>
        </div>
        <div class="current-period-display" id="period-display"></div>
      </div>

      <!-- 2. 통계 카드 -->
      <div class="stats-grid">
        <div class="stat-card">방문자</div>
        <div class="stat-card">페이지뷰</div>
        <div class="stat-card">평균 체류시간</div>
        <div class="stat-card">이탈률</div>
      </div>

      <!-- 3. 일별 방문 추이 차트 -->
      <div class="charts-grid">
        <div class="chart-card chart-card-wide">
          <canvas id="trendChart"></canvas>
        </div>
      </div>

      <!-- 4. 분석 그리드 -->
      <div class="charts-grid">
        <div class="chart-card">트래픽 소스</div>
        <div class="chart-card">유입 경로</div>
        <div class="chart-card">기기별 사용자</div>
        <div class="chart-card">인기 페이지</div>
        <div class="chart-card">방문 지역</div>
      </div>

      <!-- 5. 히스토리 섹션 -->
      <div class="section-divider">
        <!-- 기간 비교 카드 -->
        <div class="compare-grid">
          <div class="compare-card">오늘 vs 어제</div>
          <div class="compare-card">이번 주 vs 지난 주</div>
          <div class="compare-card">이번 달 vs 지난 달</div>
        </div>

        <!-- 장기 추이 차트 -->
        <div class="cumulative-chart-card">
          <canvas id="historyChart"></canvas>
        </div>

        <!-- 일별 상세 테이블 -->
        <div class="history-table-wrapper">
          <table class="history-table">
            <thead>...</thead>
            <tbody id="history-table-body"></tbody>
          </table>
          <div class="pagination-container"></div>
        </div>

        <!-- 분석 평가 -->
        <div class="analysis-summary" id="analysis-summary"></div>
      </div>
    </main>
  </div>

  <!-- 하단 메뉴바 (모바일) -->
  <nav class="bottom-nav"></nav>

  <script src="../js/config.js"></script>
  <script src="../js/components.js"></script>
  <script>/* 인라인 스크립트: KEAI API 연동 로직 */</script>
</body>
</html>
```

### 3.2 JavaScript 로직

#### 3.2.1 전역 변수
```javascript
const ANALYTICS_API_URL = '/api/analytics';

let filterDays = 7;
let filterStartDate = null;
let filterEndDate = null;
let trendChart = null;
let historyChart = null;
let analyticsData = null;

// 페이지네이션
let currentPage = 1;
let pageSize = 20;
let allHistoryData = [];
```

#### 3.2.2 주요 함수

| 함수명 | 설명 |
|--------|------|
| `initUnifiedFilter()` | 통합 필터 초기화 |
| `initDateInputs()` | 날짜 입력 초기화 |
| `applyDateFilter()` | 날짜 필터 적용 |
| `loadAllDataWithFilter()` | 필터 적용 데이터 로드 |
| `loadAnalyticsDataWithFilter()` | 분석 데이터 로드 |
| `loadHistoryDataWithFilter()` | 히스토리 데이터 로드 |
| `loadCompareData()` | 비교 데이터 로드 |
| `renderDashboard(data)` | 대시보드 렌더링 |
| `renderOverview(overview)` | 통계 카드 렌더링 |
| `renderTrendChart(trendData)` | 추이 차트 렌더링 |
| `renderTrafficSources(trafficData)` | 트래픽 소스 렌더링 |
| `renderDevices(devicesData)` | 기기별 렌더링 |
| `renderTopPages(pagesData)` | 인기 페이지 렌더링 |
| `renderGeography(geoData)` | 방문 지역 렌더링 |
| `renderReferrers(referrersData)` | 유입 경로 렌더링 |
| `renderHistoryTable(data)` | 히스토리 테이블 렌더링 |
| `renderHistoryChart(data)` | 히스토리 차트 렌더링 |
| `renderCompareCard(elementId, data)` | 비교 카드 렌더링 |
| `generateAnalysisSummary(data)` | 분석 평가 생성 |
| `goToPage(page)` | 페이지 이동 |
| `changePageSize(newSize)` | 페이지 크기 변경 |

### 3.3 API 응답 형식 (기존 KEAI 유지)

```javascript
// GET /api/analytics
{
  "success": true,
  "cached": true,
  "lastUpdated": "2025-12-29T01:00:00Z",
  "data": [
    {
      "date": "2025-12-28",
      "visitors": 150,
      "pageviews": 450,
      "avg_duration": 185,
      "bounce_rate": 0.45,
      "leads": 5,
      "sourceOrganic": 50,
      "sourceDirect": 40,
      "sourceReferral": 30,
      "sourceSocial": 20,
      "sourcePaid": 5,
      "sourceOther": 5,
      "deviceDesktop": 80,
      "deviceMobile": 60,
      "deviceTablet": 10,
      "topPages": "[{\"path\":\"/\",\"views\":100}]",
      "topCountries": "[{\"country\":\"KR\",\"users\":140}]",
      "topReferrers": "[{\"source\":\"google\",\"sessions\":50}]"
    }
  ]
}
```

### 3.4 CSS 스타일 (추가)

```css
/* 통합 기간 필터 */
.unified-filter-section { ... }
.filter-header { ... }
.filter-controls { ... }
.quick-period-btns { ... }
.quick-btn { ... }
.quick-btn.active { ... }
.date-range-inputs { ... }
.date-input { ... }
.apply-btn { ... }
.current-period-display { ... }

/* 비교 카드 */
.compare-grid { ... }
.compare-card { ... }
.compare-row { ... }
.compare-change.positive { ... }
.compare-change.negative { ... }

/* 히스토리 테이블 */
.history-table-wrapper { ... }
.history-table { ... }
.month-group-header { ... }
.month-detail-row { ... }

/* 페이지네이션 */
.pagination-container { ... }
.pagination-controls { ... }
.pagination-btn { ... }
.pagination-btn.active { ... }

/* 분석 평가 */
.analysis-summary { ... }
.analysis-item { ... }
.analysis-item.positive { ... }
.analysis-item.negative { ... }
.analysis-item.neutral { ... }
```

---

## 4. 데이터 흐름

```
[사용자]
    ↓ 기간 필터 선택
[analytics.html]
    ↓ loadAllDataWithFilter()
[/api/analytics]
    ↓ Airtable 조회
[Airtable Analytics 테이블]
    ↓ 캐시된 데이터 반환
[analytics.html]
    ↓ renderDashboard()
[화면 렌더링]
```

---

## 5. 구현 순서

1. **analytics.html 재작성**
   - KPFC 구조 복사
   - KEAI 컴포넌트 로드 유지 (사이드바, 헤더)
   - 인라인 스크립트: KEAI API 연동 로직

2. **CSS 스타일 추가**
   - dashboard.css에 KPFC 스타일 추가
   - 브랜드 색상 #0066CC 유지

3. **public 폴더 동기화**
   - cp dashboard/analytics.html public/dashboard/
   - cp css/dashboard.css public/css/
   - cp js/analytics.js public/js/

4. **테스트**
   - 로컬 서버 실행
   - 기간 필터 동작 확인
   - 데이터 표시 확인
   - 모바일 반응형 확인

---

## 6. 차이점 대응

### 6.1 API 응답 형식 차이

| KPFC | KEAI |
|------|------|
| `overview.visitors.value` | `data[].visitors` |
| `trend.trend[]` | `data[]` |
| `traffic.sources[]` | `data[].sourceOrganic` 등 파싱 필요 |

### 6.2 KEAI API 응답 → KPFC 형식 변환

```javascript
function transformDataForDisplay(keaiData) {
  const data = keaiData.data || [];
  const latest = data[0] || {};
  const prev = data[1] || {};

  return {
    overview: {
      visitors: {
        value: latest.visitors || 0,
        change: calculateChange(latest.visitors, prev.visitors)
      },
      pageviews: {
        value: latest.pageviews || 0,
        change: calculateChange(latest.pageviews, prev.pageviews)
      },
      duration: {
        value: formatDuration(latest.avg_duration || 0),
        change: calculateChange(latest.avg_duration, prev.avg_duration)
      },
      bounceRate: {
        value: Math.round((latest.bounce_rate || 0) * 100),
        change: calculateChange(latest.bounce_rate, prev.bounce_rate)
      }
    },
    trend: {
      trend: data.map(d => ({
        date: d.date.replace(/-/g, ''),
        visitors: d.visitors,
        pageviews: d.pageviews
      }))
    },
    traffic: {
      sources: [
        { source: 'Organic Search', sessions: latest.sourceOrganic || 0 },
        { source: 'Direct', sessions: latest.sourceDirect || 0 },
        { source: 'Referral', sessions: latest.sourceReferral || 0 },
        { source: 'Social', sessions: latest.sourceSocial || 0 },
        { source: 'Paid Search', sessions: latest.sourcePaid || 0 }
      ]
    },
    devices: {
      devices: [
        { device: 'desktop', users: latest.deviceDesktop || 0 },
        { device: 'mobile', users: latest.deviceMobile || 0 },
        { device: 'tablet', users: latest.deviceTablet || 0 }
      ]
    },
    pages: {
      pages: JSON.parse(latest.topPages || '[]')
    },
    geography: {
      regions: JSON.parse(latest.topCountries || '[]').map(c => ({
        city: c.country,
        users: c.users
      }))
    },
    referrers: {
      referrers: JSON.parse(latest.topReferrers || '[]')
    }
  };
}
```

---

## 7. 리스크 및 대응

| 리스크 | 대응 방안 |
|--------|----------|
| API 응답 형식 불일치 | 데이터 변환 함수 구현 |
| 추가 통계 필드 누락 | Airtable 필드 확인 후 추가 |
| 모바일 레이아웃 깨짐 | KPFC 모바일 CSS 동일 적용 |
