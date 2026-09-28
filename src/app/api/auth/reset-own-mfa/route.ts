import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateTOTPSecret, generateTOTPUri, verifyTOTP, generateBackupCodes, hashBackupCode } from "@/lib/mfa";
import * as QRCode from "qrcode";

/**
 * POST /api/auth/reset-own-mfa
 *
 * Step 1 — { action: "initiate", password: "..." }
 *   Verify password, clear old MFA, generate new TOTP secret, return QR code.
 *
 * Step 2 — { action: "confirm", code: "123456" }
 *   Verify TOTP code, enable MFA, return backup codes.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id || !token?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, password, code } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { id: true, email: true, passwordHash: true, mfaSecret: true, mfaEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    if (action === "initiate") {
      if (!password)
        return NextResponse.json({ error: "Password is required to reset MFA" }, { status: 400 });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid)
        return NextResponse.json({ error: "Incorrect password" }, { status: 400 });

      // Generate new TOTP secret
      const secret = generateTOTPSecret();
      const uri = generateTOTPUri(secret, user.email);
      const qrCode = await QRCode.toDataURL(uri, {
        width: 256, margin: 2,
        color: { dark: "#1a1a2e", light: "#ffffff" },
      });

      // Store new secret, disable old MFA
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaSecret: secret, mfaMethod: "TOTP", mfaEnabled: false, backupCodes: [], mfaVerifiedAt: null },
      });

      await prisma.auditLog.create({
        data: { action: "MFA_RESET_INITIATED", entityType: "user", entityId: user.id, userId: user.id },
      });

      return NextResponse.json({ success: true, qrCode, secret });
    }

    if (action === "confirm") {
      if (!code)
        return NextResponse.json({ error: "Verification code is required" }, { status: 400 });

      if (!user.mfaSecret)
        return NextResponse.json({ error: "MFA reset not initiated" }, { status: 400 });

      if (!verifyTOTP(code, user.mfaSecret))
        return NextResponse.json({ error: "Invalid code. Try again." }, { status: 400 });

      const backupCodes = generateBackupCodes(10);
      const hashedCodes = backupCodes.map(hashBackupCode);

      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true, backupCodes: hashedCodes, mfaVerifiedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: { action: "MFA_RESET_COMPLETED", entityType: "user", entityId: user.id, userId: user.id },
      });

      return NextResponse.json({ success: true, backupCodes });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("MFA reset error:", error);
    return NextResponse.json({ error: "MFA reset failed" }, { status: 500 });
  }
}
