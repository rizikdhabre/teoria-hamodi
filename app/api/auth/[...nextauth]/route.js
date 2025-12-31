import NextAuth from 'next-auth';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getCollection } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions = {
  providers: [
    // 🔵 FACEBOOK LOGIN
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }),

    // 🟢 LOCAL LOGIN (username OR email)
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Username or Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const users = await getCollection('users');

        const user = await users.findOne({
          $or: [
            { email: credentials.identifier },
            { username: credentials.identifier },
          ],
        });

        // User not found or not local
        if (!user || user.provider !== 'local') {
          throw new Error('שם משתמש לא קיים');
        }

        // Check password
        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error('סיסמה שגויה');
        }
        return {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 2 * 60 * 60,
  },

  jwt: {
    maxAge: 2 * 60 * 60,
  },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    // 🔐
    async signIn({ user, account }) {
      if (account.provider === 'credentials') {
        return true; // already validated
      }

      try {
        const users = await getCollection('users');

        const existingUser = await users.findOne({
          email: user.email,
        });

        if (!existingUser) {
          const [firstName = '', ...rest] = (user.name || '').split(' ');
          const lastName = rest.join(' ');

          await users.insertOne({
            email: user.email,
            username: user.email.split('@')[0], // auto username
            firstName,
            lastName,
            provider: account.provider,
            role: 'user',
            passwordHash: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return true;
      } catch (error) {
        console.error('error in signIn callback', error);
        return false;
      }
    },

    // 🔑 Attach data to JWT
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.username = user.username;
        token.email = user.email;
      }
      return token;
    },

    // 📦 Expose data to frontend
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.firstName = token.firstName;
      session.user.lastName = token.lastName;
      session.user.username = token.username;
      session.user.email = token.email;

      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
