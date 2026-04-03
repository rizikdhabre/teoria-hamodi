import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getCollection } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin Credentials',

      credentials: {
        username: { label: 'identifier:', type: 'text' },
        password: { label: 'password:', type: 'password' },
      },
  
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error('נא למלא את כל השדות');
        }


        const users = await getCollection('users');
        const admin = await users.findOne({ username: credentials.identifier });

        if (!admin || !admin.passwordHash || !admin.passwordExpiresAt) {
          throw new Error('משתמש אדמין לא קיים');
        }

        const now = new Date();
        const expiresAt = new Date(admin.passwordExpiresAt);

        if (now > expiresAt) {
          throw new Error('הסיסמה פגה תוקף. קח סיסמה חדשה מהמנהל');
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          admin.passwordHash
        );

        if (!isValid) {
          throw new Error('סיסמה שגויה');
        }
        // ✅ login allowed
        return {
          id: admin._id.toString(),
          username: 'admin',
          role: 'admin',
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 2 * 60 * 60, // 2 hours
  },

  jwt: {
    maxAge: 2 * 60 * 60,
  },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.username = token.username;
      session.user.role = token.role;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
