import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { accountApprovedEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, action } = await req.json();

  if (!userId || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "userId and action (approve/reject) are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "approve") {
    await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true, approvedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_APPROVED",
        entityType: "user",
        entityId: userId,
        userId: session.user.id,
        details: { approvedEmail: user.email },
      },
    });

    // Send approval email
    const emailData = accountApprovedEmail(user.firstName);
    sendEmail({ to: user.email, subject: emailData.subject, html: emailData.html }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `${user.firstName} ${user.lastName} has been approved.`,
    });
  } else {
    // Reject — deactivate the account
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_REJECTED",
        entityType: "user",
        entityId: userId,
        userId: session.user.id,
        details: { rejectedEmail: user.email },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${user.firstName} ${user.lastName} has been rejected.`,
    });
  }
}
