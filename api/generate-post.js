// Vercel Serverless API - Gemini 게시글 자동생성
// POST /api/generate-post - 새 게시글 생성
// 예시 스타일: 정책자금 관련 정보성 콘텐츠

// 환경변수
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appxVw5QQ0g4JEjoR';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblvARTwWZRjnft2B';

// 카테고리별 프롬프트 가이드
const CATEGORY_GUIDES = {
  '정책자금 가이드': {
    description: '정책자금의 개념과 구조를 처음 접하는 대표님도 이해할 수 있도록 정리',
    topics: ['정책자금 기본 개념', '정책자금 종류', '신청 자격 조건', '정책자금과 일반 대출 차이']
  },
  '운전자금·시설자금': {
    description: '실제로 가장 많이 활용되는 운전자금과 시설자금 설명',
    topics: ['운전자금 필요 상황', '시설자금 준비 시점', '자금별 특징', '적합한 자금 선택법']
  },
  '정책자금 심사 기준': {
    description: '정책자금 심사 과정에서 실제로 중요하게 보는 기준',
    topics: ['심사 핵심 요소', '신용점수와 심사', '재무제표 검토', '사업계획서 중요성']
  },
  '정책자금 준비 방법·서류': {
    description: '정책자금을 준비하는 과정과 서류',
    topics: ['준비 시작점', '필요 서류 목록', '서류 작성 요령', '흔한 실수와 주의점']
  }
};

// 예시 게시글 스타일 (참고용)
const STYLE_GUIDE = `
글 스타일 가이드:
1. 제목: 질문형 또는 대표님 관점의 궁금증을 반영
2. 문단: 2-4줄로 짧게 끊어서 가독성 높임
3. 어조: 전문적이지만 친근하게, 대표님에게 설명하는 듯한 톤
4. 내용: 실제 상담 경험을 바탕으로 한 현실적인 조언
5. 길이: 400-600자 내외
6. 금지어: '대출알선', '서류대행', '승인률', '성공사례', '정부정책자금'
7. 권장어: '자금확보', '역량파악', '코칭', '안내', '지원'
`;

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { category, topic, customPrompt, autoSave } = req.body;

    // 카테고리 확인
    const categoryInfo = CATEGORY_GUIDES[category];
    if (!category) {
      return res.status(400).json({
        success: false,
        error: '카테고리를 선택해주세요',
        availableCategories: Object.keys(CATEGORY_GUIDES)
      });
    }

    // Gemini API 호출
    const generatedPost = await generateWithGemini(category, categoryInfo, topic, customPrompt);

    // 자동 저장 옵션
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

// Gemini API로 게시글 생성
async function generateWithGemini(category, categoryInfo, topic, customPrompt) {
  const prompt = buildPrompt(category, categoryInfo, topic, customPrompt);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
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

  // 응답 파싱 (제목과 내용 분리)
  return parseGeneratedContent(generatedText);
}

// 프롬프트 생성
function buildPrompt(category, categoryInfo, topic, customPrompt) {
  const topicHint = topic || (categoryInfo?.topics ? categoryInfo.topics[Math.floor(Math.random() * categoryInfo.topics.length)] : '');

  return `
당신은 정책자금 전문 컨설턴트입니다. 중소기업/소상공인 대표님들을 위한 정보성 블로그 게시글을 작성해주세요.

카테고리: ${category}
${categoryInfo ? `카테고리 설명: ${categoryInfo.description}` : ''}
주제: ${topicHint || '자유 주제'}
${customPrompt ? `추가 요청: ${customPrompt}` : ''}

${STYLE_GUIDE}

출력 형식 (반드시 이 형식을 따르세요):
---제목---
[여기에 제목 작성]
---내용---
[여기에 본문 작성]
---요약---
[2-3문장 요약]
---끝---

중요:
- 제목은 질문형이나 궁금증을 반영한 형태로 작성
- 본문은 짧은 문단으로 나누어 가독성 높게 작성
- 실제 경험에서 나온 듯한 현실적인 조언 포함
- 금지어 절대 사용 금지

지금 게시글을 생성해주세요.
`;
}

// 생성된 콘텐츠 파싱
function parseGeneratedContent(text) {
  const titleMatch = text.match(/---제목---\s*([\s\S]*?)\s*---내용---/);
  const contentMatch = text.match(/---내용---\s*([\s\S]*?)\s*---요약---/);
  const summaryMatch = text.match(/---요약---\s*([\s\S]*?)\s*---끝---/);

  const title = titleMatch ? titleMatch[1].trim() : '';
  const content = contentMatch ? contentMatch[1].trim() : '';
  const summary = summaryMatch ? summaryMatch[1].trim() : '';

  // 파싱 실패 시 전체 텍스트에서 추출 시도
  if (!title || !content) {
    const lines = text.split('\n').filter(l => l.trim());
    return {
      제목: lines[0]?.replace(/^[#*\-\s]+/, '').trim() || '제목 없음',
      내용: lines.slice(1).join('\n\n').trim() || text.trim(),
      요약: ''
    };
  }

  return {
    제목: title,
    내용: content,
    요약: summary
  };
}

// Airtable에 저장
async function saveToAirtable(post, category) {
  const today = new Date().toISOString().split('T')[0];

  const fields = {
    '제목': post.제목,
    '내용': post.내용,
    '요약': post.요약 || '',
    '카테고리': mapCategory(category),
    '작성일': today,
    '조회수': 0,
    '공개여부': false // 검토 후 공개
  };

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
    throw new Error(`Airtable save error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// 카테고리 매핑 (Airtable 필드값에 맞게)
function mapCategory(category) {
  const mapping = {
    '정책자금 가이드': '정보',
    '운전자금·시설자금': '정보',
    '정책자금 심사 기준': '정보',
    '정책자금 준비 방법·서류': '정보'
  };
  return mapping[category] || '정보';
}
