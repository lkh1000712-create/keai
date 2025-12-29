// Vercel Cron Job - GA4 데이터를 Airtable에 저장
// 매일 자정에 실행: vercel.json에 cron 설정 필요
// 수동 실행: GET /api/cron-analytics?secret=xxx

import crypto from 'crypto';

// 환경변수
function getEnv(key, defaultValue = '') {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.trim().replace(/[\r\n]/g, '');
}

const CRON_SECRET = getEnv('CRON_SECRET', 'keai-cron-secret-2024');
const AIRTABLE_TOKEN = getEnv('AIRTABLE_TOKEN');
const AIRTABLE_BASE_ID = getEnv('AIRTABLE_BASE_ID', 'appxVw5QQ0g4JEjoR');
const ANALYTICS_TABLE_ID = 'tblvtCiOigcPRPXpY'; // Analytics 테이블 ID
const LEADS_TABLE_ID = 'tblS5O4LN5C7L9Km7'; // 한국기업심사원 테이블 ID
const GA4_PROPERTY_ID = getEnv('GA4_PROPERTY_ID', '516503347');
const SEARCH_CONSOLE_SITE = getEnv('SEARCH_CONSOLE_SITE', 'https://k-eai.kr');

// Google API Access Token 획득
async function getAccessToken() {
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

    const base64url = (obj) => {
        const json = JSON.stringify(obj);
        const base64 = Buffer.from(json).toString('base64');
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const headerB64 = base64url(header);
    const payloadB64 = base64url(payload);
    const unsignedToken = `${headerB64}.${payloadB64}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedToken);
    const signature = sign.sign(privateKey, 'base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const jwt = `${unsignedToken}.${signature}`;

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
async function getGA4Data(accessToken, startDate, endDate) {
    const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
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
async function getSearchConsoleData(accessToken, startDate, endDate) {
    const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SEARCH_CONSOLE_SITE)}/searchAnalytics/query`,
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

// Airtable에서 특정 날짜 레코드 확인
async function getExistingRecord(date) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ANALYTICS_TABLE_ID}`;
    const params = new URLSearchParams({
        'filterByFormula': `{date} = '${date}'`,
        'maxRecords': '1'
    });

    const response = await fetch(`${url}?${params}`, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.records?.[0] || null;
}

// Airtable에 데이터 저장/업데이트
async function upsertAnalyticsData(record) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ANALYTICS_TABLE_ID}`;

    try {
        // 기존 레코드 확인
        const existing = await getExistingRecord(record['date']);

        if (existing) {
            // 업데이트
            const response = await fetch(`${url}/${existing.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: record })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Airtable Update Error] ${record['date']}: ${errorText}`);
            }
            return response.ok;
        } else {
            // 새로 생성
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: record })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Airtable Create Error] ${record['date']}: ${errorText}`);
            }
            return response.ok;
        }
    } catch (error) {
        console.error(`[Airtable Exception] ${record['date']}: ${error.message}`);
        return false;
    }
}

// Airtable에서 일별 접수 건수 가져오기
async function getDailyLeadsCount(date) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEADS_TABLE_ID}`;
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const filterFormula = `AND(IS_AFTER(CREATED_TIME(), '${startOfDay}'), IS_BEFORE(CREATED_TIME(), '${endOfDay}'))`;
    const params = new URLSearchParams({
        'filterByFormula': filterFormula,
        'maxRecords': '1000'
    });

    try {
        const response = await fetch(`${url}?${params}`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return 0;

        const data = await response.json();
        return data.records?.length || 0;
    } catch (error) {
        console.error('Leads count error:', error);
        return 0;
    }
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Vercel Cron 또는 수동 실행 인증
    const authHeader = req.headers.authorization;
    const querySecret = req.query.secret;
    const cronHeader = req.headers['x-vercel-cron'];

    const isValidCron = cronHeader === '1';
    const isValidSecret = querySecret === CRON_SECRET ||
                          (authHeader && authHeader.replace('Bearer ', '') === CRON_SECRET);

    if (!isValidCron && !isValidSecret) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        console.log('[Cron Analytics] Starting...');

        // 지난 7일 데이터 수집 (또는 query param으로 지정)
        const days = parseInt(req.query.days) || 7;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const formatDate = (d) => d.toISOString().split('T')[0];
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        console.log(`[Cron Analytics] Fetching data from ${startDateStr} to ${endDateStr}`);

        // Access Token 획득
        const accessToken = await getAccessToken();

        // GA4 + Search Console 데이터 가져오기
        const [ga4Data, searchConsoleData] = await Promise.all([
            getGA4Data(accessToken, startDateStr, endDateStr),
            getSearchConsoleData(accessToken, startDateStr, endDateStr),
        ]);

        // GA4 데이터 파싱
        const ga4Rows = ga4Data?.rows || [];
        const ga4Map = {};
        ga4Rows.forEach(row => {
            const date = row.dimensionValues[0].value; // YYYYMMDD
            const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
            ga4Map[formattedDate] = {
                visitors: parseInt(row.metricValues[0].value) || 0,
                pageviews: parseInt(row.metricValues[1].value) || 0,
                duration: parseFloat(row.metricValues[2].value) || 0,
                sessions: parseInt(row.metricValues[3].value) || 0,
            };
        });

        // Search Console 데이터 파싱
        const searchRows = searchConsoleData?.rows || [];
        const searchMap = {};
        searchRows.forEach(row => {
            const date = row.keys[0];
            searchMap[date] = {
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
            };
        });

        // Airtable에 저장
        let savedCount = 0;
        let errorCount = 0;

        for (const [date, ga4] of Object.entries(ga4Map)) {
            const search = searchMap[date] || { clicks: 0, impressions: 0 };
            const leadsCount = await getDailyLeadsCount(date);

            const record = {
                'date': date,
                'visitors': ga4.visitors,
                'pageviews': ga4.pageviews,
                'avgDuration': Math.round(ga4.duration * 10) / 10,
                'sessions': ga4.sessions,
                'leads': leadsCount,
                'clicks': search.clicks,
                'impressions': search.impressions,
                'collectedAt': new Date().toISOString(),
            };

            const success = await upsertAnalyticsData(record);
            if (success) {
                savedCount++;
            } else {
                errorCount++;
            }

            // Rate limit 방지
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`[Cron Analytics] Completed. Saved: ${savedCount}, Errors: ${errorCount}`);

        return res.status(200).json({
            success: true,
            message: `Analytics data synced`,
            period: { startDate: startDateStr, endDate: endDateStr },
            savedCount,
            errorCount,
        });

    } catch (error) {
        console.error('[Cron Analytics] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Unknown error',
        });
    }
}
