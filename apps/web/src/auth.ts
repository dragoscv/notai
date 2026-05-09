import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@notai/db/client';
import { users, accounts, sessions, verificationTokens } from '@notai/db/schema';
import { seedOnboarding } from '@/server/onboarding';
import { bootstrapNewUser } from '@/server/bootstrap-user';

const SEVEN_DAYS = 60 * 60 * 24 * 7;
const isProd = process.env.NODE_ENV === 'production';

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: 'database',
    maxAge: SEVEN_DAYS,
    updateAge: 60 * 60 * 24,
  },
  cookies: {
    sessionToken: {
      name: isProd ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProd,
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // SECURITY: must be false. Linking by raw email lets an attacker who
      // controls a Google account with a victim's email take over the
      // account. Auth.js requires the Google `email_verified` claim to be
      // true before linking when this is off (its default).
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Brand-new account: assign default role + free subscription, then
      // seed welcome notes. All idempotent — safe to retry.
      if (user.id) {
        try {
          await bootstrapNewUser(user.id);
        } catch (err) {
          console.error('[bootstrap] failed', err);
        }
        try {
          await seedOnboarding(user.id);
        } catch (err) {
          console.error('[onboarding] seed failed', err);
        }
      }
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
