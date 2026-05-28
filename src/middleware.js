import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Case-sensitive check: only redirect if it's exactly uppercase '/TV'
  if (pathname === '/TV') {
    return NextResponse.redirect(new URL('/tv', request.url), 301);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/TV'],
};
