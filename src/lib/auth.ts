import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || "fallback-secret-for-build-time-only",
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials, request) => {
        const email = String(credentials.email ?? "").toLowerCase().trim();
        const password = String(credentials.password ?? "");

        if (!email || !password) {
          return null;
        }

        let user = await db.user.findUnique({ where: { email } });
        if (!user) {
          if (password.length < 8) return null;
          const passwordHash = await bcrypt.hash(password, 10);
          user = await db.user.create({
            data: {
              name: email.split("@")[0],
              email,
              passwordHash,
            },
          });
          await db.workspace.create({
            data: {
              name: "Private workspace",
              ownerId: user.id,
              isPrivate: true,
            },
          });
        } else {
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;
        }

        try {
          const headersReq = request instanceof Request ? request : undefined;
          const ip = headersReq ? headersReq.headers.get("x-forwarded-for") || "unknown" : "unknown";
          const userAgent = headersReq ? headersReq.headers.get("user-agent") || "unknown" : "unknown";

          await db.loginHistory.create({
            data: {
              userId: user.id,
              ip: String(ip).substring(0, 255),
              userAgent: String(userAgent).substring(0, 255),
            }
          });
        } catch (e) {
          console.error("Login history error", e);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.userId = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
