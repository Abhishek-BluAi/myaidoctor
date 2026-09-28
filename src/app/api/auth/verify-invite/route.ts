import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { clinic: { select: { id: true, name: true } } },
  });

  if (!invitation) {
    return NextResponse.json({ valid: false, error: "Invalid invitation" });
  }

  if (invitation.usedAt) {
    return NextResponse.json({ valid: false, error: "Invitation already used" });
  }

  if (new Date() > invitation.expiresAt) {
    return NextResponse.json({ valid: false, error: "Invitation expired" });
  }

  return NextResponse.json({
    valid: true,
    email: invitation.email,
    role: invitation.role,
    clinic: invitation.clinic,
  });
}
