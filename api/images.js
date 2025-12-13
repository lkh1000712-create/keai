// Vercel Serverless API - Cloudflare R2 이미지 관리
// WebP 자동 변환 + 300KB 압축
// GET /api/images - 이미지 목록 조회
// GET /api/images?id=xxx - 특정 이미지 조회
// POST /api/images - 이미지 업로드 (WebP 변환 후 R2 직접 업로드)
// PUT /api/images?id=xxx - 이미지 URL 업데이트

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// 환경변수 안전하게 읽기 (줄바꿈/공백 제거)
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

// Airtable 설정 (환경변수 필수)
const AIRTABLE_TOKEN = getEnv('AIRTABLE_TOKEN');
const AIRTABLE_BASE_ID = getEnv('AIRTABLE_BASE_ID');
const AIRTABLE_TABLE_NAME = '이미지설정';

// 관리자 비밀번호
const ADMIN_PASSWORD = getEnv('ADMIN_PASSWORD', 'keai2025');

// 최대 파일 크기
const MAX_FILE_SIZE = 300 * 1024; // 300KB

// ============================================
// 전체 이미지 정의 (35개)
// ============================================
const IMAGE_DEFINITIONS = [
    // === 공통 요소 (6개) ===
    { id: 'logo', name: '헤더 로고', category: '공통', recommendedSize: '200x60', pages: ['전체'], cssSelector: '.keai-logo-image' },
    { id: 'logo-white', name: '푸터 로고 (흰색)', category: '공통', recommendedSize: '200x60', pages: ['전체'], cssSelector: '.keai-footer-logo-image' },
    { id: 'favicon', name: '파비콘', category: '공통', recommendedSize: '32x32', pages: ['전체'], cssSelector: 'link[rel="icon"]' },
    { id: 'ceo-profile', name: '대표자 프로필', category: '공통', recommendedSize: '600x600', pages: ['company.html'], cssSelector: '.keai-ceo-profile img' },
    { id: 'form-image', name: '상담 폼 이미지', category: '공통', recommendedSize: '800x1000', pages: ['index.html', 'company.html', 'process.html', 'fund.html', 'pro.html'], cssSelector: '.keai-contact-image img' },
    { id: 'partnership-icon', name: '업무협약 아이콘', category: '공통', recommendedSize: '80x80', pages: ['전체'], cssSelector: '.keai-partnership-icon' },

    // === 홈 (index.html) - 4개 ===
    { id: 'hero-home', name: '홈 히어로 배경', category: '홈', recommendedSize: '1920x1080', pages: ['index.html'], cssSelector: '.keai-hero', cssProperty: 'background-image' },
    { id: 'home-service-icon-1', name: '홈 서비스 아이콘 1', category: '홈', recommendedSize: '120x120', pages: ['index.html'], description: '1:1 전문가 상담' },
    { id: 'home-service-icon-2', name: '홈 서비스 아이콘 2', category: '홈', recommendedSize: '120x120', pages: ['index.html'], description: '맞춤형 자금 설계' },
    { id: 'home-service-icon-3', name: '홈 서비스 아이콘 3', category: '홈', recommendedSize: '120x120', pages: ['index.html'], description: '사후 관리 지원' },

    // === 회사소개 (company.html) - 4개 ===
    { id: 'company-card-1', name: '서비스 카드 1', category: '회사소개', recommendedSize: '400x300', pages: ['company.html'], description: '자금확보 역량 파악' },
    { id: 'company-card-2', name: '서비스 카드 2', category: '회사소개', recommendedSize: '400x300', pages: ['company.html'], description: '맞춤형 자금조달 전략' },
    { id: 'company-card-3', name: '서비스 카드 3', category: '회사소개', recommendedSize: '400x300', pages: ['company.html'], description: '신청서류 준비 가이드' },
    { id: 'company-card-4', name: '서비스 카드 4', category: '회사소개', recommendedSize: '400x300', pages: ['company.html'], description: '확보 후 사후관리 지원' },

    // === 진행과정 (process.html) - 7개 ===
    { id: 'hero-process', name: '진행과정 히어로 배경', category: '진행과정', recommendedSize: '1920x1080', pages: ['process.html'], cssSelector: '.keai-hero', cssProperty: 'background-image' },
    { id: 'partner-seoul', name: '서울신용보증재단', category: '진행과정', recommendedSize: '200x80', pages: ['process.html'], description: '협력기관 로고' },
    { id: 'partner-gyeonggi', name: '경기신용보증재단', category: '진행과정', recommendedSize: '200x80', pages: ['process.html'], description: '협력기관 로고' },
    { id: 'partner-kosme', name: '중소벤처기업진흥공단', category: '진행과정', recommendedSize: '200x80', pages: ['process.html'], description: '협력기관 로고' },
    { id: 'partner-kodit', name: '신용보증기금', category: '진행과정', recommendedSize: '200x80', pages: ['process.html'], description: '협력기관 로고' },
    { id: 'partner-kibo', name: '기술보증기금', category: '진행과정', recommendedSize: '200x80', pages: ['process.html'], description: '협력기관 로고' },
    { id: 'partner-semas', name: '소상공인진흥공단', category: '진행과정', recommendedSize: '200x80', pages: ['process.html'], description: '협력기관 로고' },

    // === 자금상담 (fund.html) - 3개 ===
    { id: 'hero-fund', name: '자금상담 히어로 배경', category: '자금상담', recommendedSize: '1920x1080', pages: ['fund.html'], cssSelector: '.keai-hero', cssProperty: 'background-image' },
    { id: 'fund-cta-bg', name: '자금상담 CTA 배경', category: '자금상담', recommendedSize: '1920x600', pages: ['fund.html'], cssSelector: '.keai-cta-section', cssProperty: 'background-image' },
    { id: 'fund-process-bg', name: '자금상담 진행과정 배경', category: '자금상담', recommendedSize: '1920x800', pages: ['fund.html'], cssSelector: '.keai-process-section', cssProperty: 'background-image' },

    // === 전문서비스 (pro.html) - 6개 ===
    { id: 'hero-pro', name: '전문서비스 히어로 배경', category: '전문서비스', recommendedSize: '1920x1080', pages: ['pro.html'], cssSelector: '.keai-hero', cssProperty: 'background-image' },
    { id: 'pro-section-bg', name: '전문서비스 섹션 배경', category: '전문서비스', recommendedSize: '1920x800', pages: ['pro.html'], cssSelector: '.keai-pro-section', cssProperty: 'background-image' },
    { id: 'pro-icon-1', name: '전문서비스 아이콘 1', category: '전문서비스', recommendedSize: '120x120', pages: ['pro.html'] },
    { id: 'pro-icon-2', name: '전문서비스 아이콘 2', category: '전문서비스', recommendedSize: '120x120', pages: ['pro.html'] },
    { id: 'pro-icon-3', name: '전문서비스 아이콘 3', category: '전문서비스', recommendedSize: '120x120', pages: ['pro.html'] },
    { id: 'pro-icon-4', name: '전문서비스 아이콘 4', category: '전문서비스', recommendedSize: '120x120', pages: ['pro.html'] },

    // === 온라인마케팅 (mkt.html) - 2개 ===
    { id: 'hero-mkt', name: '마케팅 히어로 배경', category: '마케팅', recommendedSize: '1920x1080', pages: ['mkt.html'], cssSelector: '.keai-hero', cssProperty: 'background-image' },
    { id: 'mkt-process-graph', name: '마케팅 진행 그래프', category: '마케팅', recommendedSize: '1200x600', pages: ['mkt.html'] },

    // === OG 이미지 (6개) ===
    { id: 'og-home', name: 'OG 이미지 - 홈', category: 'OG이미지', recommendedSize: '1200x630', pages: ['index.html'], metaTag: 'og:image' },
    { id: 'og-company', name: 'OG 이미지 - 회사소개', category: 'OG이미지', recommendedSize: '1200x630', pages: ['company.html'], metaTag: 'og:image' },
    { id: 'og-process', name: 'OG 이미지 - 진행과정', category: 'OG이미지', recommendedSize: '1200x630', pages: ['process.html'], metaTag: 'og:image' },
    { id: 'og-fund', name: 'OG 이미지 - 자금상담', category: 'OG이미지', recommendedSize: '1200x630', pages: ['fund.html'], metaTag: 'og:image' },
    { id: 'og-pro', name: 'OG 이미지 - 전문서비스', category: 'OG이미지', recommendedSize: '1200x630', pages: ['pro.html'], metaTag: 'og:image' },
    { id: 'og-mkt', name: 'OG 이미지 - 마케팅', category: 'OG이미지', recommendedSize: '1200x630', pages: ['mkt.html'], metaTag: 'og:image' }
];

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

// 인증 확인
function checkAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;

    const [type, password] = authHeader.split(' ');
    if (type !== 'Bearer') return false;

    return password === ADMIN_PASSWORD;
}

// 이미지 MIME 타입 감지
function detectMimeType(base64Data) {
    if (base64Data.startsWith('/9j/')) return 'image/jpeg';
    if (base64Data.startsWith('iVBORw')) return 'image/png';
    if (base64Data.startsWith('UklGR')) return 'image/webp';
    if (base64Data.startsWith('R0lGOD')) return 'image/gif';
    return 'image/webp'; // 기본값
}

// R2에 직접 업로드
async function uploadToR2(buffer, key, contentType = 'image/webp') {
    const s3Client = getS3Client();

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000'
    });

    await s3Client.send(command);

    // Public URL 반환
    return `${R2_PUBLIC_URL}/${key}`;
}

// Vercel API config
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
};

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id, action, category } = req.query;

    try {
        // GET - 이미지 목록/상세 조회 (인증 불필요)
        if (req.method === 'GET') {
            // R2 설정 상태 확인
            if (action === 'status') {
                const configured = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
                return res.status(200).json({
                    success: true,
                    configured,
                    bucketName: R2_BUCKET_NAME
                });
            }

            // 카테고리별 필터링
            if (category) {
                const filtered = IMAGE_DEFINITIONS.filter(d => d.category === category);
                const images = await getImagesWithUrls(filtered);
                return res.status(200).json({ success: true, images, category });
            }

            // 특정 이미지 조회
            if (id) {
                const image = await getImageById(id);
                if (!image) {
                    const def = IMAGE_DEFINITIONS.find(d => d.id === id);
                    if (def) {
                        return res.status(200).json({
                            success: true,
                            image: { ...def, url: null }
                        });
                    }
                    return res.status(404).json({ success: false, error: '이미지를 찾을 수 없습니다' });
                }
                return res.status(200).json({ success: true, image });
            }

            // 전체 목록 (카테고리별 그룹화)
            const images = await getAllImages();
            const categories = [...new Set(IMAGE_DEFINITIONS.map(d => d.category))];
            const grouped = {};
            categories.forEach(cat => {
                grouped[cat] = images.filter(img => img.category === cat);
            });

            return res.status(200).json({
                success: true,
                images,
                grouped,
                categories,
                total: IMAGE_DEFINITIONS.length
            });
        }

        // 이하 메서드는 인증 필요
        if (!checkAuth(req)) {
            return res.status(401).json({ success: false, error: '인증이 필요합니다' });
        }

        // POST - 이미지 업로드 (클라이언트에서 압축된 이미지를 R2에 업로드)
        if (req.method === 'POST') {
            const { imageId, imageData, fileName, originalSize } = req.body;

            if (!imageId || !imageData) {
                return res.status(400).json({
                    success: false,
                    error: 'imageId와 imageData(base64)가 필요합니다'
                });
            }

            // 이미지 ID 유효성 검사
            const validImage = IMAGE_DEFINITIONS.find(d => d.id === imageId);
            if (!validImage) {
                return res.status(400).json({
                    success: false,
                    error: '유효하지 않은 이미지 ID입니다'
                });
            }

            // Base64 디코딩 (data URL prefix 제거)
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const compressedSize = buffer.length;

            // MIME 타입 감지
            const mimeType = detectMimeType(base64Data);
            const ext = mimeType === 'image/webp' ? 'webp' :
                        mimeType === 'image/png' ? 'png' :
                        mimeType === 'image/gif' ? 'gif' : 'jpg';

            // R2 키 생성
            const timestamp = Date.now();
            const key = `images/${imageId}/${timestamp}.${ext}`;

            // R2 업로드
            const imageUrl = await uploadToR2(buffer, key, mimeType);

            // Airtable에 URL 저장 (실패해도 계속 진행)
            let airtableError = null;
            try {
                await updateImageUrl(imageId, imageUrl);
            } catch (err) {
                console.error('Airtable save error (non-fatal):', err.message);
                airtableError = err.message;
            }

            return res.status(200).json({
                success: true,
                imageUrl,
                originalSize: originalSize || compressedSize,
                compressedSize,
                compressionRatio: originalSize ? Math.round((1 - compressedSize / originalSize) * 100) : 0,
                message: `이미지가 업로드되었습니다 (${Math.round(compressedSize / 1024)}KB)`,
                airtableError: airtableError
            });
        }

        // PUT - 이미지 URL 수동 업데이트
        if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }

            const { imageUrl } = req.body;
            if (!imageUrl) {
                return res.status(400).json({ success: false, error: 'imageUrl이 필요합니다' });
            }

            const updatedImage = await updateImageUrl(id, imageUrl);
            return res.status(200).json({ success: true, image: updatedImage });
        }

        // DELETE - 이미지 삭제
        if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }

            await deleteImage(id);
            return res.status(200).json({ success: true, message: '이미지가 삭제되었습니다' });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error('Images API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// Airtable에서 모든 이미지 조회
async function getAllImages() {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return IMAGE_DEFINITIONS.map(def => ({ ...def, url: null }));
            }
            throw new Error(`Airtable API Error: ${response.status}`);
        }

        const data = await response.json();

        return IMAGE_DEFINITIONS.map(def => {
            const record = data.records.find(r => r.fields['이미지ID'] === def.id);
            return {
                ...def,
                url: record?.fields['이미지URL'] || null,
                updatedAt: record?.fields['수정일시'] || null
            };
        });
    } catch (error) {
        console.error('Airtable fetch error:', error);
        return IMAGE_DEFINITIONS.map(def => ({ ...def, url: null }));
    }
}

// 필터된 이미지 목록에 URL 정보 추가
async function getImagesWithUrls(definitions) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return definitions.map(def => ({ ...def, url: null }));
        }

        const data = await response.json();

        return definitions.map(def => {
            const record = data.records.find(r => r.fields['이미지ID'] === def.id);
            return {
                ...def,
                url: record?.fields['이미지URL'] || null,
                updatedAt: record?.fields['수정일시'] || null
            };
        });
    } catch (error) {
        return definitions.map(def => ({ ...def, url: null }));
    }
}

// 특정 이미지 조회
async function getImageById(id) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
    const params = new URLSearchParams({
        'filterByFormula': `{이미지ID} = '${id}'`,
        'maxRecords': '1'
    });

    try {
        const response = await fetch(`${url}?${params}`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.records.length === 0) return null;

        const record = data.records[0];
        const def = IMAGE_DEFINITIONS.find(d => d.id === id);

        return {
            ...def,
            recordId: record.id,
            url: record.fields['이미지URL'] || null,
            updatedAt: record.fields['수정일시'] || null
        };
    } catch (error) {
        console.error('Airtable fetch error:', error);
        return null;
    }
}

// 이미지 URL 업데이트
async function updateImageUrl(id, imageUrl) {
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
    const existing = await getImageById(id);
    const def = IMAGE_DEFINITIONS.find(d => d.id === id);

    if (existing && existing.recordId) {
        const response = await fetch(`${baseUrl}/${existing.recordId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    '이미지URL': imageUrl,
                    '수정일시': new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Airtable update error: ${errorText}`);
        }

        const record = await response.json();
        return { ...def, recordId: record.id, url: record.fields['이미지URL'] };
    } else {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    '이미지ID': id,
                    '설명': def?.name || id,
                    '카테고리': def?.category || '기타',
                    '이미지URL': imageUrl,
                    '수정일시': new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Airtable create error: ${errorText}`);
        }

        const record = await response.json();
        return { ...def, recordId: record.id, url: record.fields['이미지URL'] };
    }
}

// 이미지 삭제
async function deleteImage(id) {
    const existing = await getImageById(id);
    if (!existing || !existing.recordId) return;

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    await fetch(`${baseUrl}/${existing.recordId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`
        }
    });
}
