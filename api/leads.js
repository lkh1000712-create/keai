// Vercel Serverless API - Airtable 고객정보 연동
// GET /api/leads - 접수 내역 조회
// GET /api/leads?id=xxx - 상세 조회
// PUT /api/leads?id=xxx - 상태 업데이트

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appxVw5QQ0g4JEjoR';
const AIRTABLE_TABLE_NAME = '한국기업심사원';

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    try {
        // GET - 조회
        if (req.method === 'GET') {
            if (id) {
                const lead = await getLeadById(id);
                if (!lead) {
                    return res.status(404).json({ success: false, error: '접수 내역을 찾을 수 없습니다' });
                }
                return res.status(200).json({ success: true, lead });
            } else {
                const leads = await getAllLeads();
                return res.status(200).json({ success: true, leads });
            }
        }

        // PUT - 상태 업데이트
        if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }
            const data = req.body;
            const updatedLead = await updateLead(id, data);
            return res.status(200).json({ success: true, lead: updatedLead });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error('Airtable API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// 모든 접수 내역 조회
async function getAllLeads() {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    const params = new URLSearchParams({
        'maxRecords': '100'
    });

    const response = await fetch(`${url}?${params}`, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 디버그: 첫 번째 레코드의 필드명 확인
    if (data.records.length > 0) {
        console.log('Available fields:', Object.keys(data.records[0].fields));
    }

    return data.records.map(record => ({
        id: record.id,
        기업명: record.fields['기업명'] || '',
        사업자번호: record.fields['사업자번호'] || '',
        대표자명: record.fields['대표자명'] || '',
        연락처: record.fields['연락처'] || '',
        이메일: record.fields['이메일'] || '',
        업종: record.fields['업종'] || '',
        설립연도: record.fields['설립연도'] || '',
        통화가능시간: record.fields['통화가능시간'] || '',
        필요자금규모: record.fields['필요자금규모'] || '',
        자금종류: record.fields['자금종류'] || [],
        문의사항: record.fields['문의사항'] || '',
        상태: record.fields['상태'] || '신규',
        접수일: record.createdTime
    }));
}

// 단일 접수 내역 조회
async function getLeadById(id) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${id}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        const errorText = await response.text();
        throw new Error(`Airtable API Error: ${response.status} - ${errorText}`);
    }

    const record = await response.json();

    return {
        id: record.id,
        기업명: record.fields['기업명'] || '',
        사업자번호: record.fields['사업자번호'] || '',
        대표자명: record.fields['대표자명'] || '',
        연락처: record.fields['연락처'] || '',
        이메일: record.fields['이메일'] || '',
        업종: record.fields['업종'] || '',
        설립연도: record.fields['설립연도'] || '',
        통화가능시간: record.fields['통화가능시간'] || '',
        필요자금규모: record.fields['필요자금규모'] || '',
        자금종류: record.fields['자금종류'] || [],
        문의사항: record.fields['문의사항'] || '',
        상태: record.fields['상태'] || '신규',
        접수일: record.createdTime
    };
}

// 접수 내역 업데이트 (상태 변경 등)
async function updateLead(id, data) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${id}`;

    const fields = {};
    if (data.상태 !== undefined) fields['상태'] = data.상태;
    if (data.메모 !== undefined) fields['메모'] = data.메모;

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API Error: ${response.status} - ${errorText}`);
    }

    const record = await response.json();

    return {
        id: record.id,
        기업명: record.fields['기업명'] || '',
        상태: record.fields['상태'] || '신규'
    };
}
