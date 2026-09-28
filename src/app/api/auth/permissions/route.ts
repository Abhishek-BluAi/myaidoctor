import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole, PermissionEntry } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ permissions: [] });
  }

  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { role: true, customRoleId: true, customRole: { select: { permissions: true } } },
  });

  if (!user) {
    return NextResponse.json({ permissions: [] });
  }

  let permissions: PermissionEntry[];

  if (user.customRole && user.customRoleId) {
    // Custom role overrides built-in role
    permissions = (user.customRole.permissions as PermissionEntry[]) || [];
  } else {
    // Use default permissions for built-in role
    permissions = defaultPermissionsForRole(user.role);
  }

  return NextResponse.json({ permissions, role: user.role });
}
