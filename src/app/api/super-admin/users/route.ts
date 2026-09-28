import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifySuperAdmin } from "@/lib/super-admin";
import { sendEmail } from "@/lib/email";
import { mfaResetNotificationEmail, passwordChangedNotificationEmail } from "@/lib/email-templates";

export async function GET(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, specialty: true, phone: true, isActive: true,
      isApproved: true, mfaEnabled: true, mfaRequired: true, createdAt: true,
      clinic: { select: { id: true, name: true } },
      customRole: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  if (!(await verifySuperAdmin(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action = "create", ...data } = body;

  try {
    if (action === "create") {
      const { email, firstName, lastName, role, password, clinicId, specialty, npiNumber, phone } = data;
      if (!email || !firstName || !lastName || !password)
        return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing)
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash: await bcrypt.hash(password, 12),
          firstName: firstName.trim(), lastName: lastName.trim(),
          role: role || "PROVIDER",
          specialty, npiNumber, phone,
          clinicId: clinicId || null,
          isApproved: true, approvedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, userId: user.id });
    }

    if (action === "update") {
      const { userId, firstName, lastName, role, clinicId, specialty, npiNumber, phone, isActive, isApproved, customRoleId } = data;
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(role && { role }),
          ...(clinicId !== undefined && { clinicId: clinicId || null }),
          ...(specialty !== undefined && { specialty }),
          ...(npiNumber !== undefined && { npiNumber }),
          ...(phone !== undefined && { phone }),
          ...(isActive !== undefined && { isActive }),
          ...(isApproved !== undefined && { isApproved, ...(isApproved && { approvedAt: new Date() }) }),
          ...(customRoleId !== undefined && { customRoleId: customRoleId || null }),
        },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const { userId } = data;
      await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
      return NextResponse.json({ success: true });
    }

    if (action === "reset-password") {
      const { userId, newPassword } = data;
      if (!userId || !newPassword)
        return NextResponse.json({ error: "userId and newPassword required" }, { status: 400 });
      const u = await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(newPassword, 12) },
        select: { email: true, firstName: true },
      });
      const ed = passwordChangedNotificationEmail(u.firstName);
      sendEmail({ to: u.email, subject: ed.subject, html: ed.html }).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (action === "reset-mfa") {
      const { userId } = data;
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const u = await prisma.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false, mfaMethod: null, mfaSecret: null,
          mfaPhone: null, backupCodes: [], mfaVerifiedAt: null,
        },
        select: { email: true, firstName: true },
      });
      const ed = mfaResetNotificationEmail(u.firstName);
      sendEmail({ to: u.email, subject: ed.subject, html: ed.html }).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (action === "toggle-mfa-required") {
      const { userId, mfaRequired } = data;
      if (!userId || typeof mfaRequired !== "boolean")
        return NextResponse.json({ error: "userId and mfaRequired (boolean) required" }, { status: 400 });
      const u = await prisma.user.update({
        where: { id: userId },
        data: { mfaRequired },
        select: { email: true, firstName: true, mfaRequired: true },
      });
      return NextResponse.json({ success: true, mfaRequired: u.mfaRequired });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Super admin users error:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
