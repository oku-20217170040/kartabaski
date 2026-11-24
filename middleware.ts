import { NextRequest, NextResponse } from 'next/server';

// Edge runtime'da firebase-admin çalışmaz: burada yalnızca çerez varlığı kontrol edilir.
// Gerçek doğrulama (verifySessionCookie + admin rolü) server action ve API route'larında yapılır.
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const session = req.cookies.get('__session');

    if (!session?.value) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      loginUrl.search = '';
      loginUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
