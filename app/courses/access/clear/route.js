import { NextResponse } from 'next/server';
import {
  SEA_COURSE_COOKIE_NAME,
  getSeaCourseCookieClearOptions,
} from '@/lib/server/seaCourseGrant.mjs';

export function GET(request) {
  const type = request.nextUrl.searchParams.get('type');
  if (type !== 'jetski' && type !== 'boat') {
    return new NextResponse(null, { status: 404 });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: '/?courseAccess=' + type },
  });
  response.cookies.set(
    SEA_COURSE_COOKIE_NAME,
    '',
    getSeaCourseCookieClearOptions(process.env.NODE_ENV)
  );
  return response;
}
