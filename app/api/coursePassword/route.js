import { getCollection } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuthenticatedUser } from '@/lib/server/courseAccess';
import { AuthenticationRequiredError } from '@/lib/courseAccessPolicy.mjs';
import {
  SEA_COURSE_COOKIE_NAME,
  getSeaCourseCookieOptions,
  signSeaCourseGrant,
} from '@/lib/server/seaCourseGrant.mjs';

export async function POST(request) {
  try {
    const { userId } = await requireAuthenticatedUser();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const password = body?.password;
    if (
      typeof password !== 'string' ||
      password.length < 1 ||
      password.length > 256
    ) {
      return NextResponse.json(
        { message: 'Invalid password' },
        { status: 400 }
      );
    }

    const coursePasswordCollections = await getCollection('users');
    const coursePasswordVar = await coursePasswordCollections.findOne({
      username: 'coursePassword',
    });

    if (!coursePasswordVar) {
      return NextResponse.json(
        { message: 'Course password not found' },
        { status: 404 }
      );
    }
    const now = new Date();
    const expiresAt = new Date(coursePasswordVar.passwordExpiresAt);
    if (now > expiresAt) {
      return NextResponse.json(
        { message: 'הסיסמה פגה תוקף. קח סיסמה חדשה מהמנהל' },
        { status: 403 }
      );
    }
    const isValid = await bcrypt.compare(
      password,
      coursePasswordVar.passwordHash
    );
    if (!isValid) {
      return NextResponse.json({ message: 'סיסמה שגויה' }, { status: 401 });
    }

    const grant = signSeaCourseGrant(
      userId,
      process.env.NEXTAUTH_SECRET
    );
    const response = NextResponse.json({ success: true }, { status: 200 });

    response.cookies.set(
      SEA_COURSE_COOKIE_NAME,
      grant,
      getSeaCourseCookieOptions(process.env.NODE_ENV)
    );

    return response;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
