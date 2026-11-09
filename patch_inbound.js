const fs = require('fs');
const file = 'src/app/api/voice-call/route.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('assistant-request')) {
  const injection = `
  // ── Vapi.ai inbound call (assistant-request) ─────────────
  if (body.message?.type === "assistant-request") {
    return handleVapiAssistantRequest(body);
  }
`;
  code = code.replace('// ── Vapi.ai webhook (call completed) ───────────────────', injection + '\n  // ── Vapi.ai webhook (call completed) ───────────────────');
  
  const functionInjection = `
async function handleVapiAssistantRequest(body: any) {
  try {
    const customerNumber = body.message?.call?.customer?.number;
    let systemPrompt = "";
    
    if (customerNumber) {
      // Find patient by phone
      const patient = await prisma.patient.findFirst({
        where: { phone: { contains: customerNumber.slice(-10) } }, // match last 10 digits
        include: { clinic: true }
      });
      
      if (patient) {
        // Find upcoming appointment
        const appointment = await prisma.appointment.findFirst({
          where: { patientId: patient.id, status: { in: ["SCHEDULED", "CONFIRMED"] } },
          orderBy: { scheduledAt: 'asc' },
          include: { provider: true }
        });
        
        const data = {
          patientDetails: patient,
          upcomingAppointment: appointment ? {
            date: appointment.scheduledAt,
            provider: appointment.provider ? \`\${appointment.provider.firstName} \${appointment.provider.lastName}\` : 'Unknown Provider',
            visitType: appointment.visitType,
            clinic: patient.clinic?.name
          } : null,
          pastHistory: []
        };
        
        systemPrompt = buildClaudeSystemPrompt({ phase: "consent", phaseStep: 0, data, consentGiven: false, complete: false });
      } else {
         systemPrompt = "You are Riley from Wellness Partners. A new patient is calling. Ask for their name and how you can help them.";
      }
    }

    return NextResponse.json({
      assistant: {
        variableValues: {
          patientInfo: systemPrompt
        }
      }
    });
  } catch (e: any) {
    console.error("[VAPI Assistant Request Error]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
`;
  code += '\n' + functionInjection;
  fs.writeFileSync(file, code);
  console.log("Inbound patched");
}
