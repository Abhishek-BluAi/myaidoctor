import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { auditSimple } from "@/lib/audit";

/** GET — list waitlist entries */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // "all", "clinic", "patient"
  const clinicId = searchParams.get("clinicId");

  let where: any = {};
  if (scope === "patient") {
    // Patient sees only their own
    const patient = await prisma.patient.findFirst({ where: { userId: token.id as string } });
    if (patient) where.patientId = patient.id;
    else return NextResponse.json({ entries: [] });
  } else if (scope === "clinic" && clinicId) {
    where.clinicId = clinicId;
  }
  // Super admin sees all (no filter)

  const entries = await prisma.cancellationWaitlist.findMany({
    where: { ...where, status: { in: ["active", "notified"] } },
    orderBy: { createdAt: "asc" },
  });

  // Hydrate patient names
  const patientIds = [...new Set(entries.map(e => e.patientId))];
  const patients = await prisma.patient.findMany({
    where: { id: { in: patientIds } },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });
  const patientMap: Record<string, any> = {};
  patients.forEach(p => { patientMap[p.id] = p; });

  // Hydrate provider names
  const providerIds = [...new Set(entries.filter(e => e.providerId).map(e => e.providerId!))];
  const providers = providerIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: providerIds } },
    select: { id: true, firstName: true, lastName: true },
  }) : [];
  const providerMap: Record<string, any> = {};
  providers.forEach(p => { providerMap[p.id] = p; });

  const hydrated = entries.map(e => ({
    ...e,
    patient: patientMap[e.patientId] || null,
    provider: e.providerId ? providerMap[e.providerId] || null : null,
  }));

  return NextResponse.json({ entries: hydrated, total: hydrated.length });
}

/** POST — add to waitlist, claim slot, remove, notify */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // ── Add to waitlist ────────────────────────────────
  if (action === "add") {
    const { patientId, clinicId, providerId, preference, addedBy, notes } = body;

    // Check if already on waitlist
    const existing = await prisma.cancellationWaitlist.findFirst({
      where: { patientId, status: { in: ["active", "notified"] } },
    });
    if (existing) return NextResponse.json({ error: "Patient already on waitlist", entry: existing }, { status: 409 });

    const entry = await prisma.cancellationWaitlist.create({
      data: { patientId, clinicId: clinicId || undefined, providerId: providerId || undefined, preference: preference || "anytime", addedBy: addedBy || "staff", notes },
    });

    await auditSimple({ action: "WAITLIST_JOINED", entityType: "waitlist", entityId: entry.id, userId: token.id as string, details: { patientId, preference, addedBy } });
    return NextResponse.json({ success: true, entry });
  }

  // ── Remove from waitlist ───────────────────────────
  if (action === "remove") {
    const { entryId } = body;
    await prisma.cancellationWaitlist.update({ where: { id: entryId }, data: { status: "removed" } });
    await auditSimple({ action: "WAITLIST_REMOVED", entityType: "waitlist", entityId: entryId, userId: token.id as string, details: {} });
    return NextResponse.json({ success: true });
  }

  // ── Trigger notifications (when appointment cancelled) ─
  if (action === "notify_slot_available") {
    const { appointmentId } = body;

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { provider: { select: { firstName: true, lastName: true } }, clinic: { select: { name: true } }, patient: { select: { firstName: true, lastName: true } } },
    });
    if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    // Find all active waitlist entries for this provider + clinic
    const waitlistEntries = await prisma.cancellationWaitlist.findMany({
      where: {
        status: "active",
        OR: [
          { providerId: appt.providerId },
          { clinicId: appt.clinicId },
        ],
      },
    });

    if (waitlistEntries.length === 0) return NextResponse.json({ notified: 0 });

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
    const slotDate = appt.scheduledAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const slotTime = appt.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    // Update all entries as notified with expiry
    await prisma.cancellationWaitlist.updateMany({
      where: { id: { in: waitlistEntries.map(e => e.id) } },
      data: { status: "notified", notifiedAt: new Date(), expiresAt, claimedSlotId: appointmentId },
    });

    // Get patient contact info for notifications
    const patientIds = waitlistEntries.map(e => e.patientId);
    const patients = await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, firstName: true, phone: true, email: true },
    });

    // Log notifications (actual SMS/email would use Telnyx/SMTP)
    const notifications = patients.map(p => ({
      patientId: p.id,
      name: p.firstName,
      phone: p.phone,
      email: p.email,
      message: `An appointment slot just opened up! ${slotDate} at ${slotTime} with Dr. ${appt.provider?.lastName} at ${appt.clinic?.name}. You have 2 minutes to claim it. Reply CLAIM or visit your Patient Portal.`,
      method: "sms+email+in-app",
    }));

    console.log(`[Waitlist] Notified ${notifications.length} patients about slot: ${slotDate} ${slotTime}`);
    notifications.forEach(n => console.log(`  → ${n.name}: ${n.phone} / ${n.email}`));

    await auditSimple({ action: "WAITLIST_NOTIFIED", entityType: "appointment", entityId: appointmentId, userId: token.id as string,
      details: { slotDate, slotTime, provider: appt.provider?.lastName, patientsNotified: notifications.length, expiresAt: expiresAt.toISOString() } });

    return NextResponse.json({ success: true, notified: notifications.length, expiresAt: expiresAt.toISOString(), notifications });
  }

  // ── Claim a slot ───────────────────────────────────
  if (action === "claim") {
    const { entryId } = body;

    const entry = await prisma.cancellationWaitlist.findUnique({ where: { id: entryId } });
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (entry.status !== "notified") return NextResponse.json({ error: "Not available for claiming" }, { status: 400 });
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      await prisma.cancellationWaitlist.update({ where: { id: entryId }, data: { status: "expired" } });
      return NextResponse.json({ error: "Claim window has expired (2 minutes)", expired: true }, { status: 410 });
    }

    // Check if slot was already claimed by someone else
    if (entry.claimedSlotId) {
      const otherClaim = await prisma.cancellationWaitlist.findFirst({
        where: { claimedSlotId: entry.claimedSlotId, status: "claimed", id: { not: entryId } },
      });
      if (otherClaim) return NextResponse.json({ error: "This slot was already claimed by another patient", taken: true }, { status: 409 });
    }

    // Claim the slot
    await prisma.cancellationWaitlist.update({
      where: { id: entryId },
      data: { status: "claimed", claimedAt: new Date() },
    });

    // Create the new appointment from the cancelled one
    if (entry.claimedSlotId) {
      const origAppt = await prisma.appointment.findUnique({ where: { id: entry.claimedSlotId } });
      if (origAppt) {
        await prisma.appointment.create({
          data: {
            scheduledAt: origAppt.scheduledAt, duration: origAppt.duration, visitType: origAppt.visitType,
            status: "CONFIRMED", reasonForVisit: "Waitlist claim",
            patientId: entry.patientId, providerId: origAppt.providerId, clinicId: origAppt.clinicId,
            notes: `Claimed from waitlist. Original patient: ${origAppt.patientId}`,
          },
        });
      }

      // Expire all other entries for this slot
      await prisma.cancellationWaitlist.updateMany({
        where: { claimedSlotId: entry.claimedSlotId, status: "notified", id: { not: entryId } },
        data: { status: "expired" },
      });
    }

    await auditSimple({ action: "WAITLIST_CLAIMED", entityType: "waitlist", entityId: entryId, userId: token.id as string,
      details: { patientId: entry.patientId, slotId: entry.claimedSlotId } });

    return NextResponse.json({ success: true, claimed: true });
  }

  // ── Cleanup — remove patients who attended their appointment ─
  if (action === "cleanup") {
    const completedAppts = await prisma.appointment.findMany({
      where: { status: { in: ["COMPLETED", "CHECKED_IN"] } },
      select: { patientId: true },
    });
    const attendedPatientIds = [...new Set(completedAppts.map(a => a.patientId))];

    const result = await prisma.cancellationWaitlist.updateMany({
      where: { patientId: { in: attendedPatientIds }, status: { in: ["active", "notified"] } },
      data: { status: "fulfilled" },
    });

    return NextResponse.json({ success: true, cleaned: result.count });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
