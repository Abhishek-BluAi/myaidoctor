import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { auditSimple, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, appointmentId, reason, preference, selectedSlot, preferredDates, timePreference } = body;

  // ── Cancel Appointment ──────────────────────────────
  if (action === "cancel") {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED", notes: reason ? `Patient cancelled: ${reason}` : "Patient cancelled via intake portal" },
    });

    await auditSimple({
      action: "APPOINTMENT_CANCELLED",
      userId: token.id as string,
      entityType: "appointment",
      entityId: appointmentId,
      details: { reason, method: "patient_portal_intake", cancelledBy: "patient" },
    });

    // Auto-notify waitlisted patients about the opened slot
    try {
      await fetch(new URL("/api/waitlist", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
        body: JSON.stringify({ action: "notify_slot_available", appointmentId }),
      });
    } catch (e) { console.error("[Waitlist notify]", e); }

    return NextResponse.json({ success: true, action: "cancelled" });
  }

  // ── Join Cancellation Waitlist ──────────────────────
  if (action === "waitlist") {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true, clinicId: true, providerId: true },
    });

    if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    await prisma.cancellationWaitlist.create({
      data: {
        patientId: appt.patientId,
        clinicId: appt.clinicId || undefined,
        providerId: appt.providerId || undefined,
        originalApptId: appointmentId,
        preference: preference || "anytime",
        status: "active",
      },
    });

    await auditSimple({
      action: "WAITLIST_JOINED",
      userId: token.id as string,
      entityType: "appointment",
      entityId: appointmentId,
      details: { preference, method: "patient_portal_intake" },
    });

    return NextResponse.json({ success: true, action: "waitlisted" });
  }

  // ── Reschedule Appointment ─────────────────────────
  if (action === "reschedule") {
    // Mark original as rescheduled
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "RESCHEDULED", notes: `Patient requested reschedule via intake portal` },
    });

    // Create reschedule request
    await prisma.rescheduleRequest.create({
      data: {
        appointmentId,
        patientId: token.patientId as string || "",
        preferredDate1: preferredDates?.[0] || null,
        preferredDate2: preferredDates?.[1] || null,
        preferredDate3: preferredDates?.[2] || null,
        timePreference: timePreference || "anytime",
        selectedSlot: selectedSlot || null,
        reason: reason || null,
        status: selectedSlot ? "confirmed" : "pending",
      },
    });

    // If a specific slot was selected, create the new appointment
    if (selectedSlot) {
      const orig = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (orig) {
        await prisma.appointment.create({
          data: {
            scheduledAt: new Date(selectedSlot),
            duration: orig.duration,
            visitType: orig.visitType,
            status: "CONFIRMED",
            reasonForVisit: orig.reasonForVisit,
            patientId: orig.patientId,
            providerId: orig.providerId,
            clinicId: orig.clinicId,
            notes: `Rescheduled from ${orig.scheduledAt.toISOString()} via patient portal`,
          },
        });
      }
    }

    await auditSimple({
      action: "APPOINTMENT_RESCHEDULED",
      userId: token.id as string,
      entityType: "appointment",
      entityId: appointmentId,
      details: { preferredDates, timePreference, selectedSlot, reason, method: "patient_portal_intake" },
    });

    return NextResponse.json({ success: true, action: "rescheduled" });
  }

  // ── Get Available Slots ────────────────────────────
  if (action === "available_slots") {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { providerId: true, clinicId: true, duration: true },
    });

    if (!appt) return NextResponse.json({ slots: [] });

    // Find open slots: look for gaps in the provider's schedule over the next 14 days
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 86400000);

    const existingAppts = await prisma.appointment.findMany({
      where: {
        providerId: appt.providerId,
        scheduledAt: { gte: now, lte: twoWeeks },
        status: { in: ["SCHEDULED", "CONFIRMED", "PRE_VISIT_STARTED", "PRE_VISIT_COMPLETE"] },
      },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true, duration: true },
    });

    // Generate available slots (9am-5pm, 30-min intervals, skip existing)
    const bookedTimes = new Set(existingAppts.map(a => a.scheduledAt.getTime()));
    const slots: { date: string; time: string; iso: string }[] = [];
    
    for (let d = 1; d <= 14 && slots.length < 12; d++) {
      const day = new Date(now.getTime() + d * 86400000);
      if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends

      for (let h = 9; h < 17 && slots.length < 12; h++) {
        for (const m of [0, 30]) {
          if (slots.length >= 12) break;
          const slotTime = new Date(day);
          slotTime.setHours(h, m, 0, 0);
          if (slotTime <= now) continue;
          if (bookedTimes.has(slotTime.getTime())) continue;

          slots.push({
            date: slotTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            time: slotTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            iso: slotTime.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ slots });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
