/** @type {import('next').NextConfig} */
const nextConfig = {
  // 이미지 최적화 설정
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // 정적 HTML 파일 rewrites
  async rewrites() {
    return [
      // 대시보드
      { source: '/dashboard', destination: '/dashboard/index.html' },
      { source: '/dashboard/leads', destination: '/dashboard/leads.html' },
      { source: '/dashboard/board', destination: '/dashboard/board.html' },
      { source: '/dashboard/images', destination: '/dashboard/images.html' },
      { source: '/dashboard/analytics', destination: '/dashboard/analytics.html' },
      { source: '/dashboard/settings', destination: '/dashboard/settings.html' },
      // 메인 사이트
      { source: '/company', destination: '/company.html' },
      { source: '/process', destination: '/process.html' },
      { source: '/fund', destination: '/fund.html' },
      { source: '/pro', destination: '/pro.html' },
      { source: '/mkt', destination: '/mkt.html' },
      { source: '/post', destination: '/post.html' },
      { source: '/admin-login', destination: '/admin-login.html' },
    ];
  },
};

export default nextConfig;
