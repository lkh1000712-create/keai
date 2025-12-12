/** @type {import('next').NextConfig} */
const nextConfig = {
  // 이미지 최적화 설정
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // 정적 내보내기 (Vercel 배포 전 로컬 테스트용)
  // output: 'export',
};

export default nextConfig;
