import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRetellSignature } from "@/lib/voice-ai";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-retell-signature");
  if (!(await verifyRetellSignature(signature))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { args } = body;

  try {
    switch (args?.function_name) {
      case "lookup_patient": {
        const patient = await prisma.patient.findFirst({
          where: { phone: args.phone_number },
          include: {
            appointments: {
              where: { scheduledAt: { gte: new Date() } },
              take: 1,
              orderBy: { scheduledAt: "asc" },
              include: { provider: { select: { firstName: true, lastName: true } } },
            },
          },
        });

        if (!patient) {
          return NextResponse.json({
            result: "I don't have a record for this phone number. Could you provide your date of birth so I can look you up?",
          });
        }

        await audit(req, {
          action: "VOICE_PATIENT_LOOKUP",
          entityType: "patient",
          entityId: patient.id,
          details: { source: "voice_call_function" },
        });

        return NextResponse.json({
          result: JSON.stringify({
            name: `${patient.firstName} ${patient.lastName}`,
            dob: patient.dateOfBirth,
            conditions: patient.conditions,
            medications: patient.medications,
            allergies: patient.allergies,
            nextAppointment: patient.appointments[0]?.scheduledAt,
            provider: patient.appointments[0]?.provider
              ? `Dr. ${patient.appointments[0].provider.lastName}`
              : null,
          }),
        });
      }

      case "save_symptom_data": {
        if (args.call_record_id) {
          const existing = await prisma.voiceCall.findUnique({
            where: { id: args.call_record_id },
            select: { dataCollected: true },
          });

          await prisma.voiceCall.update({
            where: { id: args.call_record_id },
            data: {
              dataCollected: {
                ...((existing?.dataCollected as any) || {}),
                [args.data_key]: args.data_value,
              },
            },
          });
        }
        return NextResponse.json({ result: "Saved successfully" });
      }

      case "check_red_flag": {
        await audit(req, {
          action: "VOICE_RED_FLAG_DETECTED",
          entityType: "voice_call",
          entityId: args.call_id || "unknown",
          details: { symptom: args.symptom, severity: args.severity, patientName: args.patient_name },
        });

        const instruction = args.severity === "HIGH"
          ? "This is a critical red flag. Advise the patient to seek immediate emergency care or call 911. Do not continue routine data collection."
          : "Flag this for provider review. Continue collecting data but note the concern.";

        return NextResponse.json({ result: instruction });
      }

      case "verify_insurance": {
        return NextResponse.json({
          result: `Insurance verification for ${args.carrier} member ${args.member_id}: Coverage confirmed (mock verification). Please verify with the billing department.`,
        });
      }

      default:
        return NextResponse.json({ result: "Unknown function" });
    }
  } catch (error) {
    console.error("Retell function error:", error);
    return NextResponse.json({ result: "Function execution failed" });
  }
}
