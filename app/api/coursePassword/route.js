import { getCollection } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { password } = await request.json();
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
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in logged to Course, error', error);

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
