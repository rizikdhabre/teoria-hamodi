import { getCollection } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Check for null / undefined / empty strings
    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    }

    const usersCollection = await getCollection('users');
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';

      return NextResponse.json(
        { error: `${field} already in use` },
        { status: 409 }
      );
    }
    //hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      username,
      email,
      passwordHash: hashedPassword,
      createdAt: new Date(),
      provider: 'local',
      role: 'user',
    };
    await usersCollection.insertOne(newUser);

    return NextResponse.json(
      { message: 'User created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error during user signup:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
