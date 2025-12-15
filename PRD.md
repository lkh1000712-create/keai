# PRD: 한국기업심사원 (KEAI) 홈페이지

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 한국기업심사원 홈페이지 |
| 브랜드명 | KEAI (Korea Enterprise Assessment Institute) |
| GitHub | `lkh1000712-create/keai` |
| 로컬 경로 | `F:\bas_homepage\33.leeganghee` |
| 작성일 | 2025-12-12 |

---

## 목표

아임웹에서 개발된 기존 사이트를 **자체 개발 구조로 전환**하여 독립적인 웹사이트 구축

---

## 요구사항

### 1. 기술 전환
- **AS-IS**: 아임웹 기반 사이트
- **TO-BE**: 순수 HTML/CSS/JS 자체 개발 구조

### 2. 디자인
- 기존 디자인 레이아웃 **그대로 유지**
- **색상**: 코퍼레이트 블루 (옵션 6)
- 폰트, 구조 등 동일하게 구현

### 컬러 팔레트
```css
/* Primary 그라데이션 */
--gradient-primary: linear-gradient(135deg, #0F4C81, #1A73E8);

/* 단색 */
--color-primary: #0F4C81;
--color-primary-light: #1565C0;
--color-primary-bright: #1A73E8;

/* 배경 */
--color-bg-light: #E3F2FD;
--color-bg-white: #FFFFFF;

/* 텍스트 */
--color-text-dark: #0D47A1;
--color-text-body: #212529;
--color-text-muted: #495057;
```

### 3. 콘텐츠
- 내용을 **한국기업심사원** 브랜드에 맞게 구성
- BAS 홈페이지 규칙 적용 (금지 표현, 면책 문구 등)

### 4. 배포
- **Vercel** 플랫폼 사용
- GitHub 레포 연동 자동 배포

---

## 개발 단계

### Phase 1: 로컬 HTML 구성
- [ ] 기존 아임웹 사이트 구조 분석
- [ ] HTML/CSS/JS 변환
- [ ] 섹션별 콘텐츠 구성
- [ ] 반응형 디자인 확인

### Phase 2: 콘텐츠 적용
- [ ] 한국기업심사원 브랜드 정보 반영
- [ ] BAS 규칙 준수 (금지 표현 제거)
- [ ] 면책 문구 삽입
- [ ] 이미지/아이콘 교체

### Phase 3: 기능 구현
- [ ] 문의 폼 연동 (Cloudflare Workers)
- [ ] Airtable 연동
- [ ] 텔레그램 알림

### 폼 설정
- **온라인마케팅 폼**: 기존 Worker 설정 유지
- **출처**: "한국기업심사원"으로 변경
- **입력폼 왼쪽**: 브랜드정보 맞춤 (KEAI)

### Phase 4: Vercel 배포
- [ ] Vercel 프로젝트 생성
- [ ] GitHub 레포 연결
- [ ] 도메인 연결 (필요시)
- [ ] 빌드 테스트

### Phase 5: 최적화
- [ ] 성능 최적화 (이미지, 코드)
- [ ] SEO 설정
- [ ] 크로스 브라우저 테스트
- [ ] 모바일 테스트

---

## 페이지 구조

### 공통 컴포넌트
- **헤더**: 모든 페이지 동일 (active 메뉴만 페이지별 다름)
- **푸터**: 모든 페이지 동일
- **입력폼**: 문의/상담 폼 공통화

### 이미지 관리 (Admin)
- **저장소**: Cloudflare R2
- **기능**: 각 페이지별 이미지 교체 가능
- **Admin 페이지**: 이미지 업로드/교체 UI 구현
- **연동**: Workers API로 R2 연결
- **최적화**: 업로드 시 WebP 자동 변환/압축

### 파일 구성

```
/ (root)
├── index.html          # 메인 - 헤더 + 콘텐츠 + 푸터 포함
├── company.html        # 회사소개 - 콘텐츠만 (헤더/푸터 제외)
├── process.html        # 진행과정 - 콘텐츠만
├── fund.html           # 자금상담 - 콘텐츠만
├── pro.html            # 전문서비스 - 콘텐츠만
├── mkt.html            # 온라인마케팅 - 콘텐츠만
├── components/
│   ├── header.html     # 공통 헤더
│   └── footer.html     # 공통 푸터
├── css/
│   └── style.css
├── js/
│   └── main.js         # 헤더/푸터 로드 + active 메뉴 처리
└── assets/
    └── images/
```

### 헤더 Active 처리
- JavaScript로 현재 페이지 URL 감지
- 해당 메뉴에 active 클래스 자동 부여

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Styling | Tailwind CSS (또는 순수 CSS) |
| Backend | Cloudflare Workers |
| Database | Airtable |
| Email | Mailgun |
| Hosting | Vercel |
| Version Control | GitHub |

---

## 참고 규칙

### BAS 금지 표현
- 성공사례, 성공금액, 성공률
- 대출알선, 대출소개, 서류대행
- 기업평가, 기업분석, 기업진단
- 정책자금, 정부정책자금
- 승인, 승인률

### BAS 권장 표현
- 자금확보, 기업자금확보
- 역량파악, 파악, 안내, 코칭
- 확보 가능성
- 무료심사

### 필수 면책 문구
```
※ 정부정책자금 대행서비스가 아닙니다. 기업대출알선 서비스가 아닙니다.
```

---

---

## Vercel 프로덕션 배포 계획

### 배포 구성
```
프로젝트 구조:
├── index.html (홈)
├── company.html
├── process.html
├── fund.html
├── pro.html
├── mkt.html
├── post.html (게시글 상세 - 신규)
├── css/
│   └── styles.css
├── js/
│   ├── main.js
│   └── config.js
├── og/ (OG 이미지)
│   ├── og-home.png
│   ├── og-company.png
│   └── ...
├── dashboard/ (관리자)
│   ├── index.html
│   └── images.html
└── api/ (Vercel Serverless Functions)
    ├── board.js
    └── images.js
```

### vercel.json 설정
```json
{
  "version": 2,
  "builds": [
    { "src": "*.html", "use": "@vercel/static" },
    { "src": "css/**", "use": "@vercel/static" },
    { "src": "js/**", "use": "@vercel/static" },
    { "src": "api/**/*.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/$1" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### 환경 변수 (Vercel Dashboard)
```env
AIRTABLE_TOKEN=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
TELEGRAM_BOT_TOKEN=XXXXXXXXXX:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TELEGRAM_CHAT_ID=-100XXXXXXXXXX
ADMIN_PASSWORD=secure_password_here
```

---

## SEO 최적화 계획

### 타겟 키워드
| 우선순위 | 키워드 | 적용 페이지 |
|----------|--------|------------|
| 1 | 정부정책자금 | 홈, 자금상담, 진행과정 |
| 2 | 정부지원자금 | 홈, 자금상담 |
| 3 | 경영컨설팅 | 홈, 회사소개 |
| 4 | 자금확보 컨설팅 | 자금상담, 진행과정 |
| 5 | 중소기업 정책자금 | 자금상담 |
| 6 | 창업자금 지원 | 자금상담 |

### 페이지별 메타 태그

#### index.html (홈)
```html
<title>한국기업심사원 KEAI | 정부정책자금 전문 컨설팅</title>
<meta name="description" content="한국기업심사원 KEAI - 정부정책자금, 정부지원자금 확보를 위한 전문 경영컨설팅. 기업심사 전문가의 1:1 맞춤 상담으로 자금확보 가능성을 높여드립니다.">
<meta name="keywords" content="정부정책자금, 정부지원자금, 경영컨설팅, 자금확보, 중소기업 지원, 창업자금, 한국기업심사원, KEAI">
```

#### company.html (회사소개)
```html
<title>회사소개 | 한국기업심사원 KEAI - 자금확보 전문 경영컨설팅</title>
<meta name="description" content="한국기업심사원 KEAI 회사소개 - 기업심사 전문가가 직접 운영하는 정부정책자금 경영컨설팅 기업. 체계적인 분석과 맞춤 전략으로 자금확보를 지원합니다.">
```

#### process.html (진행과정)
```html
<title>진행과정 | 한국기업심사원 KEAI - 정부지원자금 신청 절차</title>
<meta name="description" content="정부정책자금 신청 진행과정 안내 - 역량파악부터 사후관리까지 체계적인 5단계 프로세스. 전문 경영컨설팅과 함께하는 자금확보 여정.">
```

#### fund.html (자금상담)
```html
<title>자금상담 | 한국기업심사원 KEAI - 정부정책자금 무료심사</title>
<meta name="description" content="정부정책자금, 정부지원자금 무료심사 신청. 운전자금, 시설자금, 창업자금 등 맞춤형 경영컨설팅. 기업심사 전문가의 1:1 상담.">
```

### 구조화된 데이터 (JSON-LD)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "한국기업심사원 KEAI",
  "description": "정부정책자금 전문 경영컨설팅",
  "url": "https://keai.co.kr",
  "telephone": "1688-8401",
  "email": "ceo@k-eai.kr",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "중봉대로 612번길 10-20, 505-J302호",
    "addressLocality": "인천광역시 서구 청라동",
    "addressCountry": "KR"
  },
  "founder": { "@type": "Person", "name": "이강희" },
  "openingHours": "Mo-Fr 09:00-18:00",
  "serviceType": ["정부정책자금 컨설팅", "경영컨설팅", "자금확보 지원"]
}
</script>
```

### 기술적 SEO 체크리스트
- [ ] robots.txt 생성
- [ ] sitemap.xml 생성
- [ ] 이미지 alt 태그 최적화
- [ ] 페이지 로딩 속도 최적화
- [ ] 모바일 친화성 검증
- [ ] Core Web Vitals 최적화

---

## OG 이미지 제작 계획

### 사양
| 항목 | 사양 |
|------|------|
| 크기 | 1200 x 630 px |
| 형식 | PNG |
| 파일 크기 | 300KB 이하 |

### 디자인 가이드
- **배경**: KEAI 블루 그라디언트 (#0F4C81 → #1A73E8)
- **로고**: 좌측 상단 또는 중앙 배치
- **폰트**: Pretendard Bold
- **레이아웃**: 좌측 텍스트 + 우측 아이콘/이미지

### 제작 목록
| 페이지 | 파일명 | 메인 텍스트 |
|--------|--------|------------|
| 홈 | og-home.png | 정부정책자금 전문 경영컨설팅 |
| 회사소개 | og-company.png | 기업심사 전문가와 함께 |
| 진행과정 | og-process.png | 체계적인 5단계 프로세스 |
| 자금상담 | og-fund.png | 무료심사 신청하기 |
| 전문서비스 | og-pro.png | 검증된 전문가 네트워크 |
| 온라인마케팅 | og-mkt.png | 데이터 기반 마케팅 솔루션 |
| 게시글 | og-post.png | 게시글 제목 표시 (동적) |

### OG 메타 태그 템플릿
```html
<meta property="og:type" content="website">
<meta property="og:site_name" content="한국기업심사원 KEAI">
<meta property="og:title" content="페이지 제목">
<meta property="og:description" content="페이지 설명">
<meta property="og:image" content="https://keai.co.kr/og/og-home.png">
<meta property="og:url" content="https://keai.co.kr/">
<meta property="og:locale" content="ko_KR">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="페이지 제목">
<meta name="twitter:description" content="페이지 설명">
<meta name="twitter:image" content="https://keai.co.kr/og/og-home.png">
```

---

## 관리자 대시보드 - 이미지 관리 기능

### 기능 개요
관리자가 홈페이지의 주요 이미지를 직접 교체할 수 있는 기능

### 관리 가능한 이미지 목록
| 섹션 | 이미지 ID | 설명 | 권장 사이즈 |
|------|----------|------|------------|
| 홈 히어로 | hero-home | 메인 배경 이미지 | 1920x1080 |
| 회사소개 대표 | ceo-profile | 대표자 프로필 사진 | 600x600 |
| 자금상담 폼 | form-image | 폼 섹션 좌측 이미지 | 800x1000 |
| 전문서비스 히어로 | hero-pro | 전문서비스 배경 | 1920x1080 |
| 온라인마케팅 히어로 | hero-mkt | 마케팅 배경 | 1920x1080 |

### Airtable 테이블 구조 (이미지 관리)
```
테이블명: 이미지설정

필드:
- 이미지ID (Single line text, Primary)
- 설명 (Single line text)
- 현재이미지 (Attachment)
- 이미지URL (URL, Formula)
- 수정일시 (Last modified time)
```

### API 엔드포인트
```javascript
// api/images.js (Vercel Serverless Function)
// GET /api/images - 이미지 목록 조회
// GET /api/images/:id - 특정 이미지 조회
// PUT /api/images/:id - 이미지 업데이트 (관리자 인증 필요)
```

### 프론트엔드 이미지 로딩
```javascript
// js/image-loader.js
async function loadDynamicImages() {
    const response = await fetch('/api/images');
    const images = await response.json();

    images.forEach(img => {
        const elements = document.querySelectorAll(`[data-image-id="${img.id}"]`);
        elements.forEach(el => {
            if (el.tagName === 'IMG') el.src = img.url;
            else el.style.backgroundImage = `url(${img.url})`;
        });
    });
}
```

### 대시보드 UI (dashboard/images.html)
```
┌─────────────────────────────────────────┐
│  🖼️ 이미지 관리                          │
├─────────────────────────────────────────┤
│  ┌─────────┐  홈 히어로 배경             │
│  │ preview │  현재: hero-home.jpg        │
│  │         │  [파일 선택] [업로드]        │
│  └─────────┘  권장: 1920x1080           │
│                                         │
│  ┌─────────┐  대표자 프로필              │
│  │ preview │  현재: ceo-profile.png      │
│  │         │  [파일 선택] [업로드]        │
│  └─────────┘  권장: 600x600             │
└─────────────────────────────────────────┘
```

---

## 게시판 기능 (진행과정 페이지)

### 위치
`process.html` - 히어로 섹션과 FAQ 섹션 사이

### 기능 명세
- 공지사항/뉴스 게시글 목록 표시
- 썸네일, 제목, 카테고리, 날짜, 조회수 표시
- 카드 클릭 시 상세 페이지 이동 (post.html)
- 모바일: 가로 스크롤 카드
- PC: 3열 그리드

### 디자인 테마
KEAI 블루 테마 적용
- 배경: #0F4C81 ~ #1A73E8 그라디언트
- 강조색: #90CAF9
- 카드: rgba(255,255,255,0.1) + blur

### Airtable 테이블 구조 (게시판)
```
테이블명: 게시판

필드:
- 제목 (Single line text)
- 내용 (Long text)
- 요약 (Single line text)
- 카테고리 (Single select: 공지, 뉴스, 정보)
- 썸네일 (Attachment)
- 작성일 (Date)
- 조회수 (Number)
- 공개여부 (Checkbox)
```

### 참고 소스
- `F:\pola_homepage\1.14th_jeonyejin_bizen\src\components\board.html`

---

## 구현 우선순위

### Phase 1: 기본 배포 준비
- [ ] Vercel 프로젝트 설정
- [ ] vercel.json 구성
- [ ] 환경 변수 설정
- [ ] 기본 배포 테스트

### Phase 2: SEO 최적화
- [ ] 모든 페이지 메타 태그 업데이트
- [ ] robots.txt, sitemap.xml 생성
- [ ] 구조화된 데이터 추가
- [ ] 이미지 alt 태그 정리

### Phase 3: OG 이미지
- [ ] OG 이미지 디자인 (6종)
- [ ] OG 메타 태그 적용
- [ ] 소셜 미디어 공유 테스트

### Phase 4: 게시판 기능
- [ ] Airtable 게시판 테이블 생성
- [ ] 게시판 컴포넌트 KEAI 테마 적용
- [ ] process.html에 게시판 섹션 추가
- [ ] post.html 상세 페이지 생성

### Phase 5: 관리자 대시보드
- [ ] 이미지 관리 API 개발
- [ ] 대시보드 이미지 관리 UI
- [ ] 이미지 업로드/교체 기능
- [ ] 프론트엔드 동적 이미지 로딩

---

## 현재 구현 상태 (2025-12-13)

### 완료된 작업

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 배포 | ✅ 완료 | https://keai-three.vercel.app |
| 이미지 관리 API | ✅ 완료 | api/images.js (R2 업로드, 클라이언트 WebP 변환) |
| 이미지 대시보드 | ✅ 완료 | dashboard/images.html (38개 슬롯) |
| R2 환경변수 | ✅ 완료 | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID 등 |
| R2 Public Access | ✅ 완료 | https://pub-614b08f38e094d04a78e718d3e8e811b.r2.dev |
| Airtable 이미지설정 | ✅ 완료 | 테이블 생성 및 연동 |
| 파비콘 업로드 | ✅ 완료 | R2에 업로드됨 |

### 미완료 작업

| 항목 | 상태 | 우선순위 | 다음 작업 |
|------|------|----------|----------|
| 게시판 API 보안 | ⚠️ 수정필요 | 높음 | api/board.js 토큰 환경변수화 (GitHub Secret 차단) |
| 프론트엔드 이미지 로딩 | ❌ 미구현 | 높음 | HTML에 data-image-id 적용 + js/image-loader.js |
| 대시보드 통합 | ⚠️ 부분완료 | 중간 | 사이드바 네비게이션 정리 |
| 게시판 UI | ⚠️ 부분완료 | 중간 | board.html, post-edit.html 테스트 필요 |
| SEO 메타태그 | ❌ 미적용 | 중간 | 각 페이지 메타태그 업데이트 |
| OG 이미지 제작 | ❌ 미제작 | 낮음 | 6종 디자인 필요 |
| Custom Domain | ❌ 대기중 | 낮음 | 도메인 이관 완료 후 R2 연결 |

---

## 다음 세션 작업 계획

### 1. 게시판 API 보안 수정 (필수)
```javascript
// api/board.js 수정
// 하드코딩된 토큰 제거 → 환경변수 사용
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
```

### 2. 프론트엔드 동적 이미지 로딩 구현
```html
<!-- HTML에 data-image-id 속성 추가 -->
<img data-image-id="logo" src="placeholder.png" alt="로고">
<div data-image-id="hero-home" class="hero-bg"></div>
```

### 3. 대시보드 사이드바 정리
- 현재: 이미지 관리, 게시판 관리 별도
- 목표: 통합 네비게이션

### 4. 게시판 기능 테스트
- Airtable 게시판 테이블 확인
- board.html에서 CRUD 테스트

---

## 환경변수 목록 (Vercel)

| 변수명 | 상태 | 용도 |
|--------|------|------|
| R2_ACCOUNT_ID | ✅ 설정됨 | Cloudflare Account |
| R2_ACCESS_KEY_ID | ✅ 설정됨 | R2 API Key |
| R2_SECRET_ACCESS_KEY | ✅ 설정됨 | R2 API Secret |
| R2_BUCKET_NAME | ✅ 설정됨 | keai |
| R2_PUBLIC_URL | ✅ 설정됨 | https://pub-614b08f38e094d04a78e718d3e8e811b.r2.dev |
| AIRTABLE_TOKEN | ✅ 설정됨 | Airtable API |
| AIRTABLE_BASE_ID | ✅ 설정됨 | appxVw5QQ0g4JEjoR |
| ADMIN_PASSWORD | ⚠️ 기본값 | keai2025 (변경 권장) |

---

## 버전 히스토리

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 0.1 | 2025-12-12 | PRD 초안 작성 |
| 1.0 | 2025-12-13 | Vercel 배포, SEO, OG 이미지, 게시판, 이미지 관리 추가 |
| 1.1 | 2025-12-13 | 이미지 관리 완료, 현재 상태 및 다음 세션 계획 추가 |
