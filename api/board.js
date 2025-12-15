// Vercel Serverless API - Airtable 게시판 연동
// GET /api/board - 게시글 목록 조회
// GET /api/board?id=xxx - 게시글 상세 조회
// POST /api/board - 게시글 작성
// PUT /api/board?id=xxx - 게시글 수정
// DELETE /api/board?id=xxx - 게시글 삭제

// 환경변수에서 토큰 로드 (GitHub Secret 노출 방지)
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appxVw5QQ0g4JEjoR';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblvARTwWZRjnft2B';

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    try {
        // GET - 조회
        if (req.method === 'GET') {
            if (id) {
                const post = await getPostById(id);
                if (!post) {
                    return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다' });
                }
                await incrementViews(id, post.조회수 || 0);
                return res.status(200).json({ success: true, post });
            } else {
                const posts = await getAllPosts();
                return res.status(200).json({ success: true, posts });
            }
        }

        // POST - 작성
        if (req.method === 'POST') {
            const data = req.body;
            const newPost = await createPost(data);
            return res.status(201).json({ success: true, post: newPost });
        }

        // PUT - 수정
        if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }
            const data = req.body;
            const updatedPost = await updatePost(id, data);
            return res.status(200).json({ success: true, post: updatedPost });
        }

        // DELETE - 삭제
        if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID가 필요합니다' });
            }
            await deletePost(id);
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

    return data.records.map(record => ({
        id: record.id,
        제목: record.fields['제목'] || '',
        내용: record.fields['내용'] || '',
        요약: record.fields['요약'] || '',
        카테고리: record.fields['카테고리'] || '공지',
        썸네일: record.fields['썸네일'] || null,
        작성일: record.fields['작성일'] || null,
        조회수: record.fields['조회수'] || 0
    }));
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

    return {
        id: record.id,
        제목: record.fields['제목'] || '',
        내용: record.fields['내용'] || '',
        요약: record.fields['요약'] || '',
        카테고리: record.fields['카테고리'] || '공지',
        썸네일: record.fields['썸네일'] || null,
        작성일: record.fields['작성일'] || null,
        조회수: record.fields['조회수'] || 0
    };
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
