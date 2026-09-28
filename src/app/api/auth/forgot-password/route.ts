import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Always return success to prevent email enumeration
  const successResponse = NextResponse.json({
    success: true,
    message: "If an account exists with that email, a password reset link has been sent.",
  });

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, firstName: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return successResponse; // Don't reveal if account exists
    }

    // Generate reset token (64 hex chars, expires in 1 hour)
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExp: expiry },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    const emailData = passwordResetEmail(user.firstName, resetUrl);

    await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    await prisma.auditLog.create({
      data: {
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "user",
        entityId: user.id,
        userId: user.id,
      },
    });

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return successResponse; // Still return success
  }
}
