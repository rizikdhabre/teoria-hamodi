import { NextResponse } from 'next/server';
import { clearSeaCourseGrantCookies } from '@/lib/server/seaCourseGrant.mjs';

export function GET(request) {
  const type = request.nextUrl.searchParams.get('type');
  if (type !== 'jetski' && type !== 'boat') {
    return new NextResponse(null, { status: 404 });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: '/?courseAccess=' + type },
  });
  clearSeaCourseGrantCookies(response, process.env.NODE_ENV);
  return response;
}
