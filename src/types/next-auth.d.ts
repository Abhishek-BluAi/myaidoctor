import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    clinicId: string | null;
    mfaEnabled: boolean;
    mfaRequired: boolean;
    firstName: string;
    lastName: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      clinicId: string | null;
      firstName: string;
      lastName: string;
      mfaEnabled: boolean;
      mfaRequired: boolean;
      mfaVerified: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    clinicId: string | null;
    firstName: string;
    lastName: string;
    mfaEnabled: boolean;
    mfaRequired: boolean;
    mfaVerified: boolean;
  }
}
