/**
 * MyAIDoctor OpenAPI 3.0 Specification
 * Covers all inbound and outbound API endpoints
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "MyAIDoctor API",
    version: "1.0.0",
    description: "Complete REST API for MyAIDoctor.io clinical platform. Covers patients, appointments, pre-visit intake, messaging, voice calls, AI agents, and FHIR R4 integration.",
    contact: { name: "MyAIDoctor Support", email: "api@myaidoctor.io" },
  },
  servers: [{ url: "/api/v1", description: "Primary API" }],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Pass the JWT token from /api/auth/token" },
      ApiKey: { type: "apiKey", in: "header", name: "x-api-key", description: "API key from Super Admin → API Management" },
    },
    schemas: {
      Patient: { type: "object", properties: { id: { type: "string" }, mrn: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, dateOfBirth: { type: "string", format: "date" }, gender: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, allergies: { type: "array", items: { type: "string" } }, medications: { type: "array", items: { type: "string" } }, conditions: { type: "array", items: { type: "string" } } } },
      Appointment: { type: "object", properties: { id: { type: "string" }, scheduledAt: { type: "string", format: "date-time" }, duration: { type: "integer" }, visitType: { type: "string" }, status: { type: "string", enum: ["CONFIRMED", "PENDING", "CANCELLED", "NO_SHOW", "COMPLETED"] }, reasonForVisit: { type: "string" }, patientId: { type: "string" }, providerId: { type: "string" }, clinicId: { type: "string" } } },
      PreVisitBrief: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["PENDING", "COLLECTING", "READY"] }, chiefComplaint: { type: "string" }, soapNote: { type: "object" }, transcript: { type: "string" }, fhirBundle: { type: "object" }, riskScore: { type: "number" }, generatedAt: { type: "string", format: "date-time" } } },
      MessageLink: { type: "object", properties: { id: { type: "string" }, token: { type: "string" }, serviceType: { type: "string" }, status: { type: "string", enum: ["sent", "opened", "completed", "expired"] }, channel: { type: "string" }, sentAt: { type: "string", format: "date-time" } } },
      SOAPNote: { type: "object", properties: { subjective: { type: "string" }, objective: { type: "string" }, assessment: { type: "string" }, plan: { type: "string" }, differentials: { type: "array" }, redFlags: { type: "array" }, generatedBy: { type: "string" } } },
      FHIRBundle: { type: "object", properties: { resourceType: { type: "string", example: "Bundle" }, type: { type: "string", example: "transaction" }, entry: { type: "array" } } },
      SendMessageRequest: { type: "object", required: ["patientId", "serviceType"], properties: { patientId: { type: "string" }, appointmentId: { type: "string" }, serviceType: { type: "string", enum: ["pre_visit_intake", "referral_coordinator", "refill_manager", "schedule_assistant", "new_patient_onboarding", "chronic_disease_checkin", "lab_results_review", "post_visit_followup", "appointment_reminder", "appointment_scheduler"] }, channel: { type: "string", enum: ["sms", "whatsapp", "imessage"], default: "sms" } } },
      Error: { type: "object", properties: { error: { type: "string" }, code: { type: "integer" } } },
    },
  },
  paths: {
    "/patients": {
      get: { tags: ["Patients"], summary: "List patients", description: "Returns all patients with optional search filter", parameters: [{ name: "search", in: "query", schema: { type: "string" } }, { name: "clinicId", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", default: 50 } }], responses: { "200": { description: "Patient list", content: { "application/json": { schema: { type: "object", properties: { patients: { type: "array", items: { $ref: "#/components/schemas/Patient" } } } } } } } } },
      post: { tags: ["Patients"], summary: "Create patient (inbound)", description: "Create a new patient record. Used for EHR/HMS inbound integration.", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Patient" } } } }, responses: { "201": { description: "Patient created" } } },
    },
    "/patients/{id}": {
      get: { tags: ["Patients"], summary: "Get patient by ID", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Patient detail" } } },
      put: { tags: ["Patients"], summary: "Update patient (inbound)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Patient" } } } }, responses: { "200": { description: "Patient updated" } } },
    },
    "/appointments": {
      get: { tags: ["Appointments"], summary: "List appointments", parameters: [{ name: "date", in: "query", schema: { type: "string", format: "date" } }, { name: "providerId", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Appointment list" } } },
      post: { tags: ["Appointments"], summary: "Create appointment (inbound)", description: "Create appointment from EHR/scheduling system", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Appointment" } } } }, responses: { "201": { description: "Appointment created" } } },
    },
    "/appointments/{id}": {
      get: { tags: ["Appointments"], summary: "Get appointment details", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Appointment detail with pre-visit brief" } } },
      put: { tags: ["Appointments"], summary: "Update appointment (inbound)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
    },
    "/intake/{appointmentId}": {
      get: { tags: ["Pre-Visit Intake"], summary: "Get intake / SOAP note (outbound)", description: "Returns the pre-visit brief, SOAP note, transcript, and FHIR R4 bundle for an appointment. Primary outbound endpoint for EMR integration.", parameters: [{ name: "appointmentId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Pre-visit brief with SOAP and FHIR bundle", content: { "application/json": { schema: { type: "object", properties: { brief: { $ref: "#/components/schemas/PreVisitBrief" }, soap: { $ref: "#/components/schemas/SOAPNote" }, fhir: { $ref: "#/components/schemas/FHIRBundle" } } } } } } } },
      post: { tags: ["Pre-Visit Intake"], summary: "Submit intake data (inbound)", description: "Submit intake data from external source (EHR, third-party app). Generates SOAP note and FHIR bundle.", parameters: [{ name: "appointmentId", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { chiefComplaint: { type: "string" }, symptoms: { type: "object" }, medications: { type: "string" }, allergies: { type: "string" } } } } } }, responses: { "200": { description: "Intake processed, SOAP generated" } } },
    },
    "/intake/{appointmentId}/fhir": {
      get: { tags: ["Pre-Visit Intake", "FHIR"], summary: "Get FHIR R4 bundle (outbound)", description: "Returns the complete FHIR R4 transaction bundle for EMR integration (BluHealth, Epic, Cerner, etc.)", parameters: [{ name: "appointmentId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "FHIR R4 Bundle", content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FHIRBundle" } } } } } },
    },
    "/messaging/send": {
      post: { tags: ["Messaging"], summary: "Send patient link (outbound)", description: "Send an SMS/WhatsApp link to a patient for any service type", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/SendMessageRequest" } } } }, responses: { "200": { description: "Message sent", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, link: { type: "string" }, token: { type: "string" } } } } } } } },
    },
    "/messaging/bulk": {
      post: { tags: ["Messaging"], summary: "Bulk send links (outbound)", description: "Send links to multiple patients at once", requestBody: { content: { "application/json": { schema: { type: "object", properties: { patientIds: { type: "array", items: { type: "string" } }, serviceType: { type: "string" } } } } } }, responses: { "200": { description: "Bulk send results" } } },
    },
    "/messaging/status/{token}": {
      get: { tags: ["Messaging"], summary: "Get link status", parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Link status" } } },
    },
    "/messaging/webhook": {
      post: { tags: ["Messaging"], summary: "SMS delivery webhook (inbound)", description: "Receives delivery status updates from Twilio/Telnyx", responses: { "200": { description: "Acknowledged" } } },
    },
    "/voice/call": {
      post: { tags: ["Voice"], summary: "Trigger outbound call", description: "Initiate an AI voice call to a patient via Vapi.ai or Retell AI", requestBody: { content: { "application/json": { schema: { type: "object", required: ["patientId", "phoneNumber"], properties: { patientId: { type: "string" }, phoneNumber: { type: "string" }, appointmentId: { type: "string" }, serviceType: { type: "string" } } } } } }, responses: { "200": { description: "Call initiated" } } },
    },
    "/voice/webhook": {
      post: { tags: ["Voice"], summary: "Voice call webhook (inbound)", description: "Receives call completion data, transcript, and recordings from Vapi.ai/Retell AI", responses: { "200": { description: "Acknowledged" } } },
    },
    "/agents": {
      get: { tags: ["AI Agents"], summary: "List AI agents", responses: { "200": { description: "Agent list" } } },
      post: { tags: ["AI Agents"], summary: "Create AI agent", responses: { "201": { description: "Agent created" } } },
    },
    "/agents/{id}/trigger": {
      post: { tags: ["AI Agents"], summary: "Trigger agent execution (inbound)", description: "Manually trigger an AI agent workflow for a specific patient/appointment", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { patientId: { type: "string" }, appointmentId: { type: "string" }, context: { type: "object" } } } } } }, responses: { "200": { description: "Agent triggered" } } },
    },
  },
  tags: [
    { name: "Patients", description: "Patient CRUD — inbound from EHR, outbound to integrations" },
    { name: "Appointments", description: "Appointment management — syncs with scheduling systems" },
    { name: "Pre-Visit Intake", description: "Clinical intake, SOAP notes, and FHIR R4 bundles" },
    { name: "FHIR", description: "FHIR R4 standard resources for EMR/HMS integration" },
    { name: "Messaging", description: "SMS/WhatsApp patient links — outbound delivery + inbound webhooks" },
    { name: "Voice", description: "AI voice calls — outbound calls + inbound completion webhooks" },
    { name: "AI Agents", description: "Workflow automation agents — trigger and manage" },
  ],
};
