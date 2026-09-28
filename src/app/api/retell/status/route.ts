import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVoiceAIConfig } from "@/lib/voice-ai";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getVoiceAIConfig();
  const callId = req.nextUrl.searchParams.get("callId");

  if (callId) {
    const call = await prisma.voiceCall.findUnique({
      where: { id: callId },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return NextResponse.json({ call, mode: config.mode });
  }

  // Return recent and active calls
  const [activeCalls, recentCalls, stats] = await Promise.all([
    prisma.voiceCall.findMany({
      where: { status: { in: ["QUEUED", "RINGING", "IN_PROGRESS"] } },
      include: { patient: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.voiceCall.findMany({
      where: { status: "COMPLETED" },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { endedAt: "desc" },
      take: 20,
    }),
    prisma.voiceCall.aggregate({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: true,
      _avg: { durationSeconds: true, completionRate: true },
    }),
  ]);

  return NextResponse.json({
    activeCalls,
    recentCalls,
    stats: {
      callsToday: stats._count,
      avgDuration: Math.round(stats._avg.durationSeconds || 0),
      avgCompletion: Math.round((stats._avg.completionRate || 0) * 100),
    },
    mode: config.mode,
    configured: !!(config.retellApiKey && config.retellAgentId),
  });
}
