import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin";
import { sendEmail } from "@/lib/email";
import { testEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const token = await verifySuperAdmin(req);
  if (!token) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { to } = await req.json();
  if (!to) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });

  const emailData = testEmail();
  const result = await sendEmail({ to, subject: emailData.subject, html: emailData.html });

  return NextResponse.json(result);
}
