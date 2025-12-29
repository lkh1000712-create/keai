// Vercel Serverless API - Airtable 게시판 연동 (R2 캐시 지원)
// GET /api/board - 게시글 목록 조회 (R2 캐시 우선)
// GET /api/board?id=xxx - 게시글 상세 조회 (ID)
// GET /api/board?slug=xxx - 게시글 상세 조회 (슬러그)
// GET /api/board?refresh=true - 캐시 강제 갱신
// POST /api/board - 게시글 작성 (캐시 자동 갱신)
// PUT /api/board?id=xxx - 게시글 수정 (캐시 자동 갱신)
// DELETE /api/board?id=xxx - 게시글 삭제 (캐시 자동 갱신)

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// 환경변수
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appxVw5QQ0g4JEjoR';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblvARTwWZRjnft2B';

// R2 설정
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '75123333ef4e1c6368873dd55fca00ab';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'keai';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// 캐시 설정
const CACHE_KEY = 'cache/board-posts.json';
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

// 상단 고정 게시글 ID (순서대로)
const PINNED_POST_IDS = [
    'recLU7Zu836dQIhCF',  // 1. 2026년 정책자금 4.4조원 비수도권 60%
    'recVoMO2xzDhztf3E',  // 2. 2026년 AI 혁신기업 AX 스프린트
    'recVhIjt8N0jP1UcM'   // 3. 2026년 정책자금 내비게이션
];

// 슬러그 생성 함수 (제목에서 자동 생성)
function generateSlug(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .replace(/[^\w\s가-힣-]/g, '')  // 특수문자 제거 (한글, 영문, 숫자, 하이픈, 공백만 유지)
        .replace(/\s+/g, '-')           // 공백을 하이픈으로
        .replace(/-+/g, '-')            // 연속 하이픈 제거
        .replace(/^-|-$/g, '')          // 앞뒤 하이픈 제거
        .substring(0, 80);              // 최대 80자
}

// R2 클라이언트
function getR2Client() {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
    return new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY
        }
    });
}

// R2에서 캐시 읽기
async function getCacheFromR2() {
    const r2 = getR2Client();
    if (!r2) return null;

    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: CACHE_KEY
        });
        const response = await r2.send(command);
        const bodyString = await response.Body.transformToString();
        const cache = JSON.parse(bodyString);

        // TTL 확인
        if (cache.timestamp && Date.now() - cache.timestamp < CACHE_TTL) {
            console.log('✅ R2 캐시 히트');
            return cache.posts;
        }
        console.log('⏰ R2 캐시 만료');
        return null;
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            console.log('📭 R2 캐시 없음');
        } else {
            console.error('R2 캐시 읽기 실패:', error.message);
        }
        return null;
    }
}

// R2에 캐시 저장
async function saveCacheToR2(posts) {
    const r2 = getR2Client();
    if (!r2) return false;

    try {
        const cacheData = {
            timestamp: Date.now(),
            posts: posts
        };
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: CACHE_KEY,
            Body: JSON.stringify(cacheData),
            ContentType: 'application/json',
            CacheControl: 'public, max-age=300' // 5분
        });
        await r2.send(command);
        console.log('💾 R2 캐시 저장 완료');
        return true;
    } catch (error) {
        console.error('R2 캐시 저장 실패:', error.message);
        return false;
    }
}

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id, slug, refresh } = req.query;

    try {
        // GET - 조회
        if (req.method === 'GET') {
            // 슬러그로 조회
            if (slug) {
                const post = await getPostBySlug(slug);
                if (!post) {
                    return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다' });
                }
                await incrementViews(post.id, post.조회수 || 0);
                return res.status(200).json({ success: true, post });
            }

            // ID로 조회
            if (id) {
                // 단일 게시글 조회 (캐시 미사용)
                const post = await getPostById(id);
                if (!post) {
                    return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다' });
                }
                await incrementViews(id, post.조회수 || 0);
                return res.status(200).json({ success: true, post });
            } else {
                // 목록 조회 - R2 캐시 우선
                let posts = null;

                // 강제 갱신이 아닌 경우 캐시 확인
                if (refresh !== 'true') {
                    posts = await getCacheFromR2();
                }

                // 캐시 미스 → Airtable에서 가져오기
                if (!posts) {
                    console.log('🔄 Airtable에서 데이터 로드');
                    posts = await getAllPosts();

                    // 캐시 저장 (비동기)
                    saveCacheToR2(posts).catch(e => console.error('캐시 저장 에러:', e));
                }

                return res.status(200).json({ success: true, posts, cached: !!posts });
            }
        }

        // POST - 작성
        if (req.method === 'POST') {
            const data = req.body;
            const newPost = await createPost(data);

            // 캐시 갱신 (비동기)
            refreshCache().catch(e => console.error('캐시 갱신 에러:', e));

            return res.status(201).json({ success: true, post: newPost });
        }

        // PUT - 수정
        if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }
            const data = req.body;
            const updatedPost = await updatePost(id, data);

            // 캐시 갱신 (비동기)
            refreshCache().catch(e => console.error('캐시 갱신 에러:', e));

            return res.status(200).json({ success: true, post: updatedPost });
        }

        // DELETE - 삭제
        if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }
            await deletePost(id);

            // 캐시 갱신 (비동기)
            refreshCache().catch(e => console.error('캐시 갱신 에러:', e));

            return res.status(200).json({ success: true, message: '삭제되었습니다' });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error('Airtable API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// 모든 게시글 조회 (공개여부 = true만)
async function getAllPosts() {
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

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 게시글 매핑 (슬러그 추가)
    const allPosts = data.records.map(record => {
        const title = record.fields['제목'] || '';
        return {
            id: record.id,
            제목: title,
            내용: record.fields['내용'] || '',
            요약: record.fields['요약'] || '',
            카테고리: record.fields['카테고리'] || '공지',
            썸네일: record.fields['썸네일'] || null,
            작성일: record.fields['작성일'] || null,
            조회수: record.fields['조회수'] || 0,
            슬러그: generateSlug(title),
            고정: PINNED_POST_IDS.includes(record.id)
        };
    });

    // 상단 고정 게시글 정렬 (고정 게시글을 먼저, 고정 순서대로)
    const pinnedPosts = PINNED_POST_IDS
        .map(id => allPosts.find(p => p.id === id))
        .filter(Boolean);

    const regularPosts = allPosts.filter(p => !PINNED_POST_IDS.includes(p.id));

    return [...pinnedPosts, ...regularPosts];
}

// 단일 게시글 조회
async function getPostById(id) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${id}`;

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

    // 공개여부 확인
    if (!record.fields['공개여부']) {
        return null;
    }

    const title = record.fields['제목'] || '';
    return {
        id: record.id,
        제목: title,
        내용: record.fields['내용'] || '',
        요약: record.fields['요약'] || '',
        카테고리: record.fields['카테고리'] || '공지',
        썸네일: record.fields['썸네일'] || null,
        작성일: record.fields['작성일'] || null,
        조회수: record.fields['조회수'] || 0,
        슬러그: generateSlug(title),
        고정: PINNED_POST_IDS.includes(record.id)
    };
}

// 슬러그로 게시글 조회 (모든 게시글에서 검색)
async function getPostBySlug(slug) {
    // 모든 게시글 가져오기
    const posts = await getAllPosts();

    // 슬러그 일치 검색
    const post = posts.find(p => p.슬러그 === slug);

    return post || null;
}

// 조회수 증가
async function incrementViews(id, currentViews) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${id}`;

    try {
        await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    '조회수': (currentViews || 0) + 1
                }
            })
        });
    } catch (error) {
        console.error('조회수 증가 실패:', error);
    }
}

// 게시글 작성
async function createPost(data) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

    const fields = {
        '제목': data.제목 || '',
        '내용': data.내용 || '',
        '요약': data.요약 || '',
        '카테고리': data.카테고리 || '공지',
        '작성일': data.작성일 || new Date().toISOString().split('T')[0],
        '조회수': 0,
        '공개여부': data.공개여부 !== false
    };

    // 썸네일 URL이 있으면 추가
    if (data.썸네일) {
        fields['썸네일URL'] = data.썸네일;
    }

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
        제목: record.fields['제목'] || '',
        내용: record.fields['내용'] || '',
        요약: record.fields['요약'] || '',
        카테고리: record.fields['카테고리'] || '공지',
        작성일: record.fields['작성일'] || null,
        조회수: record.fields['조회수'] || 0
    };
}

// 게시글 수정
async function updatePost(id, data) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${id}`;

    const fields = {};

    if (data.제목 !== undefined) fields['제목'] = data.제목;
    if (data.내용 !== undefined) fields['내용'] = data.내용;
    if (data.요약 !== undefined) fields['요약'] = data.요약;
    if (data.카테고리 !== undefined) fields['카테고리'] = data.카테고리;
    if (data.공개여부 !== undefined) fields['공개여부'] = data.공개여부;
    if (data.썸네일 !== undefined) fields['썸네일URL'] = data.썸네일;

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
        제목: record.fields['제목'] || '',
        내용: record.fields['내용'] || '',
        요약: record.fields['요약'] || '',
        카테고리: record.fields['카테고리'] || '공지',
        작성일: record.fields['작성일'] || null,
        조회수: record.fields['조회수'] || 0
    };
}

// 게시글 삭제
async function deletePost(id) {
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

// 캐시 갱신 (Airtable에서 최신 데이터를 가져와 R2에 저장)
async function refreshCache() {
    console.log('🔄 캐시 갱신 시작...');
    const posts = await getAllPosts();
    await saveCacheToR2(posts);
    console.log('✅ 캐시 갱신 완료');
    return posts;
}

// 외부에서 캐시 갱신 호출용 (generate-post.js에서 사용)
export { refreshCache, saveCacheToR2 };
