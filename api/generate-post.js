// Vercel Serverless API - Gemini 게시글 자동생성 (v3)
// POST /api/generate-post - 새 게시글 생성
// GET /api/generate-post - Cron 자동 실행 (매일 오전 9시)
// 주제: 정책자금, 정부지원자금, 기업인증, 특허, 기업부설연구소 등 경영컨설팅
//
// ⚠️ Gemini 모델 (절대 변경 금지!)
// 텍스트 생성: gemini-3-flash-preview
// 이미지 생성: gemini-3-pro-image-preview (Nano Banana Pro)
// 변경일: 2025-12-29

// AWS SDK for R2 (S3 호환)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// 환경변수
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appxVw5QQ0g4JEjoR';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblvARTwWZRjnft2B';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1003394139746';
const CRON_SECRET = process.env.CRON_SECRET;

// Cloudflare R2 (이미지 저장 - S3 호환 API)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '75123333ef4e1c6368873dd55fca00ab';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'keai';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
// R2 퍼블릭 URL (r2.dev 도메인 또는 커스텀 도메인)
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;

// 정책자금 기준 연도 (다음 연도 정책 기준으로 작성)
// 12월~1월은 다음 연도 정책자금 시즌이므로 다음 연도 기준 사용
function getPolicyYear() {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const currentYear = kstDate.getUTCFullYear();
  const currentMonth = kstDate.getUTCMonth() + 1; // 1-12

  // 11월~12월은 다음 연도 정책 기준으로 작성
  if (currentMonth >= 11) {
    return currentYear + 1;
  }
  return currentYear;
}
const CURRENT_YEAR = getPolicyYear();

// 카테고리별 가이드 (세분화)
const CATEGORIES = {
  '정책자금-가이드': {
    label: '정책자금 가이드',
    description: '정책자금의 개념과 구조를 처음 접하는 대표님도 이해할 수 있도록 정리',
    keywords: ['정책자금', '중소기업', '소상공인', '저금리', '융자'],
    searchQueries: ['정책자금 신청 방법', '중소기업 정책자금', '소상공인 자금지원'],
    sources: ['중소벤처기업진흥공단', '소상공인진흥공단', '중소기업청', '기획재정부']
  },
  '운전시설자금': {
    label: '운전자금·시설자금',
    description: '실제로 가장 많이 활용되는 운전자금과 시설자금 설명',
    keywords: ['운전자금', '시설자금', '설비투자', '경영안정'],
    searchQueries: ['운전자금 지원', '시설자금 대출', '설비투자 지원'],
    sources: ['중소벤처기업진흥공단', '신용보증기금', '기술보증기금']
  },
  '심사기준': {
    label: '정책자금 심사 기준',
    description: '정책자금 심사 과정에서 실제로 중요하게 보는 기준',
    keywords: ['심사기준', '신용등급', '재무제표', '사업계획서', '담보'],
    searchQueries: ['정책자금 심사 기준', '신용등급 조건', '사업계획서 작성'],
    sources: ['중소벤처기업진흥공단', '신용보증기금', '기술보증기금']
  },
  '준비서류': {
    label: '정책자금 준비 방법·서류',
    description: '정책자금을 준비하는 과정과 필요 서류',
    keywords: ['서류준비', '신청서류', '재무제표', '사업자등록증', '납세증명'],
    searchQueries: ['정책자금 필요서류', '정책자금 신청 준비'],
    sources: ['중소벤처기업진흥공단', '소상공인진흥공단', '정부24']
  },
  '기업인증': {
    label: '기업인증',
    description: '벤처기업인증, 이노비즈, 메인비즈, 여성기업 등 각종 기업인증 안내',
    keywords: ['벤처기업', '이노비즈', '메인비즈', '여성기업', '기업인증', '인증혜택'],
    searchQueries: ['벤처기업 인증 방법', '이노비즈 인증 조건', '메인비즈 혜택', '여성기업 인증'],
    sources: ['벤처기업협회', '중소기업기술정보진흥원', '중소벤처기업부', '여성기업종합지원센터']
  },
  '특허-지식재산': {
    label: '특허·지식재산',
    description: '특허, 실용신안, 디자인, 상표 등록 및 지식재산권 활용 안내',
    keywords: ['특허', '실용신안', '디자인등록', '상표등록', '지식재산', 'IP'],
    searchQueries: ['특허 출원 방법', '특허 비용', '지식재산권 활용', '직무발명보상'],
    sources: ['특허청', '한국발명진흥회', '한국지식재산보호원', 'KIPRIS']
  },
  '연구소설립': {
    label: '기업부설연구소 설립',
    description: '기업부설연구소 및 연구개발전담부서 설립 조건과 혜택 안내',
    keywords: ['기업부설연구소', '연구전담부서', 'R&D센터', '연구인력', '연구시설'],
    searchQueries: ['기업부설연구소 설립 조건', '연구소 설립 혜택', '연구인력 요건'],
    sources: ['한국산업기술진흥협회', '중소기업기술정보진흥원', '국가과학기술심의회']
  }
};

// 요일별 카테고리 순환 (0=일, 1=월, ...)
const DAY_CATEGORY_MAP = {
  0: '정책자금-가이드',   // 일요일
  1: '운전시설자금',      // 월요일
  2: '심사기준',          // 화요일
  3: '준비서류',          // 수요일
  4: '기업인증',          // 목요일
  5: '특허-지식재산',     // 금요일
  6: '연구소설립'         // 토요일
};

// HTML/CSS 기반 차트 생성 함수들
const CHART_TEMPLATES = {
  // 막대 차트 (금액 비교)
  barChart: (title, data) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const bars = data.map(d => {
      const width = Math.round((d.value / maxValue) * 100);
      return `<div style="margin:8px 0;">
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="width:120px;font-size:14px;color:#374151;">${d.label}</span>
    <div style="flex:1;background:#E5E7EB;border-radius:4px;height:24px;">
      <div style="width:${width}%;background:linear-gradient(90deg,#0066CC,#0052A3);height:100%;border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">
        <span style="color:white;font-size:12px;font-weight:600;">${d.display || d.value}</span>
      </div>
    </div>
  </div>
</div>`;
    }).join('');
    return `
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin:24px 0;">
  <h4 style="margin:0 0 16px 0;font-size:16px;color:#111827;">📊 ${title}</h4>
  ${bars}
</div>`;
  },

  // 비교표
  comparisonTable: (title, headers, rows) => {
    const headerCells = headers.map(h => `<th style="background:#F3F4F6;padding:12px;text-align:left;border-bottom:2px solid #E5E7EB;font-weight:600;color:#374151;">${h}</th>`).join('');
    const bodyRows = rows.map(row => {
      const cells = row.map((cell, i) => {
        const style = i === 0 ? 'font-weight:600;color:#111827;' : 'color:#4B5563;';
        return `<td style="padding:12px;border-bottom:1px solid #E5E7EB;${style}">${cell}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `
<div style="margin:24px 0;overflow-x:auto;">
  <h4 style="margin:0 0 12px 0;font-size:16px;color:#111827;">📋 ${title}</h4>
  <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</div>`;
  },

  // 진행 단계 표시
  processSteps: (title, steps) => {
    const stepItems = steps.map((step, i) => `
<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
  <div style="min-width:32px;height:32px;background:#0066CC;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${i + 1}</div>
  <div style="flex:1;">
    <div style="font-weight:600;color:#111827;margin-bottom:4px;">${step.title}</div>
    <div style="color:#6B7280;font-size:14px;line-height:1.5;">${step.description}</div>
  </div>
</div>`).join('');
    return `
<div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:20px;margin:24px 0;">
  <h4 style="margin:0 0 20px 0;font-size:16px;color:#0369A1;">🔄 ${title}</h4>
  ${stepItems}
</div>`;
  },

  // 핵심 통계 카드
  statsCards: (stats) => {
    const cards = stats.map(stat => `
<div style="flex:1;min-width:140px;background:white;border:1px solid #E5E7EB;border-radius:12px;padding:16px;text-align:center;">
  <div style="font-size:24px;font-weight:700;color:#0066CC;margin-bottom:4px;">${stat.value}</div>
  <div style="font-size:13px;color:#6B7280;">${stat.label}</div>
</div>`).join('');
    return `
<div style="display:flex;gap:12px;flex-wrap:wrap;margin:24px 0;">
  ${cards}
</div>`;
  },

  // 체크리스트
  checklist: (title, items) => {
    const listItems = items.map(item => `
<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
  <span style="color:#10B981;font-size:16px;">✓</span>
  <span style="color:#374151;font-size:14px;line-height:1.5;">${item}</span>
</div>`).join('');
    return `
<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin:24px 0;">
  <h4 style="margin:0 0 16px 0;font-size:16px;color:#166534;">✅ ${title}</h4>
  ${listItems}
</div>`;
  },

  // 주의사항 박스
  warningBox: (title, content) => `
<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:20px;margin:24px 0;">
  <h4 style="margin:0 0 12px 0;font-size:16px;color:#92400E;">⚠️ ${title}</h4>
  <div style="color:#78350F;font-size:14px;line-height:1.6;">${content}</div>
</div>`,

  // 팁 박스
  tipBox: (title, content) => `
<div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
  <h4 style="margin:0 0 8px 0;font-size:15px;color:#1E40AF;">💡 ${title}</h4>
  <div style="color:#1E3A8A;font-size:14px;line-height:1.6;">${content}</div>
</div>`
};

// 예시 게시글 스타일 가이드
const STYLE_GUIDE = `
## 글 스타일 가이드 (반드시 준수)

### 1. 기본 원칙
- 전문적이지만 친근한 톤 (대표님에게 상담하듯이)
- 짧은 문단 (2-4줄)으로 가독성 높임
- 실제 경험에서 나온 듯한 현실적 조언
- 추측이나 모호한 표현 대신 구체적 정보

### 2. 분량
- 최소 1200자 이상 (1500-2000자 권장)
- 서론, 본론(2-4개 섹션), 결론 구조

### 3. 시각화 필수 활용
- 금액/수치 비교 → 막대 차트
- 조건/혜택 비교 → 비교표
- 절차/단계 → 프로세스 단계
- 핵심 수치 → 통계 카드
- 필요 서류/조건 → 체크리스트
- 주의사항 → 경고 박스
- 꿀팁 → 팁 박스

### 4. 금지어 (절대 사용 금지)
- '대출알선', '서류대행', '접수대행'
- '승인률', '성공률', '성공사례'
- '정부정책자금' (정책자금으로 대체)
- '기업평가', '기업진단', '기업분석' → '역량파악', '파악', '안내'로 대체

### 5. 권장어
- '자금확보', '확보 가능성'
- '역량파악', '코칭', '안내', '지원'
- '대표님이 직접 진행'

### 6. 출처 명시
- 공공기관/정부기관 정보는 출처 표기
- "※ 출처: 중소벤처기업진흥공단 (2025년 기준)"

### 7. 면책 문구 (마지막에 필수)
※ 본 내용은 정보 제공 목적이며, 정책자금 대행서비스가 아닙니다. 실제 신청은 대표님이 해당 기관에 직접 진행하시기 바랍니다.
`;

// 메인 핸들러
export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Cron 자동 실행
  if (req.method === 'GET') {
    // Cron 인증 확인
    const authHeader = req.headers.authorization;
    const forceRun = req.query.force === 'true';

    if (!forceRun && CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const skipImage = req.query.skipImage === 'true';
      const result = await runAutoGeneration(req.query.category, skipImage);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Auto generation error:', error);
      await sendTelegramNotification('error', { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST: 수동 생성
  if (req.method === 'POST') {
    try {
      const { category, topic, customPrompt, autoSave } = req.body;

      if (!category || !CATEGORIES[category]) {
        return res.status(400).json({
          success: false,
          error: '유효한 카테고리를 선택해주세요',
          availableCategories: Object.keys(CATEGORIES).map(k => ({
            key: k,
            label: CATEGORIES[k].label
          }))
        });
      }

      const generatedPost = await generateWithGemini(category, topic, customPrompt);

      if (autoSave && generatedPost) {
        const savedPost = await saveToAirtable(generatedPost, category);
        return res.status(200).json({
          success: true,
          post: generatedPost,
          saved: true,
          savedId: savedPost.id
        });
      }

      return res.status(200).json({
        success: true,
        post: generatedPost,
        saved: false
      });

    } catch (error) {
      console.error('Generate post error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// 자동 생성 실행
async function runAutoGeneration(forceCategory, skipImage = false) {
  console.log('🚀 자동 게시글 생성 시작...');
  if (skipImage) console.log('⏭️ 이미지 생성 스킵 모드');

  // 오늘 요일 확인 (KST)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const dayOfWeek = kstDate.getUTCDay();

  // 카테고리 결정
  const category = forceCategory && CATEGORIES[forceCategory]
    ? forceCategory
    : DAY_CATEGORY_MAP[dayOfWeek];

  console.log(`📁 카테고리: ${CATEGORIES[category].label}`);

  // 1. Google Search로 최신 정보 수집
  console.log('🔍 최신 정보 검색 중...');
  const searchResults = await searchLatestInfo(category);

  // 2. 주제 생성
  console.log('📝 주제 생성 중...');
  const topic = await generateTopic(category, searchResults);
  console.log(`📌 주제: ${topic}`);

  // 3. 콘텐츠 생성
  console.log('✍️ 콘텐츠 생성 중...');
  const generatedPost = await generateWithGemini(category, topic, null, searchResults);

  // 4. 썸네일 이미지 생성 및 R2 업로드
  let thumbnailStatus = { success: false, message: '스킵됨' };
  if (!skipImage) {
    console.log('🖼️ 썸네일 이미지 생성 중...');
    thumbnailStatus = { success: false, message: '생성 안 함' };
    const thumbnailImage = await generateThumbnailImage(generatedPost.제목, category);
    if (thumbnailImage) {
      // 파일명 생성 (날짜-카테고리-랜덤.png)
      const timestamp = Date.now();
      const safeCategoryName = category.replace(/[^a-zA-Z0-9-]/g, '');
      const filename = `${timestamp}-${safeCategoryName}.png`;

      // R2에 업로드
      const thumbnailUrl = await uploadImageToR2(thumbnailImage, filename);
      if (thumbnailUrl) {
        generatedPost.thumbnailUrl = thumbnailUrl;
        thumbnailStatus = { success: true, message: '생성 완료' };
      } else {
        thumbnailStatus = { success: false, message: 'R2 업로드 실패' };
      }
    } else {
      thumbnailStatus = { success: false, message: '이미지 생성 실패' };
    }
  }

  // 5. Airtable 저장
  console.log('💾 Airtable 저장 중...');
  const savedPost = await saveToAirtable(generatedPost, category);

  // 6. 캐시 갱신 (R2)
  console.log('🔄 캐시 갱신 중...');
  await refreshBoardCache();

  // 7. 텔레그램 알림
  await sendTelegramNotification('success', {
    title: generatedPost.제목,
    category: CATEGORIES[category].label,
    savedId: savedPost?.id,
    thumbnail: thumbnailStatus
  });

  console.log('✅ 자동 생성 완료!');

  return {
    success: true,
    category: CATEGORIES[category].label,
    title: generatedPost.제목,
    savedId: savedPost?.id,
    generatedAt: new Date().toISOString()
  };
}

// Google Search로 최신 정보 검색
async function searchLatestInfo(category) {
  const categoryInfo = CATEGORIES[category];
  const searchQuery = `${CURRENT_YEAR}년 ${categoryInfo.searchQueries[0]} site:go.kr OR site:kosmes.or.kr OR site:semas.or.kr`;

  const prompt = `최근 1개월 이내에 발표된 ${categoryInfo.label} 관련 최신 정보를 검색해주세요.

검색 키워드: ${categoryInfo.keywords.join(', ')}
우선 참고 기관: ${categoryInfo.sources.join(', ')}

다음 정보를 수집해주세요:
1. ${CURRENT_YEAR}년 기준 최신 정책/제도 변경사항
2. 금리, 한도, 조건 등 구체적인 수치 정보
3. 신청 기간, 마감일 등 시기 정보
4. 공식 발표 출처

중요: 공공기관(go.kr), 정부기관의 공식 발표만 참고하세요.
추측이나 확인되지 않은 정보는 제외하세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
          tools: [{ google_search: {} }]
        })
      }
    );

    if (!response.ok) {
      console.error('Search API error:', response.status);
      return '';
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Search error:', error);
    return '';
  }
}

// 주제 생성
async function generateTopic(category, searchResults) {
  const categoryInfo = CATEGORIES[category];

  const prompt = `${categoryInfo.label} 카테고리의 블로그 게시글 주제를 1개 제안해주세요.

카테고리 설명: ${categoryInfo.description}
관련 키워드: ${categoryInfo.keywords.join(', ')}

${searchResults ? `최신 검색 결과:\n${searchResults.slice(0, 1000)}` : ''}

주제 조건:
1. 질문형 또는 대표님 관점의 궁금증 반영
2. 구체적이고 실용적인 정보 제공 가능한 주제
3. ${CURRENT_YEAR}년 기준 최신 정보 반영
4. 금지어 포함 금지: 대출알선, 서류대행, 승인률, 성공사례

제목만 한 줄로 응답하세요. 다른 설명 없이 제목만 출력하세요.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 200 }
      })
    }
  );

  const data = await response.json();
  const topic = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return topic.replace(/^["']|["']$/g, '').replace(/^\d+\.\s*/, '');
}

// Gemini API로 게시글 생성
async function generateWithGemini(category, topic, customPrompt, searchResults) {
  const categoryInfo = CATEGORIES[category];

  // 차트 템플릿 예시 (프롬프트에 포함)
  const chartExamples = `
시각화 HTML 코드 예시 (그대로 사용 가능):

1. 막대 차트 (금액 비교):
${CHART_TEMPLATES.barChart('2025년 정책자금 규모', [
  { label: '중진공', value: 85000, display: '8.5조원' },
  { label: '소진공', value: 52000, display: '5.2조원' },
  { label: '신보', value: 30000, display: '3조원' }
])}

2. 비교표:
${CHART_TEMPLATES.comparisonTable('자금종류별 조건',
  ['구분', '금리', '한도', '상환기간'],
  [
    ['운전자금', '연 2.5~3.5%', '5억원', '5년'],
    ['시설자금', '연 2.0~3.0%', '60억원', '8년']
  ]
)}

3. 핵심 통계:
${CHART_TEMPLATES.statsCards([
  { value: '26.5조원', label: '2025년 정책자금 규모' },
  { value: '연 2.99%', label: '기준금리' },
  { value: '5억원', label: '기업당 한도' }
])}

4. 프로세스 단계:
${CHART_TEMPLATES.processSteps('정책자금 신청 절차', [
  { title: '자가진단', description: '기업 현황 및 자격 요건 확인' },
  { title: '서류 준비', description: '재무제표, 사업계획서 등 필요 서류 구비' },
  { title: '온라인 신청', description: '중진공 홈페이지에서 신청서 작성' }
])}

5. 체크리스트:
${CHART_TEMPLATES.checklist('필수 서류 목록', [
  '사업자등록증 사본',
  '최근 3개년 재무제표',
  '국세/지방세 납세증명서'
])}

6. 주의사항 박스:
${CHART_TEMPLATES.warningBox('신청 전 확인사항', '휴·폐업 이력이 있는 경우 신청이 제한될 수 있습니다. 신용등급이 7등급 이하인 경우 보증기관 사전 상담을 권장합니다.')}

7. 팁 박스:
${CHART_TEMPLATES.tipBox('전문가 조언', '신청 전 자가진단을 통해 기업의 강점과 보완점을 파악하면 심사 통과 가능성을 높일 수 있습니다.')}
`;

  const prompt = `당신은 ${CURRENT_YEAR}년 기준 경영컨설팅 전문가입니다. 아래 조건에 맞는 블로그 게시글을 작성해주세요.

카테고리: ${categoryInfo.label}
카테고리 설명: ${categoryInfo.description}
주제: ${topic || '자유 주제'}
${customPrompt ? `추가 요청: ${customPrompt}` : ''}

${searchResults ? `
## 최신 검색 결과 (${CURRENT_YEAR}년 기준)
${searchResults}

⚠️ 위 검색 결과를 바탕으로 최신 정보 기반의 글을 작성하세요.
오래된 정보나 추측은 포함하지 마세요.
` : ''}

${STYLE_GUIDE}

${chartExamples}

## 출력 형식 (반드시 이 형식을 따르세요)
---제목---
[질문형 또는 궁금증 반영 제목]
---내용---
[본문 - 1200자 이상, 시각화 HTML 코드 포함]
---요약---
[2-3문장 요약]
---시각화---
[사용한 시각화 종류 목록: 예) 막대차트, 비교표, 체크리스트]
---끝---

중요:
1. 시각화 HTML 코드를 본문에 최소 2-3개 포함하세요
2. 금액, 금리, 한도 등 수치는 반드시 차트나 표로 시각화
3. 절차/단계는 프로세스 단계로 시각화
4. 서류/조건 목록은 체크리스트로 시각화
5. 금지어 절대 사용 금지
6. 마지막에 면책 문구 필수 포함

지금 게시글을 생성해주세요.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error('Gemini API returned empty response');
  }

  return parseGeneratedContent(generatedText);
}

// 생성된 콘텐츠 파싱
function parseGeneratedContent(text) {
  const titleMatch = text.match(/---제목---\s*([\s\S]*?)\s*---내용---/);
  const contentMatch = text.match(/---내용---\s*([\s\S]*?)\s*---요약---/);
  const summaryMatch = text.match(/---요약---\s*([\s\S]*?)\s*(?:---시각화---|---끝---)/);
  const visualMatch = text.match(/---시각화---\s*([\s\S]*?)\s*---끝---/);

  const title = titleMatch ? titleMatch[1].trim() : '';
  const content = contentMatch ? contentMatch[1].trim() : '';
  const summary = summaryMatch ? summaryMatch[1].trim() : '';
  const visualizations = visualMatch ? visualMatch[1].trim() : '';

  // 파싱 실패 시 전체 텍스트에서 추출 시도
  if (!title || !content) {
    const lines = text.split('\n').filter(l => l.trim());
    return {
      제목: lines[0]?.replace(/^[#*\-\s]+/, '').trim() || '제목 없음',
      내용: lines.slice(1).join('\n\n').trim() || text.trim(),
      요약: '',
      시각화: ''
    };
  }

  return {
    제목: title,
    내용: content,
    요약: summary,
    시각화: visualizations
  };
}

// Airtable에 저장
async function saveToAirtable(post, category) {
  if (!AIRTABLE_TOKEN) {
    console.log('⚠️ AIRTABLE_TOKEN 미설정 - 저장 스킵');
    return null;
  }

  const today = new Date().toISOString().split('T')[0];

  const fields = {
    '제목': post.제목,
    '내용': post.내용,
    '요약': post.요약 || '',
    '카테고리': CATEGORIES[category].label,
    '작성일': today,
    '조회수': 0,
    '공개여부': true
  };

  // 썸네일 URL이 있으면 추가 (URL 필드 타입)
  if (post.thumbnailUrl) {
    fields['썸네일'] = post.thumbnailUrl;
  }

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Airtable save error:', errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Airtable error:', error);
    return null;
  }
}

// 텔레그램 알림
async function sendTelegramNotification(type, data) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN 미설정 - 알림 스킵');
    return;
  }

  let message;
  if (type === 'success') {
    const thumbnailIcon = data.thumbnail?.success ? '✅' : '⚠️';
    const thumbnailText = data.thumbnail?.message || '상태 없음';
    message = `✅ *게시글 자동 생성 완료*

📝 *제목:* ${data.title}
📁 *카테고리:* ${data.category}
🖼️ *썸네일:* ${thumbnailIcon} ${thumbnailText}
🆔 *ID:* ${data.savedId || 'N/A'}
⏰ *시간:* ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  } else {
    message = `❌ *게시글 자동 생성 실패*

⚠️ *오류:* ${data.error}
⏰ *시간:* ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  }

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (error) {
    console.error('Telegram error:', error);
  }
}

// 타임아웃 fetch 헬퍼
async function fetchWithTimeout(url, options, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// 썸네일 이미지 생성 (Nano Banana Pro - gemini-3-pro-image-preview)
// ⚠️ 모델명 변경 금지!
// 타임아웃: 60초, 재시도: 2회 (실패시 프롬프트 변경)
async function generateThumbnailImage(title, category, retryCount = 0) {
  const MAX_RETRIES = 2;
  console.log(`🖼️ 썸네일 이미지 생성 중... (시도 ${retryCount + 1}/${MAX_RETRIES + 1})`);

  const categoryInfo = CATEGORIES[category];

  // 재시도에 따른 프롬프트 변경
  // 1차: 한국인 비즈니스 이미지
  // 2차: 한국 도심 빌딩/사무실 분위기
  // 3차: 추상적 비즈니스 그래픽
  const prompts = [
    `Korean business professional thumbnail image.
Topic: ${title}
Scene: Korean business people in modern Korean office, professional meeting or consultation.
Style: Warm, professional, blue accent (#0066CC), realistic photography style.
Requirements: No text overlay, 16:9 ratio, high quality, natural lighting.`,

    `Korean cityscape business thumbnail image.
Topic: ${title}
Scene: Modern Korean city skyline with office buildings, Seoul business district atmosphere.
Style: Clean, professional, blue sky, modern architecture, corporate feeling.
Requirements: No text overlay, 16:9 ratio, high quality, daytime.`,

    `Abstract business concept thumbnail.
Topic: ${title}
Style: Clean geometric shapes, blue (#0066CC) and white gradient, modern minimalist.
Requirements: No text, 16:9 ratio, professional, simple graphics.`
  ];

  const imagePrompt = prompts[Math.min(retryCount, prompts.length - 1)];

  try {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: imagePrompt }]
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        })
      },
      60000 // 60초 타임아웃
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Image generation error: ${response.status}`, errorText);

      // 재시도 가능한 에러인 경우
      if (retryCount < MAX_RETRIES && (response.status >= 500 || response.status === 429)) {
        console.log(`⏳ ${3 * (retryCount + 1)}초 후 재시도...`);
        await new Promise(r => setTimeout(r, 3000 * (retryCount + 1)));
        return generateThumbnailImage(title, category, retryCount + 1);
      }
      return null;
    }

    const data = await response.json();

    // 이미지 데이터 추출 (base64)
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      part => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (imagePart?.inlineData) {
      console.log('✅ 썸네일 이미지 생성 완료');
      return {
        base64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType
      };
    }

    console.log('⚠️ 이미지 데이터 없음 - 게시글은 이미지 없이 저장됩니다');
    return null;

  } catch (error) {
    console.error('Image generation error:', error.message);

    // 타임아웃 또는 네트워크 에러시 재시도
    if (retryCount < MAX_RETRIES) {
      console.log(`⏳ ${3 * (retryCount + 1)}초 후 재시도...`);
      await new Promise(r => setTimeout(r, 3000 * (retryCount + 1)));
      return generateThumbnailImage(title, category, retryCount + 1);
    }

    console.log('⚠️ 이미지 생성 실패 - 게시글은 이미지 없이 저장됩니다');
    return null;
  }
}

// R2 클라이언트 초기화
function getR2Client() {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.log('⚠️ R2 자격증명 미설정');
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });
}

// R2에 이미지 업로드
async function uploadImageToR2(imageData, filename) {
  console.log('📤 R2 이미지 업로드 중...');

  const r2Client = getR2Client();
  if (!r2Client) {
    return null;
  }

  try {
    // base64를 Buffer로 변환
    const imageBuffer = Buffer.from(imageData.base64, 'base64');

    // 파일 경로 생성 (thumbnails/YYYY/MM/filename.png)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const key = `thumbnails/${year}/${month}/${filename}`;

    // R2에 업로드
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: imageData.mimeType || 'image/png',
      CacheControl: 'public, max-age=31536000' // 1년 캐시
    });

    await r2Client.send(command);

    // 퍼블릭 URL 생성
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    console.log(`✅ R2 업로드 완료: ${publicUrl}`);

    return publicUrl;

  } catch (error) {
    console.error('R2 upload error:', error);
    return null;
  }
}

// 게시판 캐시 갱신 (board.js의 /api/board?refresh=true 호출)
async function refreshBoardCache() {
  try {
    // 내부 API 호출로 캐시 갱신
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://keai-three.vercel.app';

    const response = await fetch(`${baseUrl}/api/board?refresh=true`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      console.log('✅ 게시판 캐시 갱신 완료');
      return true;
    } else {
      console.error('캐시 갱신 실패:', response.status);
      return false;
    }
  } catch (error) {
    console.error('캐시 갱신 에러:', error.message);
    return false;
  }
}
