export default function handler(req, res) {
  // 쿠키 삭제 (만료 시간을 과거로 설정)
  res.setHeader('Set-Cookie', [
    'admin_auth=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]);

  // 로그인 페이지로 리다이렉트
  res.redirect(302, '/admin-login');
}
