async function test() {
  const res = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: "dummy-uuid",
        customer: { number: "+123" },
        assistant: {
          model: { provider: "anthropic", model: "claude-3-5-sonnet-20241022", systemPrompt: "test" },
          voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" }
        }
      })
  });
  console.log(res.status, await res.text());
}
test();
