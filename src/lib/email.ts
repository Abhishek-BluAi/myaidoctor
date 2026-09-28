import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Load SMTP configuration from SystemSettings (database).
 * Falls back to environment variables, then to console logging.
 */
async function getSmtpConfig() {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "smtp_host", "smtp_port", "smtp_secure", "smtp_user",
            "smtp_pass", "smtp_from_name", "smtp_from_email",
          ],
        },
      },
    });

    const cfg: Record<string, string> = {};
    rows.forEach((r) => { cfg[r.key] = r.value; });

    // If DB has SMTP config, use it
    if (cfg.smtp_host && cfg.smtp_user) {
      return {
        host: cfg.smtp_host,
        port: parseInt(cfg.smtp_port || "587"),
        secure: cfg.smtp_secure === "true",
        auth: { user: cfg.smtp_user, pass: cfg.smtp_pass || "" },
        fromName: cfg.smtp_from_name || "MyAIDoctor.io",
        fromEmail: cfg.smtp_from_email || cfg.smtp_user,
      };
    }
  } catch {
    // DB not available, fall through
  }

  // Fallback to environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" },
      fromName: process.env.SMTP_FROM_NAME || "MyAIDoctor.io",
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    };
  }

  // No SMTP configured — will use console logging
  return null;
}

/**
 * Send an email. If SMTP is configured, sends via nodemailer.
 * If not configured, logs to console (dev mode).
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  const config = await getSmtpConfig();

  if (!config) {
    // Console fallback for development
    console.log("\n" + "═".repeat(60));
    console.log("  📧 EMAIL (console — no SMTP configured)");
    console.log("═".repeat(60));
    console.log(`  To:      ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Time:    ${new Date().toISOString()}`);
    console.log("─".repeat(60));
    // Strip HTML tags for console preview
    const preview = options.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    console.log(`  Preview: ${preview}...`);
    console.log("═".repeat(60) + "\n");

    return { success: true, message: "[DEV] Email logged to console" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`📧 Email sent to ${options.to}: ${options.subject}`);
    return { success: true, message: "Email sent successfully" };
  } catch (error: any) {
    console.error("📧 Email send failed:", error.message);
    return { success: false, message: error.message || "Failed to send email" };
  }
}

/**
 * Test SMTP connection with the current configuration.
 */
export async function testSmtpConnection(): Promise<{ success: boolean; message: string }> {
  const config = await getSmtpConfig();

  if (!config) {
    return { success: false, message: "No SMTP configured. Add settings in Super Admin → System Settings." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();
    return { success: true, message: `Connected to ${config.host}:${config.port}` };
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}
