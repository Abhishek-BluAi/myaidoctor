import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole, hasPermission, PermissionEntry } from "@/lib/permissions";

/**
 * Verify the request is from a SUPER_ADMIN user.
 */
export async function verifySuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id || token.role !== "SUPER_ADMIN") return null;
  return token;
}

/**
 * Check if the current user has a specific permission.
 * Returns the token if authorized, null otherwise.
 * SUPER_ADMIN bypasses all checks.
 */
export async function checkPermission(
  req: NextRequest,
  resource: string,
  action: string = "view"
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return null;

  // SUPER_ADMIN always has full access
  if (token.role === "SUPER_ADMIN") return token;

  // Look up user's permissions
  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: {
      role: true,
      customRole: { select: { permissions: true } },
    },
  });

  if (!user) return null;

  const perms: PermissionEntry[] = user.customRole
    ? (user.customRole.permissions as PermissionEntry[]) || []
    : defaultPermissionsForRole(user.role);

  return hasPermission(perms, resource, action) ? token : null;
}
