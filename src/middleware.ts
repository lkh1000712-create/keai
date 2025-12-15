import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const isAdminDomain = hostname.startsWith('admin.');

  // admin 서브도메인이 아니면 통과
  if (!isAdminDomain) {
    return NextResponse.next();
  }

  // 로그인 페이지와 인증 API는 통과
  const pathname = request.nextUrl.pathname;
  if (pathname === '/admin-login' || pathname === '/api/admin-auth') {
    return NextResponse.next();
  }

  // 정적 파일은 통과
  if (pathname.startsWith('/_next') || pathname.startsWith('/css') || pathname.startsWith('/js') || pathname.startsWith('/images')) {
    return NextResponse.next();
  }

  // 인증 쿠키 확인
  const authCookie = request.cookies.get('admin_auth');

  if (!authCookie || authCookie.value !== 'authenticated') {
    // 인증되지 않으면 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/admin-login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 루트 접속 시 대시보드로 리다이렉트
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
