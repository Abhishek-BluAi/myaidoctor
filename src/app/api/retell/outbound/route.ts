import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { createOutboundCall, getVoiceAIConfig } from "@/lib/voice-ai";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { patientId, appointmentId } = await req.json();

  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });

  try {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const appointment = appointmentId
      ? await prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { provider: { select: { firstName: true, lastName: true } }, clinic: true },
        })
      : null;

    const config = await getVoiceAIConfig();
    const fromNumber = appointment?.clinic?.phone || Object.values(config.clinicPhones).find(Boolean) || "+10000000000";

    const result = await createOutboundCall({
      patientPhone: patient.phone,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientDob: patient.dateOfBirth?.toISOString().slice(0, 10) || "",
      conditions: patient.conditions?.join(", ") || "none reported",
      medications: patient.medications?.join(", ") || "none reported",
      appointmentDate: appointment?.scheduledAt?.toISOString() || "not scheduled",
      providerName: appointment?.provider
        ? `Dr. ${appointment.provider.lastName}`
        : "your provider",
      fromNumber,
      metadata: {
        patientId,
        appointmentId: appointmentId || "",
        providerId: (token.id as string) || "",
        callType: "PRE_VISIT",
      },
    });

    if (result.success) {
      // Create a pending VoiceCall record
      const voiceCall = await prisma.voiceCall.create({
        data: {
          direction: "OUTBOUND",
          callType: "PRE_VISIT",
          status: "QUEUED",
          phoneNumber: patient.phone,
          retellCallId: result.callId,
          patientId,
          appointmentId: appointmentId || null,
          providerId: token.id as string,
        },
      });

      await audit(req, {
        action: "VOICE_CALL_INITIATED",
        entityType: "voice_call",
        entityId: voiceCall.id,
        userId: token.id as string,
        userEmail: token.email as string,
        details: {
          patientId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          appointmentId,
          mode: config.mode,
          retellCallId: result.callId,
        },
      });

      return NextResponse.json({
        success: true,
        callId: voiceCall.id,
        retellCallId: result.callId,
        message: result.message,
        mode: config.mode,
      });
    }

    return NextResponse.json({ success: false, error: result.message }, { status: 500 });
  } catch (error) {
    console.error("Outbound call error:", error);
    return NextResponse.json({ error: "Failed to initiate call" }, { status: 500 });
  }
}
