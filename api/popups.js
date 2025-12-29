// Vercel Serverless API - 팝업 관리 + R2 이미지 업로드
// WebP 자동 변환 + 100KB 압축
// GET /api/popups - 활성 팝업 목록 (공개)
// GET /api/popups?all=true - 전체 팝업 목록 (관리자)
// POST /api/popups - 팝업 등록
// PUT /api/popups?id=xxx - 팝업 수정
// DELETE /api/popups?id=xxx - 팝업 삭제
// POST /api/popups?action=upload - 이미지 업로드

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// 환경변수 안전하게 읽기
function getEnv(key, defaultValue = '') {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.trim().replace(/[\r\n]/g, '');
}

// 환경 변수
const R2_ACCOUNT_ID = getEnv('R2_ACCOUNT_ID');
const R2_ACCESS_KEY_ID = getEnv('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = getEnv('R2_SECRET_ACCESS_KEY');
const R2_BUCKET_NAME = getEnv('R2_BUCKET_NAME', 'keai');
const R2_PUBLIC_URL = getEnv('R2_PUBLIC_URL') || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;

// Airtable 설정
const AIRTABLE_TOKEN = getEnv('AIRTABLE_TOKEN');
const AIRTABLE_BASE_ID = getEnv('AIRTABLE_BASE_ID', 'appxVw5QQ0g4JEjoR');
const AIRTABLE_TABLE_ID = 'tblS5O4LN5C7L9Km7'; // 팝업 테이블

// 최대 파일 크기
const MAX_FILE_SIZE = 100 * 1024; // 100KB

// S3 클라이언트 생성 (R2 호환)
function getS3Client() {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw new Error('R2 credentials not configured');
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY
        }
    });
}

// 날짜 포맷 (YYYY-MM-DD)
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '5mb'
        }
    }
};

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id, all, action } = req.query;

    try {
        // 이미지 업로드
        if (req.method === 'POST' && action === 'upload') {
            return await handleImageUpload(req, res);
        }

        // GET - 조회
        if (req.method === 'GET') {
            if (all === 'true') {
                // 관리자용 전체 목록
                const popups = await getAllPopups();
                return res.status(200).json({ success: true, popups });
            } else {
                // 공개용 활성 팝업만
                const popups = await getActivePopups();
                return res.status(200).json({ success: true, popups });
            }
        }

        // POST - 등록
        if (req.method === 'POST') {
            const data = req.body;
            const newPopup = await createPopup(data);
            return res.status(201).json({ success: true, popup: newPopup });
        }

        // PUT - 수정
        if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }
            const data = req.body;
            const updatedPopup = await updatePopup(id, data);
            return res.status(200).json({ success: true, popup: updatedPopup });
        }

        // DELETE - 삭제
        if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }
            await deletePopup(id);
            return res.status(200).json({ success: true, message: '삭제되었습니다' });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error('Popups API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// 활성 팝업 조회 (공개용 - 날짜 필터링 적용)
async function getActivePopups() {
    const today = formatDate(new Date());

    // 활성화된 팝업만 조회 + 날짜 필터링
    const filterFormula = encodeURIComponent(
        `AND({isActive}=TRUE(),OR({startDate}='',{startDate}<='${today}'),OR({endDate}='',{endDate}>='${today}'))`
    );

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${filterFormula}&sort[0][field]=order&sort[0][direction]=asc&maxRecords=8`;

    const response = await fetch(url, {
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

    return data.records.map(record => ({
        id: record.id,
        title: record.fields['title'] || '',
        imageUrl: record.fields['imageUrl'] || '',
        linkUrl: record.fields['linkUrl'] || '',
        linkTarget: record.fields['linkTarget'] || '_self',
        order: record.fields['order'] || 0,
        altText: record.fields['altText'] || ''
    }));
}

// 전체 팝업 조회 (관리자용)
async function getAllPopups() {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?sort[0][field]=order&sort[0][direction]=asc`;

    const response = await fetch(url, {
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

    return data.records.map(record => ({
        id: record.id,
        title: record.fields['title'] || '',
        imageUrl: record.fields['imageUrl'] || '',
        linkUrl: record.fields['linkUrl'] || '',
        linkTarget: record.fields['linkTarget'] || '_self',
        order: record.fields['order'] || 0,
        isActive: record.fields['isActive'] || false,
        startDate: record.fields['startDate'] || '',
        endDate: record.fields['endDate'] || '',
        altText: record.fields['altText'] || '',
        createdTime: record.createdTime
    }));
}

// 팝업 생성
async function createPopup(data) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

    const fields = {
        'title': data.title || '',
        'imageUrl': data.imageUrl || '',
        'linkUrl': data.linkUrl || '',
        'linkTarget': data.linkTarget || '_self',
        'order': data.order || 1,
        'isActive': data.isActive !== false,
        'altText': data.altText || ''
    };

    // 날짜 필드는 값이 있을 때만 추가
    if (data.startDate) fields['startDate'] = data.startDate;
    if (data.endDate) fields['endDate'] = data.endDate;

    const response = await fetch(url, {
        method: 'POST',
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
        ...fields,
        createdTime: record.createdTime
    };
}

// 팝업 수정
async function updatePopup(id, data) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${id}`;

    const fields = {};

    if (data.title !== undefined) fields['title'] = data.title;
    if (data.imageUrl !== undefined) fields['imageUrl'] = data.imageUrl;
    if (data.linkUrl !== undefined) fields['linkUrl'] = data.linkUrl;
    if (data.linkTarget !== undefined) fields['linkTarget'] = data.linkTarget;
    if (data.order !== undefined) fields['order'] = data.order;
    if (data.isActive !== undefined) fields['isActive'] = data.isActive;
    if (data.startDate !== undefined) fields['startDate'] = data.startDate || null;
    if (data.endDate !== undefined) fields['endDate'] = data.endDate || null;
    if (data.altText !== undefined) fields['altText'] = data.altText;

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
        title: record.fields['title'] || '',
        imageUrl: record.fields['imageUrl'] || '',
        linkUrl: record.fields['linkUrl'] || '',
        linkTarget: record.fields['linkTarget'] || '_self',
        order: record.fields['order'] || 0,
        isActive: record.fields['isActive'] || false,
        startDate: record.fields['startDate'] || '',
        endDate: record.fields['endDate'] || '',
        altText: record.fields['altText'] || ''
    };
}

// 팝업 삭제
async function deletePopup(id) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${id}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API Error: ${response.status} - ${errorText}`);
    }

    return true;
}

// 이미지 업로드 핸들러
async function handleImageUpload(req, res) {
    try {
        const { imageData, fileName } = req.body;

        if (!imageData) {
            return res.status(400).json({ success: false, error: '이미지 데이터가 필요합니다' });
        }

        // Base64 데이터 디코딩
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // 파일 크기 확인
        if (buffer.length > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: '파일 크기는 5MB 이하여야 합니다' });
        }

        // 파일명 생성
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const finalFileName = `popup-${timestamp}-${randomStr}.webp`;

        // R2 업로드
        const s3Client = getS3Client();

        await s3Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: `popups/${finalFileName}`,
            Body: buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000'
        }));

        const imageUrl = `${R2_PUBLIC_URL}/popups/${finalFileName}`;

        return res.status(200).json({
            success: true,
            url: imageUrl,
            fileName: finalFileName,
            size: buffer.length
        });

    } catch (error) {
        console.error('Image upload error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
