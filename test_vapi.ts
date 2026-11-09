import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVapi() {
  const row = await prisma.systemSetting.findFirst({
    where: { key: "voice_api_key" }
  });
  
  const phoneRow = await prisma.systemSetting.findFirst({
    where: { key: "voice_phone_number" }
  });
  
  const vapiKey = row?.value;
  const phoneNumberId = phoneRow?.value;
  
  if (!vapiKey) {
    console.log("No VAPI key found");
    return;
  }
  
  const systemPrompt = "Test prompt";
  
  const res = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: phoneNumberId,
        customer: { number: "+19341307595" },
        assistant: {
          model: { provider: "anthropic", model: "claude-3-5-sonnet-20241022", systemPrompt },
          voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
          firstMessage: "Hi there!",
          endCallMessage: "Thank you!",
          recordingEnabled: true,
          transcriptionEnabled: true,
        },
        metadata: { appointmentId: "test" },
      }),
  });
  
  console.log(res.status);
  console.log(await res.text());
}

testVapi();
