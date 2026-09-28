/**
 * SMS / WhatsApp OTP Delivery Service
 *
 * Currently uses a MOCK implementation that logs OTP codes to the console.
 * To switch to real Twilio delivery:
 *   1. Set SMS_PROVIDER="twilio" in .env
 *   2. Fill in TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *   3. npm install twilio
 *   4. Uncomment the Twilio implementation below
 */

interface SendOTPResult {
  success: boolean;
  message: string;
}

// ──────────────────────────────────────────────────────────────
// In-memory OTP store (replace with Redis in production)
// ──────────────────────────────────────────────────────────────
const otpStore = new Map<
  string,
  { code: string; expiresAt: Date; attempts: number }
>();

export function storeOTP(userId: string, code: string, expiresAt: Date) {
  otpStore.set(userId, { code, expiresAt, attempts: 0 });
}

export function getStoredOTP(userId: string) {
  const entry = otpStore.get(userId);
  if (!entry) return null;
  if (new Date() > entry.expiresAt) {
    otpStore.delete(userId);
    return null;
  }
  return entry;
}

export function verifyStoredOTP(userId: string, inputCode: string): boolean {
  const entry = getStoredOTP(userId);
  if (!entry) return false;

  entry.attempts += 1;

  // Max 5 attempts per OTP
  if (entry.attempts > 5) {
    otpStore.delete(userId);
    return false;
  }

  if (entry.code === inputCode) {
    otpStore.delete(userId);
    return true;
  }

  return false;
}

// ──────────────────────────────────────────────────────────────
// Mock SMS implementation
// ──────────────────────────────────────────────────────────────
async function sendMockSMS(
  phone: string,
  code: string
): Promise<SendOTPResult> {
  console.log("\n" + "═".repeat(56));
  console.log("  📱 MOCK SMS OTP DELIVERY");
  console.log("═".repeat(56));
  console.log(`  To:    ${phone}`);
  console.log(`  Code:  ${code}`);
  console.log(`  Time:  ${new Date().toISOString()}`);
  console.log("═".repeat(56) + "\n");

  return {
    success: true,
    message: `[MOCK] OTP ${code} sent to ${phone}`,
  };
}

async function sendMockWhatsApp(
  phone: string,
  code: string
): Promise<SendOTPResult> {
  console.log("\n" + "═".repeat(56));
  console.log("  💬 MOCK WHATSAPP OTP DELIVERY");
  console.log("═".repeat(56));
  console.log(`  To:    ${phone}`);
  console.log(`  Code:  ${code}`);
  console.log(`  Time:  ${new Date().toISOString()}`);
  console.log("═".repeat(56) + "\n");

  return {
    success: true,
    message: `[MOCK] OTP ${code} sent via WhatsApp to ${phone}`,
  };
}

// ──────────────────────────────────────────────────────────────
// Twilio implementation (uncomment when ready)
// ──────────────────────────────────────────────────────────────
/*
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendTwilioSMS(phone: string, code: string): Promise<SendOTPResult> {
  try {
    await twilioClient.messages.create({
      body: `Your MyAIDoctor.io verification code is: ${code}. Valid for 5 minutes. Do not share this code.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    return { success: true, message: "OTP sent via SMS" };
  } catch (error: any) {
    console.error("Twilio SMS error:", error.message);
    return { success: false, message: "Failed to send SMS" };
  }
}

async function sendTwilioWhatsApp(phone: string, code: string): Promise<SendOTPResult> {
  try {
    await twilioClient.messages.create({
      body: `Your MyAIDoctor.io verification code is: ${code}. Valid for 5 minutes.`,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${phone}`,
    });
    return { success: true, message: "OTP sent via WhatsApp" };
  } catch (error: any) {
    console.error("Twilio WhatsApp error:", error.message);
    return { success: false, message: "Failed to send WhatsApp message" };
  }
}
*/

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────
export async function sendSMS(
  phone: string,
  code: string
): Promise<SendOTPResult> {
  const provider = process.env.SMS_PROVIDER || "mock";

  if (provider === "twilio") {
    // return sendTwilioSMS(phone, code);
    console.warn("Twilio not configured — falling back to mock");
  }

  return sendMockSMS(phone, code);
}

export async function sendWhatsApp(
  phone: string,
  code: string
): Promise<SendOTPResult> {
  const provider = process.env.SMS_PROVIDER || "mock";

  if (provider === "twilio") {
    // return sendTwilioWhatsApp(phone, code);
    console.warn("Twilio not configured — falling back to mock");
  }

  return sendMockWhatsApp(phone, code);
}
