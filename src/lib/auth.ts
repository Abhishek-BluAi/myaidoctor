import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("Account has been deactivated. Contact your administrator.");
        }

        if (!user.isApproved) {
          throw new Error("Your account is pending approval. You will be notified when approved.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        // Log successful authentication
        await prisma.auditLog.create({
          data: {
            action: "AUTH_LOGIN",
            entityType: "user",
            entityId: user.id,
            userId: user.id,
            details: { method: "credentials" },
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          clinicId: user.clinicId,
          mfaEnabled: user.mfaEnabled,
          mfaRequired: user.mfaRequired,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes
  },

  jwt: {
    maxAge: 30 * 60, // 30 minutes
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in — populate token from user
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clinicId = user.clinicId;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.mfaEnabled = user.mfaEnabled;
        token.mfaRequired = user.mfaRequired;
        token.mfaVerified = false; // MFA not yet verified on fresh login
      }

      // Session update triggered by client (after MFA verify/setup)
      if (trigger === "update" && session) {
        if (session.mfaVerified === true) {
          // Verify against DB that MFA was actually verified recently
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { mfaVerifiedAt: true, mfaEnabled: true },
          });

          if (dbUser?.mfaVerifiedAt) {
            const verifiedAgo = Date.now() - dbUser.mfaVerifiedAt.getTime();
            // Accept if verified within the last 2 minutes
            if (verifiedAgo < 2 * 60 * 1000) {
              token.mfaVerified = true;
              token.mfaEnabled = dbUser.mfaEnabled;
            }
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.clinicId = token.clinicId;
      session.user.firstName = token.firstName;
      session.user.lastName = token.lastName;
      session.user.mfaEnabled = token.mfaEnabled;
      session.user.mfaRequired = token.mfaRequired;
      session.user.mfaVerified = token.mfaVerified;
      return session;
    },
  },

  events: {
    async signOut({ token }) {
      if (token?.id) {
        await prisma.auditLog.create({
          data: {
            action: "AUTH_LOGOUT",
            entityType: "user",
            entityId: token.id as string,
            userId: token.id as string,
          },
        });
      }
    },
  },
};
