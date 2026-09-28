import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const callType = req.nextUrl.searchParams.get("callType");
    const status = req.nextUrl.searchParams.get("status");
    const callId = req.nextUrl.searchParams.get("id");

    if (callId) {
      const call = await prisma.voiceCall.findUnique({
        where: { id: callId },
        include: {
          patient: true,
          provider: { select: { firstName: true, lastName: true } },
          appointment: { select: { scheduledAt: true, visitType: true } },
        },
      });
      return NextResponse.json({ call });
    }

    const where: any = {};
    if (callType) where.callType = callType;
    if (status) where.status = status;

    const calls = await prisma.voiceCall.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        provider: { select: { firstName: true, lastName: true } },
        appointment: { select: { scheduledAt: true, visitType: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ calls });
  } catch (error) {
    console.error("Voice calls API error:", error);
    return NextResponse.json({ error: "Failed to load calls" }, { status: 500 });
  }
}
