import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip') ?? 'unknown';
  const key = `${req.nextUrl.pathname}|${ip}`;
  const result = rateLimit(key);

  const res = NextResponse.next();
  res.headers.set('X-RateLimit-Limit', '60');
  res.headers.set('X-RateLimit-Remaining', String(result.remaining));

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'rate limited', message: 'too many requests — slow down', retryAfter: result.retryAfter },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
    );
  }
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
