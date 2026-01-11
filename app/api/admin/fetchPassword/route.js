import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const SECRET = process.env.PASSWORD_SECRET;

function generatePassword() {
  const digits = ['1', '2', '3', '4', '5'];
  return Array.from(
    { length: 5 },
    () => digits[Math.floor(Math.random() * digits.length)]
  ).join('');
}

function getExpiration() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(SECRET), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decrypt(data) {
  const [ivHex, tagHex, encrypted] = data.split(':');
  const decipher = crypto.createDecipheriv(
    ALGO,
    Buffer.from(SECRET),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function POST(req) {
  try {
    const { username, pin } = await req.json();
    if (!username || !pin) {
      return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 });
    }

    if (!['admin', 'coursePassword'].includes(username)) {
      return NextResponse.json({ error: 'שם משתמש לא חוקי' }, { status: 401 });
    }

    if (pin !== process.env.STATIC_PIN) {
      return NextResponse.json({ error: 'קוד PIN שגוי' }, { status: 401 });
    }

    const users = await getCollection('users');
    const admin = await users.findOne({ username });

    if (!admin) {
      return NextResponse.json({ error: 'אדמין לא קיים' }, { status: 404 });
    }

    const now = new Date();

    // ✅ NOT expired → return existing password
    if (now <= new Date(admin.passwordExpiresAt)) {
      const password = decrypt(admin.passwordEncrypted);
      return NextResponse.json({ password });
    }

    // ❌ expired → generate new
    const newPassword = generatePassword();

    await users.updateOne(
      { username: username },
      {
        $set: {
          passwordHash: await bcrypt.hash(newPassword, 10),
          passwordEncrypted: encrypt(newPassword),
          passwordExpiresAt: getExpiration(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ password: newPassword });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
}
