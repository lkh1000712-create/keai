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

// GA4 트래픽 소스 데이터 가져오기 (날짜별)
async function getGA4TrafficSources(accessToken, startDate, endDate) {
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
                dimensions: [
                    { name: 'date' },
                    { name: 'sessionDefaultChannelGroup' }
                ],
                metrics: [{ name: 'activeUsers' }],
                orderBys: [{ dimension: { dimensionName: 'date' } }],
            }),
        }
    );

    if (!response.ok) {
        console.error('GA4 Traffic Source Error:', await response.text());
        return null;
    }
    return response.json();
}

// GA4 기기별 데이터 가져오기 (날짜별)
async function getGA4DeviceData(accessToken, startDate, endDate) {
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
                dimensions: [
                    { name: 'date' },
                    { name: 'deviceCategory' }
                ],
                metrics: [{ name: 'activeUsers' }],
                orderBys: [{ dimension: { dimensionName: 'date' } }],
            }),
        }
    );

    if (!response.ok) {
        console.error('GA4 Device Error:', await response.text());
        return null;
    }
    return response.json();
}

// GA4 인기 페이지 데이터 가져오기 (날짜별)
async function getGA4TopPages(accessToken, startDate, endDate) {
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
                dimensions: [
                    { name: 'date' },
                    { name: 'pagePath' }
                ],
                metrics: [{ name: 'screenPageViews' }],
                orderBys: [
                    { dimension: { dimensionName: 'date' } },
                    { metric: { metricName: 'screenPageViews' }, desc: true }
                ],
                limit: 500,
            }),
        }
    );

    if (!response.ok) {
        console.error('GA4 Top Pages Error:', await response.text());
        return null;
    }
    return response.json();
}

// GA4 방문 국가 데이터 가져오기 (날짜별)
async function getGA4Countries(accessToken, startDate, endDate) {
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
                dimensions: [
                    { name: 'date' },
                    { name: 'country' }
                ],
                metrics: [{ name: 'activeUsers' }],
                orderBys: [
                    { dimension: { dimensionName: 'date' } },
                    { metric: { metricName: 'activeUsers' }, desc: true }
                ],
                limit: 500,
            }),
        }
    );

    if (!response.ok) {
        console.error('GA4 Countries Error:', await response.text());
        return null;
    }
    return response.json();
}

// GA4 유입 경로 (참조 URL) 데이터 가져오기 (날짜별)
async function getGA4Referrers(accessToken, startDate, endDate) {
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
                dimensions: [
                    { name: 'date' },
                    { name: 'sessionSource' }
                ],
                metrics: [{ name: 'activeUsers' }],
                orderBys: [
                    { dimension: { dimensionName: 'date' } },
                    { metric: { metricName: 'activeUsers' }, desc: true }
                ],
                limit: 500,
            }),
        }
    );

    if (!response.ok) {
        console.error('GA4 Referrers Error:', await response.text());
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

        // GA4 + Search Console + 추가 데이터 가져오기
        const [ga4Data, searchConsoleData, trafficData, deviceData, topPagesData, countriesData, referrersData] = await Promise.all([
            getGA4Data(accessToken, startDateStr, endDateStr),
            getSearchConsoleData(accessToken, startDateStr, endDateStr),
            getGA4TrafficSources(accessToken, startDateStr, endDateStr),
            getGA4DeviceData(accessToken, startDateStr, endDateStr),
            getGA4TopPages(accessToken, startDateStr, endDateStr),
            getGA4Countries(accessToken, startDateStr, endDateStr),
            getGA4Referrers(accessToken, startDateStr, endDateStr),
        ]);

        // GA4 기본 데이터 파싱
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

        // 트래픽 소스 파싱 (날짜별)
        const trafficMap = {};
        (trafficData?.rows || []).forEach(row => {
            const dateRaw = row.dimensionValues[0].value;
            const formattedDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
            const channel = row.dimensionValues[1].value.toLowerCase();
            const users = parseInt(row.metricValues[0].value) || 0;

            if (!trafficMap[formattedDate]) {
                trafficMap[formattedDate] = { organic: 0, direct: 0, referral: 0, social: 0, paid: 0, other: 0 };
            }
            if (channel.includes('organic')) trafficMap[formattedDate].organic += users;
            else if (channel.includes('direct')) trafficMap[formattedDate].direct += users;
            else if (channel.includes('referral')) trafficMap[formattedDate].referral += users;
            else if (channel.includes('social')) trafficMap[formattedDate].social += users;
            else if (channel.includes('paid')) trafficMap[formattedDate].paid += users;
            else trafficMap[formattedDate].other += users;
        });

        // 기기별 파싱 (날짜별)
        const deviceMap = {};
        (deviceData?.rows || []).forEach(row => {
            const dateRaw = row.dimensionValues[0].value;
            const formattedDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
            const device = row.dimensionValues[1].value.toLowerCase();
            const users = parseInt(row.metricValues[0].value) || 0;

            if (!deviceMap[formattedDate]) {
                deviceMap[formattedDate] = { desktop: 0, mobile: 0, tablet: 0 };
            }
            if (device === 'desktop') deviceMap[formattedDate].desktop += users;
            else if (device === 'mobile') deviceMap[formattedDate].mobile += users;
            else if (device === 'tablet') deviceMap[formattedDate].tablet += users;
        });

        // 인기 페이지 파싱 (날짜별 상위 5개)
        const topPagesMap = {};
        (topPagesData?.rows || []).forEach(row => {
            const dateRaw = row.dimensionValues[0].value;
            const formattedDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
            const pagePath = row.dimensionValues[1].value;
            const views = parseInt(row.metricValues[0].value) || 0;

            if (!topPagesMap[formattedDate]) topPagesMap[formattedDate] = [];
            if (topPagesMap[formattedDate].length < 5) {
                topPagesMap[formattedDate].push({ path: pagePath, views });
            }
        });

        // 국가별 파싱 (날짜별 상위 5개)
        const countriesMap = {};
        (countriesData?.rows || []).forEach(row => {
            const dateRaw = row.dimensionValues[0].value;
            const formattedDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
            const country = row.dimensionValues[1].value;
            const users = parseInt(row.metricValues[0].value) || 0;

            if (!countriesMap[formattedDate]) countriesMap[formattedDate] = [];
            if (countriesMap[formattedDate].length < 5) {
                countriesMap[formattedDate].push({ country, users });
            }
        });

        // 유입 경로 파싱 (날짜별 상위 5개)
        const referrersMap = {};
        (referrersData?.rows || []).forEach(row => {
            const dateRaw = row.dimensionValues[0].value;
            const formattedDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
            const source = row.dimensionValues[1].value;
            const users = parseInt(row.metricValues[0].value) || 0;

            if (!referrersMap[formattedDate]) referrersMap[formattedDate] = [];
            if (referrersMap[formattedDate].length < 5) {
                referrersMap[formattedDate].push({ source, users });
            }
        });

        // Airtable에 저장
        let savedCount = 0;
        let errorCount = 0;

        for (const [date, ga4] of Object.entries(ga4Map)) {
            const search = searchMap[date] || { clicks: 0, impressions: 0 };
            const traffic = trafficMap[date] || { organic: 0, direct: 0, referral: 0, social: 0, paid: 0, other: 0 };
            const device = deviceMap[date] || { desktop: 0, mobile: 0, tablet: 0 };
            const topPages = topPagesMap[date] || [];
            const countries = countriesMap[date] || [];
            const referrers = referrersMap[date] || [];
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
                // 트래픽 소스
                'sourceOrganic': traffic.organic,
                'sourceDirect': traffic.direct,
                'sourceReferral': traffic.referral,
                'sourceSocial': traffic.social,
                'sourcePaid': traffic.paid,
                'sourceOther': traffic.other,
                // 기기별
                'deviceDesktop': device.desktop,
                'deviceMobile': device.mobile,
                'deviceTablet': device.tablet,
                // JSON 데이터
                'topPages': JSON.stringify(topPages),
                'topCountries': JSON.stringify(countries),
                'topReferrers': JSON.stringify(referrers),
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
