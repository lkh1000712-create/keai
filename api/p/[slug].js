// 슬러그 URL 라우팅 - /p/:slug → /post?slug=:slug 리다이렉트
export default function handler(req, res) {
    const { slug } = req.query;

    if (!slug) {
        return res.redirect(302, '/process#board');
    }

    // 슬러그로 post 페이지 리다이렉트
    return res.redirect(302, `/post?slug=${encodeURIComponent(slug)}`);
}
