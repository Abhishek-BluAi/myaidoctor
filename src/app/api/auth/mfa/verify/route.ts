import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { verifyTOTP, verifyBackupCode } from "@/lib/mfa";

/**
 * POST /api/auth/mfa/verify
 * Body: { code: string; type?: "totp" | "backup" }
 *
 * Verify MFA code during login. Uses getToken (not getServerSession)
 * for Next.js 16 compatibility. On success, updates mfaVerifiedAt
 * so the JWT callback can set mfaVerified=true.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { code, type = "totp" } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Verification code is required" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: {
        id: true,
        mfaEnabled: true,
        mfaMethod: true,
        mfaSecret: true,
        backupCodes: true,
      },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: "MFA is not configured for this account" },
        { status: 400 }
      );
    }

    let verified = false;
    let usedBackupCode = false;

    if (type === "backup") {
      const matchIndex = verifyBackupCode(code, user.backupCodes);
      if (matchIndex >= 0) {
        verified = true;
        usedBackupCode = true;
        const updatedCodes = [...user.backupCodes];
        updatedCodes.splice(matchIndex, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { backupCodes: updatedCodes },
        });
      }
    } else {
      verified = verifyTOTP(code, user.mfaSecret);
    }

    if (!verified) {
      await prisma.auditLog.create({
        data: {
          action: "MFA_VERIFY_FAILED",
          entityType: "user",
          entityId: user.id,
          userId: user.id,
        },
      });
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Mark MFA as verified — JWT callback will pick this up on session update
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaVerifiedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "MFA_VERIFIED",
        entityType: "user",
        entityId: user.id,
        userId: user.id,
        details: { type, usedBackupCode },
      },
    });

    return NextResponse.json({ success: true, usedBackupCode });
  } catch (error) {
    console.error("MFA verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
