import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { invitationEmail } from "@/lib/email-templates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    include: { clinic: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ invitations });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email, role, clinicId } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      email: email.trim().toLowerCase(),
      token,
      role: role || "PROVIDER",
      clinicId: clinicId || null,
      invitedBy: session.user.id,
      expiresAt,
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/signup?token=${token}`;

  // Send invitation email
  const emailData = invitationEmail(email, inviteUrl, role || "PROVIDER");
  sendEmail({ to: email.trim().toLowerCase(), subject: emailData.subject, html: emailData.html }).catch(() => {});

  await prisma.auditLog.create({
    data: {
      action: "INVITATION_CREATED",
      entityType: "invitation",
      entityId: invitation.id,
      userId: session.user.id,
      details: { email, role, clinicId },
    },
  });

  return NextResponse.json({
    success: true,
    inviteUrl,
    expiresAt,
  });
}
