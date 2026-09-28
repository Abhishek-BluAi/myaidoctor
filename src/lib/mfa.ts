import { authenticator } from "otplib";
import * as crypto from "crypto";

// Configure TOTP settings
authenticator.options = {
  digits: 6,
  step: 30, // 30 second window
  window: 1, // Allow 1 step before/after for clock drift
};

/**
 * Generate a new TOTP secret for authenticator app setup.
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate the otpauth:// URI for QR code scanning.
 */
export function generateTOTPUri(secret: string, email: string): string {
  return authenticator.keyuri(email, "MyAIDoctor.io", secret);
}

/**
 * Verify a TOTP code against the stored secret.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generate a 6-digit OTP for SMS/WhatsApp delivery.
 * Returns { code, expiresAt } — valid for 5 minutes.
 */
export function generateOTP(): { code: string; expiresAt: Date } {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  return { code, expiresAt };
}

/**
 * Generate a set of backup/recovery codes.
 * Returns 10 codes, each 8 characters alphanumeric.
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = crypto.randomBytes(5);
    const code = buf
      .toString("hex")
      .toUpperCase()
      .slice(0, 8)
      .replace(/(.{4})(.{4})/, "$1-$2");
    codes.push(code);
  }
  return codes;
}

/**
 * Hash a backup code for secure storage.
 */
export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.replace(/-/g, "").toUpperCase())
    .digest("hex");
}

/**
 * Verify a backup code against hashed stored codes.
 * Returns the index of the matched code, or -1 if not found.
 */
export function verifyBackupCode(
  inputCode: string,
  hashedCodes: string[]
): number {
  const inputHash = hashBackupCode(inputCode);
  return hashedCodes.findIndex((stored) => stored === inputHash);
}
