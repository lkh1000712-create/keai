export default function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  // 환경변수에서 비밀번호 가져오기 (없으면 기본값 사용)
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dlrkdgml0712#';

  if (password === ADMIN_PASSWORD) {
    // 인증 성공 - 쿠키 설정 (7일 유효)
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();

    res.setHeader('Set-Cookie', [
      `admin_auth=authenticated; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`,
    ]);

    return res.status(200).json({ success: true });
  }

  // 인증 실패
  return res.status(401).json({ success: false, error: 'Invalid password' });
}
