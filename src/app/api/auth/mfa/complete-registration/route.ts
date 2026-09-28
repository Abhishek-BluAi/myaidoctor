import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyTOTP, generateBackupCodes, hashBackupCode } from "@/lib/mfa";

/** Verify a signed registration token. */
function verifyRegistrationToken(
  token: string
): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const secret = process.env.NEXTAUTH_SECRET || "dev-secret";
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (sig !== expectedSig) return null;

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );
    if (Date.now() > data.exp) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/mfa/complete-registration
 * Body: { registrationToken: string; code: string }
 *
 * Verifies the TOTP code during signup and enables MFA.
 * No session needed — uses a signed registration token instead.
 */
export async function POST(req: NextRequest) {
  const { registrationToken, code } = await req.json();

  if (!registrationToken || !code) {
    return NextResponse.json(
      { error: "Registration token and code are required" },
      { status: 400 }
    );
  }

  const tokenData = verifyRegistrationToken(registrationToken);
  if (!tokenData) {
    return NextResponse.json(
      { error: "Invalid or expired registration token" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenData.userId },
    select: { id: true, mfaSecret: true, mfaEnabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.mfaEnabled) {
    return NextResponse.json(
      { error: "MFA is already enabled" },
      { status: 400 }
    );
  }

  if (!user.mfaSecret) {
    return NextResponse.json(
      { error: "MFA setup not initialized" },
      { status: 400 }
    );
  }

  // Verify the TOTP code
  const verified = verifyTOTP(code, user.mfaSecret);
  if (!verified) {
    return NextResponse.json(
      { error: "Invalid code. Make sure you scanned the QR code and enter the current 6-digit code from your app." },
      { status: 400 }
    );
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);
  const hashedCodes = backupCodes.map(hashBackupCode);

  // Enable MFA
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
      details: { method: "TOTP", context: "registration" },
    },
  });

  return NextResponse.json({
    success: true,
    backupCodes,
  });
}
