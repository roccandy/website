import "next-auth";
import "next-auth/jwt";

export type AdminRole = "viewer" | "editor" | "admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: AdminRole;
      canWrite: boolean;
      canManageUsers: boolean;
      isBootstrap?: boolean;
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    role: AdminRole;
    canWrite: boolean;
    canManageUsers: boolean;
    isBootstrap?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: AdminRole;
    canWrite?: boolean;
    canManageUsers?: boolean;
    isBootstrap?: boolean;
  }
}
