import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getRolePermissions, hasAnyAdminUsers, verifyAdminUserPassword } from "@/lib/adminUsers";
import type { AdminRole } from "@/types/next-auth";

const bootstrapAdminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL ?? process.env.ADMIN_EMAIL;
const bootstrapAdminEmails = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? process.env.ADMIN_EMAILS ?? bootstrapAdminEmail ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const bootstrapAdminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? process.env.ADMIN_PASSWORD;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

if (!nextAuthSecret) {
  console.warn("NEXTAUTH_SECRET must be set for admin auth.");
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          value: bootstrapAdminEmails[0] ?? bootstrapAdminEmail ?? "admin@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = (credentials?.email ?? "").trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) {
          return null;
        }

        const matchedUser = await verifyAdminUserPassword(email, password);
        if (matchedUser) {
          const permissions = getRolePermissions(matchedUser.role);
          return {
            id: matchedUser.id,
            email: matchedUser.email,
            name: matchedUser.display_name,
            role: matchedUser.role,
            canWrite: permissions.canWrite,
            canManageUsers: permissions.canManageUsers,
            isBootstrap: false,
          };
        }

        const hasUsers = await hasAnyAdminUsers();
        if (!hasUsers && bootstrapAdminPassword) {
          const emailOk = bootstrapAdminEmails.length ? bootstrapAdminEmails.includes(email) : true;
          const passwordOk = password === bootstrapAdminPassword;
          if (emailOk && passwordOk) {
            const role: AdminRole = "admin";
            const permissions = getRolePermissions(role);
            return {
              id: "bootstrap-admin",
              email,
              name: "Bootstrap admin",
              role,
              canWrite: permissions.canWrite,
              canManageUsers: permissions.canManageUsers,
              isBootstrap: true,
            };
          }
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.canWrite = user.canWrite;
        token.canManageUsers = user.canManageUsers;
        token.isBootstrap = user.isBootstrap;
      }
      return token;
    },
    async session({ session, token }) {
      const role = (token.role as AdminRole | undefined) ?? "viewer";
      const permissions = getRolePermissions(role);
      session.user = {
        ...session.user,
        id: token.id ?? "",
        email: token.email ?? session.user?.email ?? null,
        name: token.name ?? session.user?.name ?? null,
        role,
        canWrite: token.canWrite ?? permissions.canWrite,
        canManageUsers: token.canManageUsers ?? permissions.canManageUsers,
        isBootstrap: Boolean(token.isBootstrap),
      };
      return session;
    },
  },
};
