const vapiKey = "5d0e90d8-1b9f-40a8-bebf-dcacaebb7d46";
const vapiAgentId = "invalid-assistant-id";
const phoneNumberId = "23bf2afd-7a67-4c0b-a5cd-0b33930dffb3";

const payload = {
  phoneNumberId: phoneNumberId,
  customer: { number: "+14155552671" }, // US number to avoid 400
  assistantId: vapiAgentId,
};

fetch("https://api.vapi.ai/call/phone", {
  method: "POST",
  headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}).then(r => console.log("Status:", r.status)).catch(e => console.error(e.message));
