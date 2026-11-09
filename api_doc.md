# MyAIDoctor API Reference

## 1. Overview

Base URL for local development:

```text
http://localhost:3000
```

All JSON requests must send:

```http
Content-Type: application/json
```

The application uses two authentication styles:

- **Browser/session APIs:** authenticated with the NextAuth session cookie created by the login flow.
- **Versioned integration APIs:** authenticated with the `x-api-key` header. The key must match `API_SECRET_KEY` or a configured `api_keys` system setting.

Never commit API keys, provider credentials, or production secrets to this repository.

## 2. Authentication

### Browser/session authentication

Log in through the application login page. The browser then sends the NextAuth session cookie automatically. Protected routes return:

```json
{
  "error": "Unauthorized"
}
```

with HTTP `401` when the session is missing or expired.

### API-key authentication

For `/api/v1/*` integration routes:

```http
x-api-key: <API_SECRET_KEY>
```

Missing or invalid keys return HTTP `401`.

## 3. Patient phone-call request

The patient portal calls this endpoint when the patient selects **Phone Call**.

### `POST /api/voice-call`

Creates a `CallRequest` for care-team follow-up. Phone calls are currently saved for manual follow-up; no Vapi or Retell call is placed.

Authentication: NextAuth browser session. The logged-in patient must own the appointment supplied in the request.

#### Request body

```json
{
  "action": "request",
  "appointmentId": "cmvux4mzt002g06ax22xyiqgg"
}
```

The patient phone is read from the authenticated patient record. Response: HTTP `201`.

```json
{
  "success": true,
  "requestId": "cmvux4n7k002g06ax22xyiqgg",
  "status": "REQUESTED"
}
```

Fields:

| Field | Type | Required | Description |
|---|---|---:|---|
| `action` | string | yes | Must be `request`. |
| `appointmentId` | string | no | Related appointment. If supplied, it must belong to the logged-in patient. |
The phone number is read from the authenticated patient's record and stored in `call_requests`.

The patient sees a confirmation screen after this response. The request remains `REQUESTED` until the care team handles it.

Legacy `action: "call"` requests return HTTP `410` and do not contact an AI or telephony provider.

#### Other errors

| Status | Meaning |
|---:|---|
| `400` | Invalid request payload. |
| `401` | No valid logged-in session. |
| `403` | Appointment belongs to another patient. |
| `404` | Patient or appointment was not found. |
| `410` | Provider dialing is intentionally disabled. |
| `500` | Internal failure. |

### `POST /api/voice-call` with `action=status`

Returns voice-provider availability. This endpoint is used by the intake page before displaying the call form.

Request:

```json
{ "action": "status" }
```

Response:

```json
{
  "configured": true,
  "provider": "Vapi.ai",
  "phoneNumber": "+15555550100",
  "costPerMin": "$0.05"
}
```

### Voice provider webhooks

Configure the provider webhook URL as:

```text
POST https://<your-domain>/api/voice-call
```

Vapi sends an `end-of-call-report`; Retell sends a `call_ended` event. The outbound request stores `callRequestId` and `appointmentId` in provider metadata. The webhook uses that metadata to mark the related `CallRequest` as `COMPLETED` and saves the transcript as intake data when available.

Webhook authentication/signature verification should be enabled before production exposure according to the provider's dashboard configuration.

## 4. `CallRequest` database record

Prisma model: `CallRequest`; SQL table: `call_requests`.

| Field | Type | Description |
|---|---|---|
| `id` | string | CUID primary key. |
| `userId` | string | Authenticated user who requested the call. |
| `patientId` | string | Patient receiving the call. |
| `appointmentId` | string or null | Related appointment, if provided. |
| `phoneNumber` | string | Number submitted for the call. |
| `status` | string | `REQUESTED`, `QUEUED`, `RINGING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, or `NO_ANSWER`. |
| `provider` | string or null | `vapi` or `retell`. |
| `externalCallId` | string or null | Provider call identifier. |
| `errorMessage` | string or null | Failure detail safe for internal diagnostics. |
| `requestedAt` | datetime | Time the patient requested the call. |
| `startedAt` | datetime or null | Time the provider accepted/started the call. |
| `completedAt` | datetime or null | Time the completion webhook was received. |
| `createdAt` / `updatedAt` | datetime | Record audit timestamps. |

Useful verification query:

```bash
PGPASSWORD='myaidoctor_pass' psql -U myaidoctor -h localhost -d myaidoctor_db \
  -c 'SELECT id, user_id, patient_id, appointment_id, phone_number, status, provider, requested_at FROM call_requests ORDER BY requested_at DESC;'
```

## 5. Versioned integration API

Base path: `/api/v1`

All endpoints below require `x-api-key`.

### Patients

#### `GET /api/v1/patients`

Query parameters:

| Parameter | Type | Description |
|---|---|---|
| `search` | string | Searches first name, last name, or MRN. |
| `limit` | integer | Maximum results; default `50`. |

Response:

```json
{ "patients": [], "total": 0 }
```

#### `GET /api/v1/patients/{patientId}`

Returns one patient and up to 10 latest appointments.

#### `POST /api/v1/patients`

Creates a patient. The JSON body must match the patient fields required by the Prisma schema, including `mrn`, name, date of birth, gender, and phone.

#### `PUT /api/v1/patients/{patientId}`

Updates the patient with the JSON body fields supplied.

### Appointments

#### `GET /api/v1/appointments`

Query parameters: `date`, `providerId`, and `status`.

Response:

```json
{ "appointments": [] }
```

#### `GET /api/v1/appointments/{appointmentId}`

Returns the appointment with patient, provider, clinic, and pre-visit brief data.

#### `POST /api/v1/appointments`

Creates an appointment. Send the appointment fields as JSON. `scheduledAt` must be an ISO-8601 datetime.

#### `PUT /api/v1/appointments/{appointmentId}`

Updates the supplied appointment fields.

### Intake

#### `GET /api/v1/intake/{appointmentId}`

Returns the pre-visit brief, SOAP note, and FHIR bundle for an appointment.

#### `GET /api/v1/intake/{appointmentId}/fhir`

Returns the FHIR bundle with `Content-Type: application/fhir+json`.

#### `POST /api/v1/intake/{appointmentId}`

Generates or updates the pre-visit brief and SOAP note.

Example body:

```json
{
  "chiefComplaint": "Blood sugar has been high in the mornings",
  "hpiNarrative": "Patient reports elevated morning readings for two weeks.",
  "symptomDetails": {},
  "reviewOfSystems": {},
  "medications": [],
  "allergies": [],
  "conversationTranscript": ""
}
```

## 6. Other application route groups

These routes are implemented under `src/app/api` and generally use the browser session unless noted. Request-specific fields should be checked in the route implementation before integration.

| Route group | Purpose |
|---|---|
| `/api/auth/*` | Login, registration, password reset, MFA, permissions, and NextAuth callbacks. |
| `/api/patient/chat` | Patient conversational intake start, message, submit, and AI status actions. |
| `/api/patient/intake` | Patient intake progress and completion operations. |
| `/api/patient/appointment` | Patient appointment operations. |
| `/api/appointments` | Authenticated appointment listing and creation. |
| `/api/patients` | Authenticated patient operations. |
| `/api/voice-call` | Phone-call status, outbound call creation, and Vapi/Retell webhooks. |
| `/api/voice-calls` | Voice-call management views and operations. |
| `/api/retell/*` | Retell outbound calls, status, functions, and webhook integration. |
| `/api/inbound-call` | Inbound call handling. |
| `/api/pre-visit/*` | Pre-visit workflows, scheduling, SOAP generation, and intake operations. |
| `/api/emr-sync` | EHR synchronization operations. |
| `/api/messaging` | Messaging operations. |
| `/api/waitlist` | Cancellation waitlist operations. |
| `/api/clinics` | Clinic operations. |
| `/api/dashboard` | Dashboard data. |
| `/api/admin/*` | Admin approvals, invitations, and pending users. |
| `/api/super-admin/*` | Super-admin users, roles, protocols, clinics, hospitals, services, settings, audit logs, AI agents, and voice pipeline configuration. |
| `/api/public/lead` | Public lead submission. |
| `/api/v1/openapi.json` | Machine-readable OpenAPI document for the versioned integration API. |
| `/api/v1/docs` | Same OpenAPI document response. |

## 7. Local database setup

Start PostgreSQL:

```bash
docker compose up -d db
```

Apply the Prisma schema, including `call_requests`:

```bash
npx prisma db push
```

Seed a fresh development database:

```bash
npx prisma db push --force-reset
node scripts/seed.js
```

The seed script is intended for a fresh development database. Running it repeatedly without a reset creates duplicate non-user records and stops on unique user emails.
