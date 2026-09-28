import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalPatients,
      totalAppointments,
      todayAppointments,
      completedBriefs,
      pendingBriefs,
      totalCalls,
      completedCalls,
      recentAppointments,
      recentBriefs,
      recentCalls,
      appointmentsByStatus,
      callsByType,
    ] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.appointment.count(),
      prisma.appointment.count({
        where: { scheduledAt: { gte: today, lt: tomorrow } },
      }),
      prisma.preVisitBrief.count({ where: { status: { in: ["READY", "DELIVERED", "REVIEWED"] } } }),
      prisma.preVisitBrief.count({ where: { status: { in: ["PENDING", "CALL_SCHEDULED", "CALL_IN_PROGRESS", "DATA_COLLECTED", "ANALYZING"] } } }),
      prisma.voiceCall.count(),
      prisma.voiceCall.count({ where: { status: "COMPLETED" } }),
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: today } },
        include: {
          patient: { select: { firstName: true, lastName: true, mrn: true } },
          provider: { select: { firstName: true, lastName: true, specialty: true } },
          preVisitBrief: { select: { status: true, riskScore: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
      prisma.preVisitBrief.findMany({
        include: {
          patient: { select: { firstName: true, lastName: true, mrn: true } },
          provider: { select: { firstName: true, lastName: true } },
          appointment: { select: { scheduledAt: true, visitType: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.voiceCall.findMany({
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.voiceCall.groupBy({
        by: ["callType"],
        _count: true,
      }),
    ]);

    const avgCallDuration = await prisma.voiceCall.aggregate({
      _avg: { durationSeconds: true },
      where: { status: "COMPLETED" },
    });

    const avgCompletionRate = await prisma.voiceCall.aggregate({
      _avg: { completionRate: true },
      where: { status: "COMPLETED", completionRate: { not: null } },
    });

    // Time saved calc: 8 minutes per completed brief
    const timeSavedMinutes = completedBriefs * 8;

    return NextResponse.json({
      stats: {
        totalPatients,
        totalAppointments,
        todayAppointments,
        completedBriefs,
        pendingBriefs,
        totalCalls,
        completedCalls,
        callSuccessRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
        avgCallDuration: Math.round(avgCallDuration._avg.durationSeconds || 0),
        avgCompletionRate: Math.round((avgCompletionRate._avg.completionRate || 0) * 100),
        timeSavedMinutes,
        timeSavedHours: Math.round(timeSavedMinutes / 60 * 10) / 10,
      },
      recentAppointments,
      recentBriefs,
      recentCalls,
      appointmentsByStatus: appointmentsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      callsByType: callsByType.map((c) => ({
        type: c.callType,
        count: c._count,
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
