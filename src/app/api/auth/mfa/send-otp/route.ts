import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOTP } from "@/lib/mfa";
import { storeOTP, sendSMS, sendWhatsApp } from "@/lib/sms";

// Rate limit: track last OTP send time per user
const sendTimestamps = new Map<string, number>();

/**
 * POST /api/auth/mfa/send-otp
 *
 * Sends a new OTP via the user's configured MFA method (SMS or WhatsApp).
 * Rate limited to once per 30 seconds.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  const lastSent = sendTimestamps.get(session.user.id) || 0;
  const elapsed = Date.now() - lastSent;
  if (elapsed < 30000) {
    const waitSeconds = Math.ceil((30000 - elapsed) / 1000);
    return NextResponse.json(
      { error: `Please wait ${waitSeconds} seconds before requesting a new code` },
      { status: 429 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        mfaMethod: true,
        mfaPhone: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.mfaMethod !== "SMS" && user.mfaMethod !== "WHATSAPP") {
      return NextResponse.json(
        { error: "OTP delivery is only for SMS/WhatsApp MFA methods" },
        { status: 400 }
      );
    }

    if (!user.mfaPhone) {
      return NextResponse.json(
        { error: "No phone number configured for MFA" },
        { status: 400 }
      );
    }

    const { code, expiresAt } = generateOTP();
    storeOTP(session.user.id, code, expiresAt);
    sendTimestamps.set(session.user.id, Date.now());

    const result =
      user.mfaMethod === "SMS"
        ? await sendSMS(user.mfaPhone, code)
        : await sendWhatsApp(user.mfaPhone, code);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send verification code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      phoneMasked: user.mfaPhone.replace(/.(?=.{4})/g, "•"),
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
