import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import {
  generateTOTPSecret,
  generateTOTPUri,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
} from "@/lib/mfa";
import * as QRCode from "qrcode";

/**
 * GET /api/auth/mfa/setup
 * Generate TOTP secret and QR code for authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id || !token?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = generateTOTPSecret();
    const uri = generateTOTPUri(secret, token.email as string);
    const qrCode = await QRCode.toDataURL(uri, {
      width: 256, margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    });

    // Store secret on user (not enabled yet)
    await prisma.user.update({
      where: { id: token.id as string },
      data: { mfaSecret: secret, mfaMethod: "TOTP" },
    });

    return NextResponse.json({ qrCode, secret });
  } catch (error) {
    console.error("MFA setup error:", error);
    return NextResponse.json({ error: "Failed to initialize MFA" }, { status: 500 });
  }
}

/**
 * POST /api/auth/mfa/setup
 * Body: { code: string }
 * Verify TOTP code and enable MFA.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { id: true, mfaSecret: true, mfaEnabled: true },
    });

    if (!user || !user.mfaSecret) {
      return NextResponse.json({ error: "MFA not initialized" }, { status: 400 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json({ error: "MFA already enabled" }, { status: 400 });
    }

    if (!verifyTOTP(code, user.mfaSecret)) {
      return NextResponse.json({ error: "Invalid code. Try again." }, { status: 400 });
    }

    const backupCodes = generateBackupCodes(10);
    const hashedCodes = backupCodes.map(hashBackupCode);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        backupCodes: hashedCodes,
        mfaVerifiedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "MFA_ENABLED",
        entityType: "user",
        entityId: user.id,
        userId: user.id,
        details: { method: "TOTP" },
      },
    });

    return NextResponse.json({ success: true, backupCodes });
  } catch (error) {
    console.error("MFA confirm error:", error);
    return NextResponse.json({ error: "Failed to enable MFA" }, { status: 500 });
  }
}
