// 동적 Sitemap 생성 API
// GET /api/sitemap - XML sitemap 반환

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appxVw5QQ0g4JEjoR';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblvARTwWZRjnft2B';
const SITE_URL = 'https://www.k-eai.kr';

// 슬러그 생성 함수
function generateSlug(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .replace(/[^\w\s가-힣-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80);
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Airtable에서 공개 게시글 조회
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
        const params = new URLSearchParams({
            'filterByFormula': '{공개여부} = TRUE()',
            'sort[0][field]': '작성일',
            'sort[0][direction]': 'desc',
            'maxRecords': '100'
        });

        const response = await fetch(`${url}?${params}`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        let posts = [];
        if (response.ok) {
            const data = await response.json();
            posts = data.records.map(record => ({
                slug: generateSlug(record.fields['제목'] || ''),
                date: record.fields['작성일'] || new Date().toISOString().split('T')[0]
            })).filter(p => p.slug);
        }

        // 정적 페이지
        const staticPages = [
            { loc: '/', priority: '1.0', changefreq: 'weekly' },
            { loc: '/company', priority: '0.8', changefreq: 'monthly' },
            { loc: '/process', priority: '0.9', changefreq: 'weekly' },
            { loc: '/fund', priority: '0.9', changefreq: 'weekly' },
            { loc: '/pro', priority: '0.7', changefreq: 'monthly' },
            { loc: '/mkt', priority: '0.7', changefreq: 'monthly' },
            { loc: '/board', priority: '0.8', changefreq: 'daily' }
        ];

        const today = new Date().toISOString().split('T')[0];

        // XML 생성
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

        // 정적 페이지
        for (const page of staticPages) {
            xml += `  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
        }

        // 동적 게시글
        for (const post of posts) {
            const encodedSlug = encodeURIComponent(post.slug);
            xml += `  <url>
    <loc>${SITE_URL}/p/${encodedSlug}</loc>
    <lastmod>${post.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
        }

        xml += '</urlset>';

        // XML 응답
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
        return res.status(200).send(xml);

    } catch (error) {
        console.error('Sitemap 생성 오류:', error);
        return res.status(500).json({ error: 'Sitemap 생성 실패' });
    }
}
