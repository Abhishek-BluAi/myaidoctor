async function run() {
  try {
    const res = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: { 
        "Authorization": "Bearer df41e8c1-1e96-419b-a0d0-40e8e910411d", 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        phoneNumberId: "cefeff17-3cc3-4876-905f-7be857026569",
        customer: { number: "+919876543210" },
        assistant: {
          model: { 
            provider: "anthropic", 
            model: "claude-3-5-sonnet-20241022", 
            messages: [{ role: "system", content: "Test prompt" }] 
          },
          voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
          firstMessage: "Hi there",
          recordingEnabled: true,
          transcriptionEnabled: true,
        },
      }),
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (e) {
    console.error(e);
  }
}
run();
