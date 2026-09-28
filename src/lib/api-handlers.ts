import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSOAPNote, generateBrief } from "@/lib/clinical/engine";
import { MockEHRAdapter } from "@/lib/ehr/adapters";
import { buildFHIRBundle } from "@/lib/fhir/resources";

/** API Key validation */
async function validateApiKey(req: NextRequest): Promise<{ valid: boolean; role?: string; error?: string }> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { valid: false, error: "Missing x-api-key header" };
  try {
    const key = await prisma.systemSetting.findFirst({ where: { key: "api_keys", value: { contains: apiKey } } });
    if (key) return { valid: true, role: "admin" };
    // Fallback: check env
    if (apiKey === process.env.API_SECRET_KEY) return { valid: true, role: "admin" };
    return { valid: false, error: "Invalid API key" };
  } catch {
    if (apiKey === process.env.API_SECRET_KEY) return { valid: true, role: "admin" };
    return { valid: false, error: "Invalid API key" };
  }
}

function unauthorized(msg: string) { return NextResponse.json({ error: msg }, { status: 401 }); }

// ── PATIENTS ────────────────────────────────────────────

export async function handlePatients(req: NextRequest, segments: string[]) {
  const auth = await validateApiKey(req);
  if (!auth.valid) return unauthorized(auth.error!);

  const id = segments[0];

  if (req.method === "GET" && !id) {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const patients = await prisma.patient.findMany({
      where: search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { mrn: { contains: search } }] } : {},
      take: parseInt(url.searchParams.get("limit") || "50"),
      orderBy: { lastName: "asc" },
    });
    return NextResponse.json({ patients, total: patients.length });
  }

  if (req.method === "GET" && id) {
    const patient = await prisma.patient.findUnique({ where: { id }, include: { appointments: { take: 10, orderBy: { scheduledAt: "desc" } } } });
    if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ patient });
  }

  if (req.method === "POST") {
    const data = await req.json();
    const patient = await prisma.patient.create({ data });
    return NextResponse.json({ patient }, { status: 201 });
  }

  if (req.method === "PUT" && id) {
    const data = await req.json();
    const patient = await prisma.patient.update({ where: { id }, data });
    return NextResponse.json({ patient });
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

// ── APPOINTMENTS ────────────────────────────────────────

export async function handleAppointments(req: NextRequest, segments: string[]) {
  const auth = await validateApiKey(req);
  if (!auth.valid) return unauthorized(auth.error!);

  const id = segments[0];

  if (req.method === "GET" && !id) {
    const url = new URL(req.url);
    const where: any = {};
    if (url.searchParams.get("date")) { const d = new Date(url.searchParams.get("date")!); where.scheduledAt = { gte: d, lt: new Date(d.getTime() + 86400000) }; }
    if (url.searchParams.get("providerId")) where.providerId = url.searchParams.get("providerId");
    if (url.searchParams.get("status")) where.status = url.searchParams.get("status");
    const appointments = await prisma.appointment.findMany({ where, include: { patient: { select: { firstName: true, lastName: true } }, provider: { select: { firstName: true, lastName: true } }, preVisitBrief: { select: { id: true, status: true } } }, orderBy: { scheduledAt: "asc" }, take: 50 });
    return NextResponse.json({ appointments });
  }

  if (req.method === "GET" && id) {
    const appt = await prisma.appointment.findUnique({ where: { id }, include: { patient: true, provider: { select: { firstName: true, lastName: true } }, clinic: true, preVisitBrief: true } });
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ appointment: appt });
  }

  if (req.method === "POST") {
    const data = await req.json();
    const appt = await prisma.appointment.create({ data });
    return NextResponse.json({ appointment: appt }, { status: 201 });
  }

  if (req.method === "PUT" && id) {
    const data = await req.json();
    const appt = await prisma.appointment.update({ where: { id }, data });
    return NextResponse.json({ appointment: appt });
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

// ── INTAKE ──────────────────────────────────────────────

export async function handleIntake(req: NextRequest, segments: string[]) {
  const auth = await validateApiKey(req);
  if (!auth.valid) return unauthorized(auth.error!);

  const appointmentId = segments[0];
  const subResource = segments[1]; // "fhir"

  if (req.method === "GET" && appointmentId) {
    const brief = await prisma.preVisitBrief.findUnique({ where: { appointmentId }, include: { patient: { select: { firstName: true, lastName: true } } } });
    if (!brief) return NextResponse.json({ error: "No intake found" }, { status: 404 });

    if (subResource === "fhir") {
      return NextResponse.json(brief.fhirBundle || { error: "No FHIR bundle generated" }, { headers: { "Content-Type": "application/fhir+json" } });
    }

    return NextResponse.json({ brief: { ...brief, soap: brief.soapNote, fhir: brief.fhirBundle } });
  }

  if (req.method === "POST" && appointmentId) {
    const intake = await req.json();
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true, provider: { select: { firstName: true, lastName: true } }, clinic: true } });
    if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    const context = await new MockEHRAdapter().getPatientContext(appt.patientId);
    const soap = await generateSOAPNote(intake, context);
    const brief = generateBrief(intake, context, soap);
    const fhirBundle = buildFHIRBundle({ patient: { id: appt.patientId, firstName: appt.patient.firstName, lastName: appt.patient.lastName, dob: appt.patient.dateOfBirth?.toISOString().slice(0, 10) || "", gender: appt.patient.gender || "unknown", phone: appt.patient.phone }, encounter: { id: appointmentId, date: appt.scheduledAt.toISOString(), type: appt.visitType, provider: `Dr. ${appt.provider?.lastName}`, clinic: appt.clinic?.name || "" }, intake, soap });

    await prisma.preVisitBrief.upsert({
      where: { appointmentId },
      update: { status: "READY", chiefComplaint: intake.chiefComplaint, soapNote: soap as any, fhirBundle: fhirBundle as any, clinicalSummary: brief.clinicalNarrative, riskScore: brief.riskScore, generatedAt: new Date() },
      create: { appointmentId, patientId: appt.patientId, providerId: appt.providerId || "", status: "READY", chiefComplaint: intake.chiefComplaint, soapNote: soap as any, fhirBundle: fhirBundle as any, clinicalSummary: brief.clinicalNarrative, riskScore: brief.riskScore, generatedAt: new Date() },
    });

    return NextResponse.json({ success: true, soap, fhirBundle, brief: { riskScore: brief.riskScore, completionRate: brief.completionRate } });
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
