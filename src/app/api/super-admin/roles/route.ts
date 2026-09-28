import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySuperAdmin } from "@/lib/super-admin";

export async function GET(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const roles = await prisma.customRole.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action = "create", ...data } = await req.json();

  try {
    if (action === "create") {
      const { name, description, permissions } = data;
      if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
      const role = await prisma.customRole.create({
        data: { name, description, permissions: permissions || [] },
      });
      return NextResponse.json({ success: true, roleId: role.id });
    }

    if (action === "update") {
      const { roleId, name, description, permissions, isActive } = data;
      if (!roleId) return NextResponse.json({ error: "roleId required" }, { status: 400 });
      await prisma.customRole.update({
        where: { id: roleId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(permissions && { permissions }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const { roleId } = data;
      // Unassign users first
      await prisma.user.updateMany({ where: { customRoleId: roleId }, data: { customRoleId: null } });
      await prisma.customRole.delete({ where: { id: roleId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Roles error:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
