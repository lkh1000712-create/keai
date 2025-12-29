// Vercel Serverless API - 게시글 썸네일 업로드
// POST /api/upload-thumbnail
// Base64 이미지를 받아서 R2에 업로드

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

// 이미지 MIME 타입 감지
function detectMimeType(base64Data) {
    if (base64Data.startsWith('/9j/')) return 'image/jpeg';
    if (base64Data.startsWith('iVBORw')) return 'image/png';
    if (base64Data.startsWith('UklGR')) return 'image/webp';
    if (base64Data.startsWith('R0lGOD')) return 'image/gif';
    return 'image/webp';
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
    return `${R2_PUBLIC_URL}/${key}`;
}

// Vercel API config
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { imageData, fileName } = req.body;

        if (!imageData) {
            return res.status(400).json({
                success: false,
                error: 'imageData(base64)가 필요합니다'
            });
        }

        // Base64 디코딩 (data URL prefix 제거)
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileSize = buffer.length;

        // 5MB 제한
        if (fileSize > 5 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                error: '파일 크기가 5MB를 초과합니다'
            });
        }

        // MIME 타입 감지
        const mimeType = detectMimeType(base64Data);
        const ext = mimeType === 'image/webp' ? 'webp' :
                    mimeType === 'image/png' ? 'png' :
                    mimeType === 'image/gif' ? 'gif' : 'jpg';

        // R2 키 생성 (게시글 썸네일용)
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const key = `thumbnails/${timestamp}-${randomId}.${ext}`;

        // R2 업로드
        const imageUrl = await uploadToR2(buffer, key, mimeType);

        return res.status(200).json({
            success: true,
            url: imageUrl,
            size: fileSize,
            message: `이미지 업로드 완료 (${Math.round(fileSize / 1024)}KB)`
        });

    } catch (error) {
        console.error('Upload Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Unknown error'
        });
    }
}
