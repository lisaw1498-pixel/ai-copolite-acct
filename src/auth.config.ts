import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the NextAuth config (no providers that touch the
// database) so this can be used from Proxy/Middleware, which runs on the
// Edge runtime and can't load the native better-sqlite3 binding. The full
// config with the Credentials provider lives in src/auth.ts and runs in
// Node.js (API routes, server components).
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
