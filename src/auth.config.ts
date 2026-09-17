import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the NextAuth config (no providers that touch the
// database) so this can be used from Proxy/Middleware, which runs on the
// Edge runtime and can't load the native better-sqlite3 binding. The full
// config with the Credentials provider lives in src/auth.ts and runs in
// Node.js (API routes, server components).
export const authConfig = {
  /**
   * Trust the Host header from the proxy in front of us.
   *
   * Auth.js derives the callback URL from the request host, and refuses to do
   * so unless told the host is trustworthy - otherwise a forged Host header
   * could redirect a sign-in somewhere else. It special-cases Vercel and
   * trusts it automatically; every other host, including Render, it does not,
   * so sign-in fails with UntrustedHost even though the login page renders
   * perfectly. That combination is unpleasant to diagnose from the outside.
   *
   * Safe here because the app is always reached through the platform's own
   * proxy, which terminates TLS and sets Host itself. If this is ever served
   * directly to the internet without one, set AUTH_URL instead and remove
   * this.
   */
  trustHost: true,
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
