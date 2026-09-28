import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { generateTOTPSecret, generateTOTPUri } from "@/lib/mfa";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import * as QRCode from "qrcode";

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const VALID_ROLES = ["PROVIDER", "NURSE", "FRONT_DESK", "BILLING"] as const;

/** Create a signed registration token for MFA setup (no session needed). */
function createRegistrationToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000 })
  ).toString("base64url");
  const secret = process.env.NEXTAUTH_SECRET || "dev-secret";
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, email, password, confirmPassword,
      role, clinicId, specialty, npiNumber, inviteToken,
    } = body;

    // ── Validation ──────────────────────────────────────────
    if (!firstName?.trim() || !lastName?.trim())
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });

    if (!email?.trim())
      return NextResponse.json({ error: "Email is required" }, { status: 400 });

    if (!password || !confirmPassword)
      return NextResponse.json({ error: "Password and confirmation are required" }, { status: 400 });

    if (password !== confirmPassword)
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });

    if (!PASSWORD_REGEX.test(password))
      return NextResponse.json({ error: "Password must be 8+ characters with uppercase, lowercase, number, and special character" }, { status: 400 });

    if (!role || !VALID_ROLES.includes(role))
      return NextResponse.json({ error: "Please select a valid role" }, { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing)
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    if (clinicId) {
      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
      if (!clinic)
        return NextResponse.json({ error: "Selected clinic not found" }, { status: 400 });
    }

    // ── Determine approval status ───────────────────────────
    const registrationMode = process.env.REGISTRATION_MODE || "open";
    let isApproved = false;
    let inviteId: string | null = null;

    if (inviteToken) {
      const invitation = await prisma.invitation.findUnique({ where: { token: inviteToken } });
      if (!invitation) return NextResponse.json({ error: "Invalid invitation link" }, { status: 400 });
      if (invitation.usedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 400 });
      if (new Date() > invitation.expiresAt) return NextResponse.json({ error: "This invitation has expired" }, { status: 400 });
      isApproved = true;
      inviteId = invitation.id;
    } else {
      if (registrationMode === "invite")
        return NextResponse.json({ error: "Registration is by invitation only." }, { status: 403 });
      isApproved = registrationMode === "open";
    }

    // ── Generate TOTP secret for MFA ────────────────────────
    const totpSecret = generateTOTPSecret();
    const totpUri = generateTOTPUri(totpSecret, normalizedEmail);
    const qrCodeDataUrl = await QRCode.toDataURL(totpUri, {
      width: 256,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    });

    // ── Create user ─────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        specialty: role === "PROVIDER" ? specialty?.trim() || null : null,
        npiNumber: role === "PROVIDER" ? npiNumber?.trim() || null : null,
        clinicId: clinicId || null,
        isApproved,
        approvedAt: isApproved ? new Date() : null,
        mfaSecret: totpSecret,
        mfaMethod: "TOTP",
      },
    });

    if (inviteId) {
      await prisma.invitation.update({ where: { id: inviteId }, data: { usedAt: new Date() } });
    }

    await prisma.auditLog.create({
      data: {
        action: "USER_REGISTERED",
        entityType: "user",
        entityId: user.id,
        userId: user.id,
        details: { method: inviteToken ? "invitation" : "self-registration", role, isApproved },
      },
    });

    // Send welcome email (fire and forget)
    const emailData = welcomeEmail(firstName.trim());
    sendEmail({ to: normalizedEmail, subject: emailData.subject, html: emailData.html }).catch(() => {});

    // Return QR code + registration token for MFA setup
    const registrationToken = createRegistrationToken(user.id);

    return NextResponse.json({
      success: true,
      isApproved,
      mfaSetup: {
        qrCode: qrCodeDataUrl,
        secret: totpSecret,
        registrationToken,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
