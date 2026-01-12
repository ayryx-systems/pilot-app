import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VALID_CODES = process.env.ACCESS_CODES?.split(',') || [];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Allow health check, API routes, and static assets
  if (
    path.startsWith('/api/') || 
    path === '/health' ||
    path.startsWith('/_next/') ||
    path.startsWith('/static/') ||
    path === '/favicon.ico' ||
    path === '/manifest.json' ||
    path.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }
  
  // Extract code from URL: /[CODE]
  const pathParts = path.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    const code = pathParts[0];
    
    if (VALID_CODES.includes(code)) {
      // Valid code - set cookie and redirect to home page
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.set('access_code', code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      return response;
    }
  }
  
  // Check existing cookie
  const cookieCode = request.cookies.get('access_code');
  if (cookieCode && VALID_CODES.includes(cookieCode.value)) {
    return NextResponse.next();
  }
  
  // Deny access with a simple message
  return new NextResponse(
    '<html><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5;">' +
    '<div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">' +
    '<h1 style="color: #333; margin-bottom: 1rem;">Access Denied</h1>' +
    '<p style="color: #666;">Invalid or missing access code. Please use the correct URL provided to you.</p>' +
    '</div></body></html>',
    { 
      status: 403,
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
}

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)'],
};

