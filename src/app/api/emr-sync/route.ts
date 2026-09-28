import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

/** Mock BluHealth patient database (simulates external EMR) */
const MOCK_EMR_PATIENTS = [
  { emrId: "BH-10001", mrn: "BH-MRN-001", firstName: "Robert", lastName: "Williams", dob: "1958-11-03", gender: "Male", phone: "(313) 555-8801", email: "rwilliams@email.com", insurance: "Medicare", policyId: "MCA-112233", conditions: ["Atrial Fibrillation", "COPD"], medications: ["Warfarin 5mg", "Tiotropium 18mcg"], allergies: ["Aspirin"] },
  { emrId: "BH-10002", mrn: "BH-MRN-002", firstName: "Linda", lastName: "Garcia", dob: "1972-06-18", gender: "Female", phone: "(248) 555-7702", email: "lgarcia@email.com", insurance: "Aetna", policyId: "AET-445566", conditions: ["Type 2 Diabetes", "Hypothyroidism"], medications: ["Metformin 1000mg BID", "Levothyroxine 75mcg"], allergies: ["Sulfa drugs", "Latex"] },
  { emrId: "BH-10003", mrn: "BH-MRN-003", firstName: "James", lastName: "Chen", dob: "1990-02-25", gender: "Male", phone: "(734) 555-3303", email: "jchen@email.com", insurance: "United Healthcare", policyId: "UHC-778899", conditions: ["Asthma", "Anxiety Disorder"], medications: ["Albuterol PRN", "Sertraline 50mg"], allergies: [] },
  { emrId: "BH-10004", mrn: "BH-MRN-004", firstName: "Patricia", lastName: "Johnson", dob: "1965-09-14", gender: "Female", phone: "(248) 555-4404", email: "pjohnson@email.com", insurance: "Blue Cross", policyId: "BCBS-334455", conditions: ["Hypertension", "Osteoarthritis", "Depression"], medications: ["Amlodipine 10mg", "Celecoxib 200mg", "Escitalopram 10mg"], allergies: ["Penicillin", "Codeine"] },
  { emrId: "BH-10005", mrn: "BH-MRN-005", firstName: "Jane", lastName: "Smith", dob: "1985-03-15", gender: "Female", phone: "(248) 555-1234", email: "jane.smith@email.com", insurance: "Blue Cross Blue Shield", policyId: "BCBS-99887766", conditions: ["Type 2 Diabetes", "Hypertension", "Asthma"], medications: ["Metformin 500mg BID", "Lisinopril 10mg", "Albuterol PRN"], allergies: ["Penicillin", "Shellfish"] },
];

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, ...body } = await req.json();

  // ── Search external EMR ───────────────────────────────
  if (action === "search_emr") {
    const { query, emrSystem } = body;
    if (!query) return NextResponse.json({ results: [] });

    const config = await getEMRConfig(emrSystem);

    if (config.mode === "live" && config.fhirUrl) {
      return searchLiveFHIR(config, query);
    }

    // Mock search
    const lower = query.toLowerCase();
    const results = MOCK_EMR_PATIENTS.filter((p: any) =>
      p.firstName.toLowerCase().includes(lower) ||
      p.lastName.toLowerCase().includes(lower) ||
      p.phone.includes(query) ||
      p.mrn.toLowerCase().includes(lower) ||
      p.email?.toLowerCase().includes(lower)
    );

    return NextResponse.json({ results, source: emrSystem || "BluHealth (Mock)", mode: "mock" });
  }

  // ── Import patient from EMR ───────────────────────────
  if (action === "import") {
    const { emrPatient, clinicId } = body;
    if (!emrPatient) return NextResponse.json({ error: "emrPatient required" }, { status: 400 });

    // Check if already exists
    const existing = await prisma.patient.findFirst({
      where: { OR: [
        { email: emrPatient.email || "___" },
        { phone: { contains: emrPatient.phone?.replace(/\D/g, "").slice(-4) || "___" } },
      ] },
    });

    if (existing) {
      return NextResponse.json({ exists: true, patient: existing, emrPatient, message: "Patient already exists — use sync to update" });
    }

    const count = await prisma.patient.count();
    const patient = await prisma.patient.create({
      data: {
        mrn: `MRN-${String(count + 1001).padStart(6, "0")}`,
        firstName: emrPatient.firstName,
        lastName: emrPatient.lastName,
        dateOfBirth: new Date(emrPatient.dob),
        gender: emrPatient.gender,
        phone: emrPatient.phone,
        email: emrPatient.email,
        insuranceProvider: emrPatient.insurance,
        insurancePolicyId: emrPatient.policyId,
        conditions: emrPatient.conditions || [],
        medications: emrPatient.medications || [],
        allergies: emrPatient.allergies || [],
        consentGiven: false,
        clinicId: clinicId || undefined,
      },
    });

    return NextResponse.json({ imported: true, patient });
  }

  // ── Sync: compare local vs EMR and find conflicts ─────
  if (action === "sync_check") {
    const { patientId, emrPatient } = body;
    const local = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!local) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const conflicts: any[] = [];
    const fields = [
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "insuranceProvider", emrKey: "insurance", label: "Insurance Provider" },
      { key: "insurancePolicyId", emrKey: "policyId", label: "Policy ID" },
    ];

    for (const f of fields) {
      const localVal = (local as any)[f.key] || "";
      const emrVal = emrPatient[f.emrKey || f.key] || "";
      if (localVal && emrVal && localVal !== emrVal) {
        conflicts.push({ field: f.label, key: f.key, emrKey: f.emrKey || f.key, local: localVal, emr: emrVal });
      }
    }

    // Compare arrays
    const localMeds = ((local.medications as string[]) || []).sort().join(", ");
    const emrMeds = (emrPatient.medications || []).sort().join(", ");
    if (localMeds !== emrMeds && localMeds && emrMeds) {
      conflicts.push({ field: "Medications", key: "medications", local: localMeds, emr: emrMeds, isArray: true });
    }

    const localConds = ((local.conditions as string[]) || []).sort().join(", ");
    const emrConds = (emrPatient.conditions || []).sort().join(", ");
    if (localConds !== emrConds && localConds && emrConds) {
      conflicts.push({ field: "Conditions", key: "conditions", local: localConds, emr: emrConds, isArray: true });
    }

    const localAllergies = ((local.allergies as string[]) || []).sort().join(", ");
    const emrAllergies = (emrPatient.allergies || []).sort().join(", ");
    if (localAllergies !== emrAllergies && localAllergies && emrAllergies) {
      conflicts.push({ field: "Allergies", key: "allergies", local: localAllergies, emr: emrAllergies, isArray: true });
    }

    return NextResponse.json({ conflicts, hasConflicts: conflicts.length > 0, local, emrPatient });
  }

  // ── Resolve conflicts and sync ────────────────────────
  if (action === "sync_resolve") {
    const { patientId, resolutions } = body;
    // resolutions: { [key]: "local" | "emr", value?: any }

    const updateData: any = {};
    for (const [key, resolution] of Object.entries(resolutions as Record<string, any>)) {
      if (resolution.choice === "emr") {
        if (resolution.isArray) {
          updateData[key] = resolution.emrValue.split(", ");
        } else {
          updateData[key] = resolution.emrValue;
        }
      }
      // "local" = keep current, no update needed
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.patient.update({ where: { id: patientId }, data: updateData });
    }

    return NextResponse.json({ synced: true, fieldsUpdated: Object.keys(updateData) });
  }

  // ── Push to EMR (outbound FHIR R4) ───────────────────
  if (action === "push_to_emr") {
    const { patientId } = body;
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const fhirPatient = {
      resourceType: "Patient",
      identifier: [{ system: "http://myaidoctor.io/mrn", value: patient.mrn }],
      name: [{ use: "official", family: patient.lastName, given: [patient.firstName] }],
      birthDate: patient.dateOfBirth?.toISOString().slice(0, 10),
      gender: patient.gender?.toLowerCase() === "male" ? "male" : patient.gender?.toLowerCase() === "female" ? "female" : "unknown",
      telecom: [
        { system: "phone", value: patient.phone, use: "mobile" },
        ...(patient.email ? [{ system: "email", value: patient.email }] : []),
      ],
      address: patient.address ? [{ line: [patient.address], city: patient.city, state: patient.state, postalCode: patient.zip }] : [],
    };

    const config = await getEMRConfig();
    if (config.mode === "live" && config.fhirUrl) {
      try {
        const res = await fetch(`${config.fhirUrl}/Patient`, {
          method: "POST",
          headers: { "Content-Type": "application/fhir+json", Authorization: `Bearer ${config.token}` },
          body: JSON.stringify(fhirPatient),
        });
        return NextResponse.json({ pushed: true, status: res.status, fhirPatient });
      } catch (e: any) {
        return NextResponse.json({ pushed: false, error: e.message, fhirPatient });
      }
    }

    // Mock push
    console.log("[EMR Push] FHIR Patient:", JSON.stringify(fhirPatient, null, 2));
    return NextResponse.json({ pushed: true, mode: "mock", fhirPatient, message: "Logged to console (no live EMR configured)" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function getEMRConfig(system?: string) {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["emr_system", "emr_fhir_url", "emr_api_key", "emr_mode", "emr_client_id", "emr_client_secret"] } },
    });
    const s: Record<string, string> = {};
    rows.forEach((r: any) => { s[r.key] = r.value; });
    return {
      system: s.emr_system || system || "bluhealth",
      mode: s.emr_mode || "mock",
      fhirUrl: s.emr_fhir_url || "",
      token: s.emr_api_key || "",
      clientId: s.emr_client_id || "",
      clientSecret: s.emr_client_secret || "",
    };
  } catch {
    return { system: "bluhealth", mode: "mock", fhirUrl: "", token: "", clientId: "", clientSecret: "" };
  }
}

async function searchLiveFHIR(config: any, query: string) {
  try {
    const res = await fetch(`${config.fhirUrl}/Patient?name=${encodeURIComponent(query)}&_count=10`, {
      headers: { Accept: "application/fhir+json", Authorization: `Bearer ${config.token}` },
    });
    const bundle = await res.json();
    const results = (bundle.entry || []).map((e: any) => ({
      emrId: e.resource.id,
      mrn: e.resource.identifier?.[0]?.value || "",
      firstName: e.resource.name?.[0]?.given?.[0] || "",
      lastName: e.resource.name?.[0]?.family || "",
      dob: e.resource.birthDate || "",
      gender: e.resource.gender || "",
      phone: e.resource.telecom?.find((t: any) => t.system === "phone")?.value || "",
      email: e.resource.telecom?.find((t: any) => t.system === "email")?.value || "",
    }));
    return NextResponse.json({ results, source: config.system, mode: "live" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, results: [] }, { status: 500 });
  }
}
