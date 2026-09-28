import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });

  if (newPassword.length < 8)
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { id: true, passwordHash: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });

  await prisma.auditLog.create({
    data: { action: "PASSWORD_CHANGED", entityType: "user", entityId: user.id, userId: user.id },
  });

  return NextResponse.json({ success: true });
}
