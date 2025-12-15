import { NextResponse } from 'next/server';

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appxVw5QQ0g4JEjoR';
const AIRTABLE_TABLE_NAME = '한국기업심사원';

// Airtable 접수 건수 조회
async function getAirtableLeadsCount(startDate: string, endDate: string) {
  if (!AIRTABLE_TOKEN) {
    console.warn('Airtable token not configured');
    return { total: 0, periodCount: 0 };
  }

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    // 기간 필터링을 위한 formula
    const filterFormula = `AND(IS_AFTER(CREATED_TIME(), '${startDate}'), IS_BEFORE(CREATED_TIME(), '${endDate}T23:59:59'))`;

    const params = new URLSearchParams({
      'filterByFormula': filterFormula,
      'maxRecords': '1000'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Airtable API Error:', errorText);
      return { total: 0, periodCount: 0 };
    }

    const data = await response.json();
    const periodCount = data.records?.length || 0;

    // 전체 건수도 조회 (필터 없이)
    const totalResponse = await fetch(`${url}?maxRecords=1000`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    let total = 0;
    if (totalResponse.ok) {
      const totalData = await totalResponse.json();
      total = totalData.records?.length || 0;
    }

    return { total, periodCount };
  } catch (error) {
    console.error('Airtable fetch error:', error);
    return { total: 0, periodCount: 0 };
  }
}

// Google API 인증을 위한 JWT 생성
async function getAccessToken(): Promise<string> {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Google credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Base64URL 인코딩
  const base64url = (obj: object) => {
    const json = JSON.stringify(obj);
    const base64 = Buffer.from(json).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // RSA-SHA256 서명
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedToken}.${signature}`;

  // Access Token 요청
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
  }

  return tokenData.access_token;
}

// GA4 데이터 가져오기
async function getGA4Data(accessToken: string, startDate: string, endDate: string) {
  const propertyId = process.env.GA4_PROPERTY_ID || '516503347';

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'sessions' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('GA4 API Error:', error);
    return null;
  }

  return response.json();
}

// Search Console 데이터 가져오기
async function getSearchConsoleData(accessToken: string, startDate: string, endDate: string) {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE || 'https://k-eai.kr';

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 500,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Search Console API Error:', error);
    return null;
  }

  return response.json();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30days';

    // 날짜 계산
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Access Token 획득
    const accessToken = await getAccessToken();

    // 데이터 병렬 조회 (GA4, Search Console, Airtable)
    const [ga4Data, searchConsoleData, leadsData] = await Promise.all([
      getGA4Data(accessToken, startDateStr, endDateStr),
      getSearchConsoleData(accessToken, startDateStr, endDateStr),
      getAirtableLeadsCount(startDateStr, endDateStr),
    ]);

    // GA4 데이터 파싱
    const ga4Rows = ga4Data?.rows || [];
    const dailyData = ga4Rows.map((row: { dimensionValues: { value: string }[], metricValues: { value: string }[] }) => ({
      date: row.dimensionValues[0].value,
      visitors: parseInt(row.metricValues[0].value) || 0,
      pageviews: parseInt(row.metricValues[1].value) || 0,
      duration: parseFloat(row.metricValues[2].value) || 0,
      sessions: parseInt(row.metricValues[3].value) || 0,
    }));

    // Search Console 데이터 파싱
    const searchRows = searchConsoleData?.rows || [];
    const searchData = searchRows.map((row: { keys: string[], clicks: number, impressions: number, ctr: number, position: number }) => ({
      date: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));

    // 합계 계산
    const totals = {
      visitors: dailyData.reduce((sum: number, d: { visitors: number }) => sum + d.visitors, 0),
      pageviews: dailyData.reduce((sum: number, d: { pageviews: number }) => sum + d.pageviews, 0),
      avgDuration: dailyData.length > 0
        ? dailyData.reduce((sum: number, d: { duration: number }) => sum + d.duration, 0) / dailyData.length
        : 0,
      sessions: dailyData.reduce((sum: number, d: { sessions: number }) => sum + d.sessions, 0),
      clicks: searchData.reduce((sum: number, d: { clicks: number }) => sum + d.clicks, 0),
      impressions: searchData.reduce((sum: number, d: { impressions: number }) => sum + d.impressions, 0),
      avgCtr: searchData.length > 0
        ? searchData.reduce((sum: number, d: { ctr: number }) => sum + d.ctr, 0) / searchData.length
        : 0,
      avgPosition: searchData.length > 0
        ? searchData.reduce((sum: number, d: { position: number }) => sum + d.position, 0) / searchData.length
        : 0,
      // Airtable 접수 건수
      leads: leadsData.periodCount,
      totalLeads: leadsData.total,
    };

    return NextResponse.json({
      success: true,
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      totals,
      dailyData,
      searchData,
    });

  } catch (error) {
    console.error('Analytics API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        // 샘플 데이터 반환 (개발/테스트용)
        useSampleData: true,
      },
      { status: 500 }
    );
  }
}
