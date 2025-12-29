// Vercel Serverless API - Airtable 캐시에서 방문통계 읽기
// GET /api/analytics?period=30days

// 환경변수
function getEnv(key, defaultValue = '') {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.trim().replace(/[\r\n]/g, '');
}

const AIRTABLE_TOKEN = getEnv('AIRTABLE_TOKEN');
const AIRTABLE_BASE_ID = getEnv('AIRTABLE_BASE_ID', 'appxVw5QQ0g4JEjoR');
const ANALYTICS_TABLE_ID = 'tblXRK9sUVuWlPMJ7'; // 방문통계 테이블 ID

// Airtable에서 방문통계 데이터 조회
async function getAnalyticsFromAirtable(startDate, endDate) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ANALYTICS_TABLE_ID}`;

    // 날짜 범위 필터
    const filterFormula = `AND(IS_AFTER({날짜}, '${startDate}'), IS_BEFORE({날짜}, '${endDate}'))`;
    const params = new URLSearchParams({
        'filterByFormula': filterFormula,
        'sort[0][field]': '날짜',
        'sort[0][direction]': 'asc',
        'maxRecords': '365'
    });

    try {
        const response = await fetch(`${url}?${params}`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Airtable API Error:', errorText);
            return [];
        }

        const data = await response.json();
        return data.records || [];
    } catch (error) {
        console.error('Airtable fetch error:', error);
        return [];
    }
}

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { period = '30days' } = req.query;

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

        // 하루 전부터 조회 (필터 조건이 IS_AFTER이므로)
        startDate.setDate(startDate.getDate() - 1);

        const formatDate = (d) => d.toISOString().split('T')[0];
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        // Airtable에서 데이터 조회
        const records = await getAnalyticsFromAirtable(startDateStr, endDateStr);

        // 데이터 파싱
        const dailyData = records.map(record => ({
            date: (record.fields['날짜'] || '').replace(/-/g, ''),
            visitors: record.fields['방문자'] || 0,
            pageviews: record.fields['페이지뷰'] || 0,
            duration: record.fields['평균체류시간'] || 0,
            sessions: record.fields['세션수'] || 0,
            leads: record.fields['접수건수'] || 0,
            clicks: record.fields['검색클릭'] || 0,
            impressions: record.fields['검색노출'] || 0,
        }));

        // 합계 계산
        const totals = {
            visitors: dailyData.reduce((sum, d) => sum + d.visitors, 0),
            pageviews: dailyData.reduce((sum, d) => sum + d.pageviews, 0),
            avgDuration: dailyData.length > 0
                ? dailyData.reduce((sum, d) => sum + d.duration, 0) / dailyData.length
                : 0,
            sessions: dailyData.reduce((sum, d) => sum + d.sessions, 0),
            leads: dailyData.reduce((sum, d) => sum + d.leads, 0),
            clicks: dailyData.reduce((sum, d) => sum + d.clicks, 0),
            impressions: dailyData.reduce((sum, d) => sum + d.impressions, 0),
            avgCtr: dailyData.length > 0 && dailyData.reduce((sum, d) => sum + d.impressions, 0) > 0
                ? (dailyData.reduce((sum, d) => sum + d.clicks, 0) / dailyData.reduce((sum, d) => sum + d.impressions, 0)) * 100
                : 0,
        };

        // Search Console 데이터 형식
        const searchData = dailyData.map(d => ({
            date: d.date,
            clicks: d.clicks,
            impressions: d.impressions,
            ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
            position: 0,
        }));

        return res.status(200).json({
            success: true,
            period,
            startDate: formatDate(new Date(startDateStr)),
            endDate: endDateStr,
            totals,
            dailyData,
            searchData,
            source: 'airtable-cache',
            recordCount: records.length,
        });

    } catch (error) {
        console.error('Analytics API Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Unknown error',
        });
    }
}
