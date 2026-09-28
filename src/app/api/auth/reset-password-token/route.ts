import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { passwordChangedNotificationEmail } from "@/lib/email-templates";

/** GET — validate token is still valid */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false });

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExp: { gt: new Date() } },
    select: { email: true, firstName: true },
  });

  return NextResponse.json({
    valid: !!user,
    email: user ? user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : null,
  });
}

/** POST — set new password */
export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExp: { gt: new Date() } },
    select: { id: true, email: true, firstName: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      resetToken: null,
      resetTokenExp: null,
    },
  });

  // Send notification
  const emailData = passwordChangedNotificationEmail(user.firstName);
  await sendEmail({ to: user.email, subject: emailData.subject, html: emailData.html });

  await prisma.auditLog.create({
    data: {
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "user",
      entityId: user.id,
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
