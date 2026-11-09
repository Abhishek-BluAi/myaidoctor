const vapiKey = "5d0e90d8-1b9f-40a8-bebf-dcacaebb7d46";
const vapiAgentId = "480d6664-2f41-4d06-bc22-54a09e45d7b4";
const phoneNumberId = "23bf2afd-7a67-4c0b-a5cd-0b33930dffb3";

const payload = {
  phoneNumberId: phoneNumberId,
  customer: { number: "+919341307595" },
  metadata: { appointmentId: "cmulmr3fi002ia61olehr0npl" },
  assistantId: vapiAgentId,
  assistantOverrides: {
    variableValues: {
      patientInfo: "Test system prompt"
    }
  }
};

fetch("https://api.vapi.ai/call/phone", {
  method: "POST",
  headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}).then(r => r.json()).then(console.log).catch(e => console.error(e.message));
