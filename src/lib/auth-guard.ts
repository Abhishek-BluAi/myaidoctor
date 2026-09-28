import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

/**
 * Server-side auth guard. Requires:
 * 1. Valid session (logged in)
 * 2. If MFA is enabled, it must be verified this session
 *
 * If MFA is not enabled (e.g. legacy seeded users), access is allowed.
 * MFA verification happens inline on the /login page.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // If MFA is enabled but not yet verified this session, send back to login
  // The login page handles MFA verification inline
  if (session.user.mfaEnabled && !session.user.mfaVerified) {
    redirect("/login");
  }

  return session;
}

/**
 * Lighter check — just requires login, no MFA check.
 */
export async function requireLogin() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return session;
}
