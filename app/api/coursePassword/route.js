import { getCollection } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuthenticatedUser } from '@/lib/server/courseAccess';
import {
  getCoursePasswordErrorResponse,
  readCoursePassword,
} from '@/lib/coursePasswordRequest.mjs';
import {
  setSeaCourseGrantCookies,
  signSeaCourseGrant,
} from '@/lib/server/seaCourseGrant.mjs';

export async function POST(request) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const password = await readCoursePassword(request);

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

    const grant = signSeaCourseGrant(userId, process.env.NEXTAUTH_SECRET);
    const response = NextResponse.json({ success: true }, { status: 200 });

    setSeaCourseGrantCookies(response, grant, process.env.NODE_ENV);

    return response;
  } catch (error) {
    const { status, body } = getCoursePasswordErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
