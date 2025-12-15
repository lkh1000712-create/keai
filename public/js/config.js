// ========================================
// KEAI 설정 파일
// ========================================

const CONFIG = {
  // API Base URL
  API_BASE: '/api',

  // 관리자 비밀번호 (자동 인증용)
  ADMIN_PASSWORD: 'keai2025',

  // 브랜드 정보
  BRAND: {
    name: 'KEAI',
    fullName: '한국기업심사원',
    copyright: '© 2025 KEAI. All rights reserved.'
  }
};

// 전역 접근 가능하도록 export
window.CONFIG = CONFIG;
