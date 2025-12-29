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
const ANALYTICS_TABLE_ID = 'tblvtCiOigcPRPXpY'; // Analytics 테이블 ID

// Airtable에서 방문통계 데이터 조회
async function getAnalyticsFromAirtable(startDate, endDate) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ANALYTICS_TABLE_ID}`;

    // 날짜 범위 필터
    const filterFormula = `AND(IS_AFTER({date}, '${startDate}'), IS_BEFORE({date}, '${endDate}'))`;
    const params = new URLSearchParams({
        'filterByFormula': filterFormula,
        'sort[0][field]': 'date',
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
        const { period = '30days', days, startDate: queryStartDate, endDate: queryEndDate } = req.query;

        const formatDate = (d) => d.toISOString().split('T')[0];

        let startDateStr, endDateStr;

        // 직접 날짜 지정이 있으면 사용, 없으면 period/days 기반 계산
        if (queryStartDate && queryEndDate) {
            // 직접 날짜 지정
            const start = new Date(queryStartDate);
            start.setDate(start.getDate() - 1); // 필터 조건이 IS_AFTER이므로 하루 전
            startDateStr = formatDate(start);
            endDateStr = queryEndDate;
        } else if (days) {
            // days 파라미터 (analytics.html 호환)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - parseInt(days));
            startDate.setDate(startDate.getDate() - 1); // IS_AFTER 보정
            startDateStr = formatDate(startDate);
            endDateStr = formatDate(endDate);
        } else {
            // period 기반 계산
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

            startDateStr = formatDate(startDate);
            endDateStr = formatDate(endDate);
        }

        // Airtable에서 데이터 조회
        const records = await getAnalyticsFromAirtable(startDateStr, endDateStr);

        // 데이터 파싱 (analytics.html과 호환되는 형식)
        const dailyData = records.map(record => ({
            date: record.fields['date'] || '',  // YYYY-MM-DD 형식 유지
            visitors: record.fields['visitors'] || 0,
            pageviews: record.fields['pageviews'] || 0,
            avg_duration: record.fields['avgDuration'] || 0,  // analytics.html 호환
            bounce_rate: record.fields['sessions'] > 0
                ? (1 - (record.fields['pageviews'] / record.fields['sessions']))
                : 0,  // 이탈률 계산
            sessions: record.fields['sessions'] || 0,
            leads: record.fields['leads'] || 0,
            clicks: record.fields['clicks'] || 0,
            impressions: record.fields['impressions'] || 0,
            // 트래픽 소스
            sourceOrganic: record.fields['sourceOrganic'] || 0,
            sourceDirect: record.fields['sourceDirect'] || 0,
            sourceReferral: record.fields['sourceReferral'] || 0,
            sourceSocial: record.fields['sourceSocial'] || 0,
            sourcePaid: record.fields['sourcePaid'] || 0,
            sourceOther: record.fields['sourceOther'] || 0,
            // 기기별
            deviceDesktop: record.fields['deviceDesktop'] || 0,
            deviceMobile: record.fields['deviceMobile'] || 0,
            deviceTablet: record.fields['deviceTablet'] || 0,
            // JSON 데이터 (문자열로 유지)
            topPages: record.fields['topPages'] || '[]',
            topCountries: record.fields['topCountries'] || '[]',
            topReferrers: record.fields['topReferrers'] || '[]',
        }));

        // JSON 안전 파싱 함수
        function safeJsonParse(str) {
            if (!str) return [];
            try {
                return JSON.parse(str);
            } catch {
                return [];
            }
        }

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
            // 트래픽 소스 합계
            sourceOrganic: dailyData.reduce((sum, d) => sum + d.sourceOrganic, 0),
            sourceDirect: dailyData.reduce((sum, d) => sum + d.sourceDirect, 0),
            sourceReferral: dailyData.reduce((sum, d) => sum + d.sourceReferral, 0),
            sourceSocial: dailyData.reduce((sum, d) => sum + d.sourceSocial, 0),
            sourcePaid: dailyData.reduce((sum, d) => sum + d.sourcePaid, 0),
            sourceOther: dailyData.reduce((sum, d) => sum + d.sourceOther, 0),
            // 기기별 합계
            deviceDesktop: dailyData.reduce((sum, d) => sum + d.deviceDesktop, 0),
            deviceMobile: dailyData.reduce((sum, d) => sum + d.deviceMobile, 0),
            deviceTablet: dailyData.reduce((sum, d) => sum + d.deviceTablet, 0),
        };

        // 인기 페이지 집계 (전체 기간)
        const pageViewsMap = {};
        dailyData.forEach(d => {
            const pages = safeJsonParse(d.topPages);
            pages.forEach(p => {
                if (!pageViewsMap[p.path]) pageViewsMap[p.path] = 0;
                pageViewsMap[p.path] += p.views;
            });
        });
        const aggregatedTopPages = Object.entries(pageViewsMap)
            .map(([path, views]) => ({ path, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);

        // 국가별 집계 (전체 기간)
        const countryMap = {};
        dailyData.forEach(d => {
            const countries = safeJsonParse(d.topCountries);
            countries.forEach(c => {
                if (!countryMap[c.country]) countryMap[c.country] = 0;
                countryMap[c.country] += c.users;
            });
        });
        const aggregatedTopCountries = Object.entries(countryMap)
            .map(([country, users]) => ({ country, users }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 10);

        // 유입 경로 집계 (전체 기간)
        const referrerMap = {};
        dailyData.forEach(d => {
            const referrers = safeJsonParse(d.topReferrers);
            referrers.forEach(r => {
                if (!referrerMap[r.source]) referrerMap[r.source] = 0;
                referrerMap[r.source] += r.users;
            });
        });
        const aggregatedTopReferrers = Object.entries(referrerMap)
            .map(([source, users]) => ({ source, users }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 10);

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
            data: dailyData,  // analytics.html 호환 (result.data)
            dailyData,        // 기존 호환성 유지
            searchData,
            // 집계 데이터
            topPages: aggregatedTopPages,
            topCountries: aggregatedTopCountries,
            topReferrers: aggregatedTopReferrers,
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
