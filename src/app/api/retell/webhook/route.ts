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
  const { event, call } = body;

  try {
    switch (event) {
      case "call_ended": {
        const metadata = call.metadata || {};

        const voiceCall = await prisma.voiceCall.create({
          data: {
            direction: call.direction === "inbound" ? "INBOUND" : "OUTBOUND",
            callType: (metadata.callType as any) || "GENERAL_INQUIRY",
            status: "COMPLETED",
            phoneNumber: call.from_number || call.to_number || "unknown",
            startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
            endedAt: call.end_timestamp ? new Date(call.end_timestamp) : new Date(),
            durationSeconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : 0,
            attempts: 1,
            sentiment: call.call_analysis?.user_sentiment || "neutral",
            completionRate: call.call_analysis?.completion_rate || 0,
            transcript: call.transcript || null,
            dataCollected: call.call_analysis?.custom_analysis_data || null,
            retellCallId: call.call_id || null,
            retellAgentId: call.agent_id || null,
            recordingUrl: call.recording_url || null,
            callAnalysis: call.call_analysis || null,
            patientId: metadata.patientId,
            appointmentId: metadata.appointmentId || null,
            providerId: metadata.providerId || null,
          },
        });

        await audit(req, {
          action: "VOICE_CALL_COMPLETED",
          entityType: "voice_call",
          entityId: voiceCall.id,
          details: {
            direction: voiceCall.direction,
            duration: voiceCall.durationSeconds,
            callType: voiceCall.callType,
            retellCallId: voiceCall.retellCallId,
          },
        });

        break;
      }

      case "call_started": {
        await audit(req, {
          action: "VOICE_CALL_STARTED",
          entityType: "voice_call",
          entityId: call.call_id || "unknown",
          details: { direction: call.direction, to: call.to_number },
        });
        break;
      }

      case "call_analyzed": {
        if (call.call_id) {
          await prisma.voiceCall.updateMany({
            where: { retellCallId: call.call_id },
            data: {
              callAnalysis: call.call_analysis || null,
              sentiment: call.call_analysis?.user_sentiment || undefined,
            },
          });
        }
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Retell webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
