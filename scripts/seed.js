// scripts/seed.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding MyAIDoctor database...\n");

  // ─── Clinics ────────────────────────────────────────────
  const clinics = await Promise.all([
    prisma.clinic.create({
      data: {
        name: "Northville Family Medicine",
        address: "134 E Main St",
        city: "Northville",
        state: "MI",
        zip: "48167",
        phone: "(248) 555-0100",
        fax: "(248) 555-0101",
        ehrSystem: "Epic",
      },
    }),
    prisma.clinic.create({
      data: {
        name: "Ann Arbor Internal Medicine",
        address: "2200 Green Rd, Suite 300",
        city: "Ann Arbor",
        state: "MI",
        zip: "48105",
        phone: "(734) 555-0200",
        fax: "(734) 555-0201",
        ehrSystem: "Athenahealth",
      },
    }),
    prisma.clinic.create({
      data: {
        name: "Detroit Telehealth Center",
        address: "400 Renaissance Center",
        city: "Detroit",
        state: "MI",
        zip: "48243",
        phone: "(313) 555-0300",
        ehrSystem: "eClinicalWorks",
      },
    }),
  ]);

  console.log(`✅ Created ${clinics.length} clinics`);

  // ─── Users (Providers & Staff) ──────────────────────────
  const hash = await bcrypt.hash("MyAIDoc2024!", 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "dr.chen@myaidoctor.io",
        passwordHash: hash,
        firstName: "Sarah",
        lastName: "Chen",
        role: "PROVIDER",
        specialty: "Family Medicine",
        npiNumber: "1234567890",
        phone: "(248) 555-1001",
        clinicId: clinics[0].id,
        isApproved: true,
        approvedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "dr.patel@myaidoctor.io",
        passwordHash: hash,
        firstName: "Raj",
        lastName: "Patel",
        role: "PROVIDER",
        specialty: "Internal Medicine",
        npiNumber: "2345678901",
        phone: "(734) 555-2001",
        clinicId: clinics[1].id,
        isApproved: true,
        approvedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "dr.okonkwo@myaidoctor.io",
        passwordHash: hash,
        firstName: "Amara",
        lastName: "Okonkwo",
        role: "PROVIDER",
        specialty: "Cardiology",
        npiNumber: "3456789012",
        phone: "(313) 555-3001",
        clinicId: clinics[2].id,
        isApproved: true,
        approvedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "dr.martinez@myaidoctor.io",
        passwordHash: hash,
        firstName: "Elena",
        lastName: "Martinez",
        role: "PROVIDER",
        specialty: "Pediatrics",
        npiNumber: "4567890123",
        phone: "(248) 555-1002",
        clinicId: clinics[0].id,
        isApproved: true,
        approvedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "nurse.williams@myaidoctor.io",
        passwordHash: hash,
        firstName: "Janice",
        lastName: "Williams",
        role: "NURSE",
        phone: "(248) 555-1010",
        clinicId: clinics[0].id,
        isApproved: true,
        approvedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "admin@myaidoctor.io",
        passwordHash: hash,
        firstName: "System",
        lastName: "Administrator",
        role: "ADMIN",
        phone: "(248) 555-0001",
        clinicId: clinics[0].id,
        isApproved: true,
        approvedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: "frontdesk@myaidoctor.io",
        passwordHash: hash,
        firstName: "Lisa",
        lastName: "Thompson",
        role: "FRONT_DESK",
        phone: "(248) 555-1020",
        clinicId: clinics[0].id,
        isApproved: true,
        approvedAt: new Date(),
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // ─── Super Admin ──────────────────────────────────────────
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@myaidoctor.io",
      passwordHash: hash,
      firstName: "Platform",
      lastName: "SuperAdmin",
      role: "SUPER_ADMIN",
      phone: "(248) 555-0000",
      clinicId: clinics[0].id,
      isApproved: true,
      approvedAt: new Date(),
    },
  });
  console.log("✅ Created super admin user (superadmin@myaidoctor.io)");

  // Patient user — linked to first patient by email
  const patientUser = await prisma.user.create({
    data: {
      email: "jane.smith@email.com",
      passwordHash: await bcrypt.hash("MyAIDoc2024!", 12),
      firstName: "Jane",
      lastName: "Smith",
      role: "PATIENT",
      phone: "+12485551234",
      isActive: true,
      isApproved: true,
      mfaRequired: false,
      mfaEnabled: false,
      clinicId: clinics[0].id,
    },
  });
  console.log("✅ Created patient user (jane.smith@email.com)");

  // ─── Hospitals ────────────────────────────────────────────
  const hospital = await prisma.hospital.create({
    data: {
      name: "Beaumont Health System",
      address: "3601 W 13 Mile Rd",
      city: "Royal Oak",
      state: "MI",
      zip: "48073",
      phone: "(248) 898-5000",
      website: "https://beaumont.org",
    },
  });

  // Link first clinic to hospital
  await prisma.clinic.update({
    where: { id: clinics[0].id },
    data: { hospitalId: hospital.id },
  });
  console.log("✅ Created 1 hospital and linked clinic");

  // ─── Default System Settings ──────────────────────────────
  const defaultSettings = {
    app_name: "MyAIDoctor.io",
    app_tagline: "Clinical Context Engine",
    app_description: "AI-powered pre-visit preparation and clinic operations automation",
    registration_mode: "open",
    mfa_requirement: "required",
    session_timeout: "30",
    password_min_length: "8",
    max_login_attempts: "5",
    lockout_duration: "15",
    audit_retention_days: "365",
    powered_by_text: "Powered by MyAIDoctor.io",
    powered_by_url: "https://myaidoctor.io",
    theme_primary: "#10b981",
    theme_background: "#0a0a1a",
    voice_ai_mode: "mock",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  console.log(`✅ Created ${Object.keys(defaultSettings).length} system settings`);

  // ─── Patients ───────────────────────────────────────────
  const patientData = [
    {
      mrn: "MRN-001001",
      firstName: "James",
      lastName: "Morrison",
      dateOfBirth: new Date("1965-03-15"),
      gender: "Male",
      email: "jmorrison@email.com",
      phone: "(248) 555-8001",
      address: "221 Baseline Rd",
      city: "Northville",
      state: "MI",
      zip: "48167",
      insuranceProvider: "Blue Cross Blue Shield MI",
      insurancePolicyId: "BCBS-99281034",
      insuranceGroupId: "GRP-4420",
      insuranceVerified: true,
      allergies: ["Penicillin", "Sulfa drugs"],
      medications: ["Lisinopril 10mg daily", "Metformin 500mg BID", "Atorvastatin 20mg daily"],
      conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
      consentGiven: true,
      clinicId: clinics[0].id,
    },
    {
      mrn: "MRN-001002",
      firstName: "Maria",
      lastName: "Santos",
      dateOfBirth: new Date("1978-07-22"),
      gender: "Female",
      email: "msantos@email.com",
      phone: "(248) 555-8002",
      address: "456 Oak St",
      city: "Northville",
      state: "MI",
      zip: "48167",
      insuranceProvider: "Aetna",
      insurancePolicyId: "AET-55123987",
      insuranceGroupId: "GRP-8801",
      insuranceVerified: true,
      allergies: ["Ibuprofen"],
      medications: ["Levothyroxine 75mcg daily", "Sertraline 50mg daily"],
      conditions: ["Hypothyroidism", "Generalized Anxiety Disorder"],
      consentGiven: true,
      clinicId: clinics[0].id,
    },
    {
      mrn: "MRN-001003",
      firstName: "Robert",
      lastName: "Kim",
      dateOfBirth: new Date("1952-11-08"),
      gender: "Male",
      email: "rkim@email.com",
      phone: "(734) 555-8003",
      address: "789 Washtenaw Ave",
      city: "Ann Arbor",
      state: "MI",
      zip: "48104",
      insuranceProvider: "Medicare",
      insurancePolicyId: "1EG4-TE5-MK72",
      insuranceVerified: true,
      allergies: ["Codeine", "Latex"],
      medications: ["Warfarin 5mg daily", "Metoprolol 50mg BID", "Furosemide 40mg daily", "Potassium Chloride 20mEq daily"],
      conditions: ["Atrial Fibrillation", "Congestive Heart Failure", "Chronic Kidney Disease Stage 3"],
      consentGiven: true,
      clinicId: clinics[1].id,
    },
    {
      mrn: "MRN-001004",
      firstName: "Emily",
      lastName: "Johnson",
      dateOfBirth: new Date("1990-01-30"),
      gender: "Female",
      email: "ejohnson@email.com",
      phone: "(248) 555-8004",
      address: "321 Center St",
      city: "Northville",
      state: "MI",
      zip: "48167",
      insuranceProvider: "United Healthcare",
      insurancePolicyId: "UHC-77834521",
      insuranceGroupId: "GRP-2205",
      insuranceVerified: false,
      allergies: [],
      medications: ["Prenatal vitamins"],
      conditions: ["Pregnancy - 28 weeks"],
      consentGiven: true,
      clinicId: clinics[0].id,
    },
    {
      mrn: "MRN-001005",
      firstName: "David",
      lastName: "Okafor",
      dateOfBirth: new Date("1985-09-12"),
      gender: "Male",
      email: "dokafor@email.com",
      phone: "(313) 555-8005",
      address: "1200 Woodward Ave",
      city: "Detroit",
      state: "MI",
      zip: "48226",
      insuranceProvider: "Cigna",
      insurancePolicyId: "CIG-33217890",
      insuranceGroupId: "GRP-1102",
      insuranceVerified: true,
      allergies: ["Aspirin"],
      medications: ["Albuterol inhaler PRN", "Fluticasone 110mcg BID"],
      conditions: ["Asthma - moderate persistent"],
      consentGiven: true,
      clinicId: clinics[2].id,
    },
    {
      mrn: "MRN-001006",
      firstName: "Susan",
      lastName: "Clark",
      dateOfBirth: new Date("1958-04-18"),
      gender: "Female",
      email: "sclark@email.com",
      phone: "(734) 555-8006",
      address: "567 Stadium Blvd",
      city: "Ann Arbor",
      state: "MI",
      zip: "48103",
      insuranceProvider: "Blue Cross Blue Shield MI",
      insurancePolicyId: "BCBS-44509182",
      insuranceGroupId: "GRP-7710",
      insuranceVerified: true,
      allergies: ["ACE Inhibitors"],
      medications: ["Amlodipine 5mg daily", "Omeprazole 20mg daily", "Vitamin D 2000IU daily"],
      conditions: ["Hypertension", "GERD", "Osteoporosis"],
      consentGiven: true,
      clinicId: clinics[1].id,
    },
    {
      mrn: "MRN-001007",
      firstName: "Michael",
      lastName: "Torres",
      dateOfBirth: new Date("1975-12-03"),
      gender: "Male",
      email: "mtorres@email.com",
      phone: "(248) 555-8007",
      address: "890 Eight Mile Rd",
      city: "Northville",
      state: "MI",
      zip: "48167",
      insuranceProvider: "Priority Health",
      insurancePolicyId: "PH-88127345",
      insuranceGroupId: "GRP-3390",
      insuranceVerified: true,
      allergies: [],
      medications: ["Escitalopram 10mg daily", "Gabapentin 300mg TID"],
      conditions: ["Major Depressive Disorder", "Chronic Lower Back Pain", "Insomnia"],
      consentGiven: true,
      clinicId: clinics[0].id,
    },
    {
      mrn: "MRN-001008",
      firstName: "Aisha",
      lastName: "Rahman",
      dateOfBirth: new Date("1988-06-25"),
      gender: "Female",
      email: "arahman@email.com",
      phone: "(313) 555-8008",
      address: "350 Michigan Ave",
      city: "Detroit",
      state: "MI",
      zip: "48226",
      insuranceProvider: "Molina Healthcare",
      insurancePolicyId: "MOL-22198456",
      insuranceVerified: true,
      allergies: ["Erythromycin"],
      medications: ["Insulin Glargine 20u daily", "Insulin Lispro per sliding scale", "Lisinopril 20mg daily"],
      conditions: ["Type 1 Diabetes", "Diabetic Retinopathy"],
      consentGiven: true,
      clinicId: clinics[2].id,
    },
    {
      mrn: "MRN-001009",
      firstName: "Thomas",
      lastName: "Weber",
      dateOfBirth: new Date("1970-08-14"),
      gender: "Male",
      email: "tweber@email.com",
      phone: "(734) 555-8009",
      address: "1500 E Medical Center Dr",
      city: "Ann Arbor",
      state: "MI",
      zip: "48109",
      insuranceProvider: "HAP",
      insurancePolicyId: "HAP-66312780",
      insuranceGroupId: "GRP-5540",
      insuranceVerified: true,
      allergies: ["Morphine", "Shellfish"],
      medications: ["Eliquis 5mg BID", "Diltiazem 120mg daily"],
      conditions: ["Paroxysmal Atrial Fibrillation", "Sleep Apnea"],
      consentGiven: true,
      clinicId: clinics[1].id,
    },
    {
      mrn: "MRN-001010",
      firstName: "Linda",
      lastName: "Nguyen",
      dateOfBirth: new Date("1995-02-20"),
      gender: "Female",
      email: "lnguyen@email.com",
      phone: "(248) 555-8010",
      address: "42 Liberty St",
      city: "Plymouth",
      state: "MI",
      zip: "48170",
      insuranceProvider: "Blue Care Network",
      insurancePolicyId: "BCN-11284567",
      insuranceGroupId: "GRP-9920",
      insuranceVerified: false,
      allergies: [],
      medications: [],
      conditions: [],
      consentGiven: true,
      clinicId: clinics[0].id,
    },
    // Jane Smith — patient portal test user
    {
      mrn: "MRN-001011",
      firstName: "Jane",
      lastName: "Smith",
      dateOfBirth: new Date("1985-03-15"),
      gender: "Female",
      email: "jane.smith@email.com",
      phone: "(248) 555-1234",
      address: "789 Maple Drive",
      city: "Northville",
      state: "MI",
      zip: "48167",
      insuranceProvider: "Blue Cross Blue Shield",
      insurancePolicyId: "BCBS-99887766",
      insuranceGroupId: "GRP-4455",
      insuranceVerified: true,
      allergies: ["Penicillin", "Shellfish"],
      medications: ["Metformin 500mg BID", "Lisinopril 10mg daily", "Albuterol HFA PRN"],
      conditions: ["Type 2 Diabetes Mellitus", "Essential Hypertension", "Mild Intermittent Asthma"],
      consentGiven: true,
      clinicId: clinics[0].id,
    },
  ];

  const patients = await Promise.all(
    patientData.map((p) => prisma.patient.create({ data: p }))
  );

  console.log(`✅ Created ${patients.length} patients`);

  // ─── Appointments & Pre-Visit Briefs ────────────────────
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
  }
  function setTime(date, h, m) {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }

  const appointmentData = [
    // Today's appointments
    {
      scheduledAt: setTime(today, 8, 30),
      duration: 30,
      visitType: "FOLLOW_UP",
      status: "PRE_VISIT_COMPLETE",
      reasonForVisit: "Diabetes and hypertension follow-up, A1C review",
      chiefComplaint: "Blood sugar has been running high in the mornings",
      patientId: patients[0].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(today, 9, 0),
      duration: 20,
      visitType: "FOLLOW_UP",
      status: "PRE_VISIT_COMPLETE",
      reasonForVisit: "Thyroid medication adjustment, anxiety check-in",
      chiefComplaint: "Feeling more fatigued than usual, increased anxiety",
      patientId: patients[1].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(today, 9, 30),
      duration: 30,
      visitType: "FOLLOW_UP",
      status: "CHECKED_IN",
      reasonForVisit: "CHF management, INR check, kidney function review",
      chiefComplaint: "Increased shortness of breath with exertion, ankle swelling",
      patientId: patients[2].id,
      providerId: users[1].id,
      clinicId: clinics[1].id,
    },
    {
      scheduledAt: setTime(today, 10, 0),
      duration: 20,
      visitType: "TELEHEALTH",
      status: "PRE_VISIT_COMPLETE",
      reasonForVisit: "Asthma follow-up, medication refill",
      chiefComplaint: "Using rescue inhaler more frequently, 3-4 times per week",
      patientId: patients[4].id,
      providerId: users[2].id,
      clinicId: clinics[2].id,
    },
    {
      scheduledAt: setTime(today, 10, 30),
      duration: 30,
      visitType: "ANNUAL_WELLNESS",
      status: "CONFIRMED",
      reasonForVisit: "Annual physical, new patient intake",
      patientId: patients[9].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(today, 11, 0),
      duration: 15,
      visitType: "FOLLOW_UP",
      status: "PRE_VISIT_STARTED",
      reasonForVisit: "Depression management, chronic pain review",
      chiefComplaint: "Mood has been worse, back pain not well controlled",
      patientId: patients[6].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(today, 14, 0),
      duration: 20,
      visitType: "FOLLOW_UP",
      status: "SCHEDULED",
      reasonForVisit: "Prenatal visit - 28 week check",
      patientId: patients[3].id,
      providerId: users[3].id,
      clinicId: clinics[0].id,
    },
    // Tomorrow
    {
      scheduledAt: setTime(addDays(today, 1), 8, 0),
      duration: 30,
      visitType: "FOLLOW_UP",
      status: "PRE_VISIT_COMPLETE",
      reasonForVisit: "GERD flare-up, blood pressure review",
      chiefComplaint: "Heartburn worsening despite medication, occasional chest tightness",
      patientId: patients[5].id,
      providerId: users[1].id,
      clinicId: clinics[1].id,
    },
    {
      scheduledAt: setTime(addDays(today, 1), 9, 0),
      duration: 20,
      visitType: "TELEHEALTH",
      status: "SCHEDULED",
      reasonForVisit: "Diabetes management, retinopathy follow-up",
      patientId: patients[7].id,
      providerId: users[2].id,
      clinicId: clinics[2].id,
    },
    {
      scheduledAt: setTime(addDays(today, 1), 10, 0),
      duration: 30,
      visitType: "FOLLOW_UP",
      status: "SCHEDULED",
      reasonForVisit: "AFib management, CPAP compliance review",
      patientId: patients[8].id,
      providerId: users[1].id,
      clinicId: clinics[1].id,
    },
    // Past appointments (completed)
    {
      scheduledAt: setTime(addDays(today, -7), 9, 0),
      duration: 20,
      visitType: "FOLLOW_UP",
      status: "COMPLETED",
      reasonForVisit: "A1C review",
      chiefComplaint: "Blood sugar management",
      completedAt: setTime(addDays(today, -7), 9, 25),
      patientId: patients[0].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(addDays(today, -14), 10, 0),
      duration: 30,
      visitType: "NEW_PATIENT",
      status: "COMPLETED",
      reasonForVisit: "Initial consultation",
      chiefComplaint: "Establish care, multiple concerns",
      completedAt: setTime(addDays(today, -14), 10, 35),
      patientId: patients[6].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(addDays(today, -3), 14, 0),
      duration: 15,
      visitType: "TELEHEALTH",
      status: "COMPLETED",
      reasonForVisit: "Post-ER follow-up",
      chiefComplaint: "Asthma exacerbation, ER visit 5 days ago",
      completedAt: setTime(addDays(today, -3), 14, 18),
      patientId: patients[4].id,
      providerId: users[2].id,
      clinicId: clinics[2].id,
    },
    // Cancelled / No-show
    {
      scheduledAt: setTime(addDays(today, -2), 11, 0),
      duration: 20,
      visitType: "FOLLOW_UP",
      status: "NO_SHOW",
      reasonForVisit: "Blood pressure follow-up",
      patientId: patients[5].id,
      providerId: users[1].id,
      clinicId: clinics[1].id,
    },
    // ─── Jane Smith — future appointments for patient portal ────
    {
      scheduledAt: setTime(addDays(today, 2), 10, 0),
      duration: 30,
      visitType: "FOLLOW_UP",
      status: "CONFIRMED",
      reasonForVisit: "Diabetes and hypertension follow-up, discuss headaches",
      patientId: patients[10].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(addDays(today, 14), 14, 30),
      duration: 45,
      visitType: "ANNUAL_WELLNESS",
      status: "CONFIRMED",
      reasonForVisit: "Annual wellness exam, lab review",
      patientId: patients[10].id,
      providerId: users[0].id,
      clinicId: clinics[0].id,
    },
    {
      scheduledAt: setTime(addDays(today, 30), 9, 0),
      duration: 30,
      visitType: "FOLLOW_UP",
      status: "CONFIRMED",
      reasonForVisit: "Medication adjustment review",
      patientId: patients[10].id,
      providerId: users[1].id,
      clinicId: clinics[0].id,
    },
  ];

  const appointments = [];
  for (const appt of appointmentData) {
    appointments.push(await prisma.appointment.create({ data: appt }));
  }

  console.log(`✅ Created ${appointments.length} appointments`);

  // ─── Pre-Visit Briefs ──────────────────────────────────
  const briefData = [
    {
      status: "READY",
      chiefComplaint: "Blood sugar has been running high in the mornings",
      hpiNarrative:
        "Mr. Morrison is a 60-year-old male with Type 2 Diabetes (dx 2018), Hypertension, and Hyperlipidemia presenting for routine follow-up. He reports fasting blood glucose readings of 160-190 mg/dL over the past 3 weeks despite adherence to Metformin 500mg BID. He notes increased thirst and urinary frequency. He denies vision changes, numbness/tingling, or chest pain. Diet has been 'okay' but admits to increased carbohydrate intake due to stress at work. Last A1C was 7.8% three months ago. Blood pressure at home averaging 138/88. Reports compliance with Lisinopril and Atorvastatin.",
      reviewOfSystems: {
        constitutional: { weight_change: "gained 4 lbs in past month", fatigue: "mild" },
        endocrine: { polyuria: true, polydipsia: true, polyphagia: false },
        cardiovascular: { chest_pain: false, palpitations: false, edema: false },
        neurological: { numbness_tingling: false, vision_changes: false },
      },
      medicationChanges: {
        current: ["Lisinopril 10mg daily - compliant", "Metformin 500mg BID - compliant", "Atorvastatin 20mg daily - compliant"],
        reported_issues: "None reported but glucose not well controlled on current Metformin dose",
      },
      differentials: [
        { diagnosis: "Uncontrolled Type 2 DM — medication adjustment needed", probability: "high", reasoning: "A1C trending up, fasting glucose consistently >160" },
        { diagnosis: "Medication non-adherence or absorption issue", probability: "low", reasoning: "Patient reports consistent adherence" },
        { diagnosis: "Secondary cause of hyperglycemia", probability: "low", reasoning: "Consider cortisol, thyroid if A1C significantly elevated" },
      ],
      redFlags: [
        { flag: "Fasting glucose consistently >160 with polyuria/polydipsia", severity: "moderate", action: "Check A1C today, consider medication adjustment" },
        { flag: "BP averaging 138/88 — above target for diabetic patient", severity: "moderate", action: "Review antihypertensive regimen" },
      ],
      recommendations: [
        "Order stat A1C and comprehensive metabolic panel",
        "Consider increasing Metformin to 1000mg BID or adding second agent (SGLT2i or GLP-1 RA)",
        "Review BP medication — consider increasing Lisinopril to 20mg or adding agent",
        "Reinforce dietary counseling, consider diabetes educator referral",
        "Schedule follow-up in 4-6 weeks for medication titration",
      ],
      soapNote: {
        subjective: "60yo M with T2DM, HTN, HLD presents for f/u. Reports fasting BG 160-190 x3 weeks. Increased thirst and urination. Gained 4 lbs. Admits to increased carbs due to work stress. Denies vision changes, neuropathy sx, chest pain. Compliant with all medications.",
        objective: "Awaiting today's vitals. Last A1C 7.8% (3 months ago). Home BP avg 138/88. Current meds: Metformin 500mg BID, Lisinopril 10mg daily, Atorvastatin 20mg daily.",
        assessment: "1. Type 2 DM — likely suboptimally controlled, anticipate elevated A1C\n2. HTN — above goal for diabetic patient (<130/80)\n3. HLD — stable on Atorvastatin",
        plan: "1. Check A1C, CMP, lipid panel today\n2. Discuss medication intensification based on A1C result\n3. Dietary counseling reinforcement\n4. BP med adjustment consideration\n5. F/u 4-6 weeks",
      },
      clinicalSummary: "High-priority follow-up. Patient's diabetes appears to be trending worse with fasting glucose consistently elevated and new polyuria/polydipsia symptoms despite medication compliance. Blood pressure also above target for a diabetic patient. Will likely need medication intensification today. All data aggregated from EHR + patient voice call completed successfully.",
      riskScore: 7.2,
      protocolsApplied: ["Schmitt-Thompson Diabetes Follow-up", "ADA Standards of Care 2024", "JNC-8 Hypertension Guidelines"],
      ehrSyncStatus: "SYNCED",
      ehrSyncedAt: setTime(today, 7, 45),
      generatedAt: setTime(addDays(today, -1), 16, 30),
      appointmentId: appointments[0].id,
      patientId: patients[0].id,
      providerId: users[0].id,
    },
    {
      status: "READY",
      chiefComplaint: "Feeling more fatigued than usual, increased anxiety",
      hpiNarrative:
        "Ms. Santos is a 47-year-old female with Hypothyroidism and Generalized Anxiety Disorder presenting for medication review. She reports worsening fatigue over the past 6 weeks — sleeping 9-10 hours but still exhausted. Anxiety has been 'worse than usual' with racing thoughts at night. She notes cold intolerance and dry skin. No weight changes, hair loss, or palpitations. TSH was 4.2 mIU/L six months ago (slightly above optimal). Sertraline was started 8 months ago with initial improvement but now feels it 'isn't working as well.' No suicidal ideation.",
      reviewOfSystems: {
        constitutional: { fatigue: "significant - 6 weeks", weight_change: "stable" },
        endocrine: { cold_intolerance: true, dry_skin: true, hair_loss: false },
        psychiatric: { anxiety: "worsening", sleep: "hypersomnia", mood: "low-normal", suicidal_ideation: false },
      },
      differentials: [
        { diagnosis: "Suboptimal hypothyroid treatment — TSH above optimal range", probability: "high" },
        { diagnosis: "SSRI tolerance / need for dose adjustment", probability: "moderate" },
        { diagnosis: "Comorbid depression developing", probability: "moderate" },
      ],
      redFlags: [
        { flag: "Worsening fatigue + anxiety + cold intolerance may indicate subtherapeutic thyroid replacement", severity: "moderate" },
      ],
      recommendations: [
        "Check TSH, Free T4, and Free T3 today",
        "Consider increasing Levothyroxine if TSH >2.5",
        "Evaluate Sertraline efficacy — consider dose increase to 75-100mg",
        "Screen for depression with PHQ-9",
      ],
      soapNote: {
        subjective: "47yo F with hypothyroidism and GAD. Worsening fatigue x6 weeks, increased anxiety, cold intolerance, dry skin. Sertraline less effective. Denies SI/HI.",
        objective: "Awaiting vitals and labs. Last TSH 4.2 (6 months ago). Current: Levothyroxine 75mcg, Sertraline 50mg.",
        assessment: "1. Hypothyroidism — possibly subtherapeutic\n2. GAD — suboptimally controlled\n3. R/O developing MDD",
        plan: "1. TSH, Free T4, Free T3\n2. PHQ-9, GAD-7\n3. Discuss medication adjustments\n4. F/u 4 weeks",
      },
      clinicalSummary: "Medication review indicated. Fatigue pattern and cold intolerance suggest thyroid dose may need uptitration. Anxiety worsening — assess for SSRI dose adjustment versus augmentation.",
      riskScore: 5.1,
      protocolsApplied: ["ATA Hypothyroidism Guidelines", "Schmitt-Thompson Fatigue Protocol"],
      ehrSyncStatus: "SYNCED",
      ehrSyncedAt: setTime(today, 7, 50),
      generatedAt: setTime(addDays(today, -1), 17, 15),
      appointmentId: appointments[1].id,
      patientId: patients[1].id,
      providerId: users[0].id,
    },
    {
      status: "READY",
      chiefComplaint: "Increased shortness of breath with exertion, ankle swelling",
      hpiNarrative:
        "Mr. Kim is a 73-year-old male with AFib on Warfarin, CHF (EF 35%), and CKD Stage 3 presenting with worsening dyspnea and bilateral ankle edema over 2 weeks. He reports he can now only walk half a block before needing to rest (previously could do 2 blocks). He has been sleeping with 3 pillows (up from 2). Weight up 6 lbs in 10 days. Denies chest pain but notes occasional palpitations. Reports strict adherence to fluid restriction (2L/day) and low-sodium diet. Last INR was 2.4 three weeks ago.",
      differentials: [
        { diagnosis: "CHF exacerbation — fluid overload", probability: "high" },
        { diagnosis: "AFib with rapid ventricular response contributing to decompensation", probability: "moderate" },
        { diagnosis: "Worsening CKD contributing to fluid retention", probability: "moderate" },
      ],
      redFlags: [
        { flag: "6 lb weight gain in 10 days — likely significant fluid retention", severity: "high", action: "Urgent assessment, may need diuretic adjustment" },
        { flag: "Progressive orthopnea — 3-pillow requirement", severity: "high", action: "Assess for pulmonary congestion" },
        { flag: "Reduced exercise tolerance — possible NYHA class progression", severity: "high" },
      ],
      recommendations: [
        "URGENT: Assess for acute decompensated heart failure",
        "Check BNP/NT-proBNP, BMP (renal function, electrolytes), CBC, INR",
        "Chest X-ray to assess for pulmonary congestion",
        "Consider increasing Furosemide dose or adding metolazone",
        "Daily weights with strict parameters for when to call clinic",
        "Possible cardiology referral if not improving",
      ],
      soapNote: {
        subjective: "73yo M with CHF (EF 35%), AFib on Warfarin, CKD3. Worsening DOE x2 weeks, bilateral ankle edema, orthopnea (3 pillows), +6 lbs in 10 days. Compliant with diet/fluid restriction.",
        objective: "Awaiting exam. Last INR 2.4 (3 weeks ago). Current: Warfarin 5mg, Metoprolol 50mg BID, Furosemide 40mg, KCl 20mEq.",
        assessment: "1. CHF — likely acute exacerbation with fluid overload\n2. AFib — assess rate control\n3. CKD3 — monitor with diuretic changes",
        plan: "1. STAT: BNP, BMP, CBC, INR, CXR\n2. Exam: JVD, lung sounds, peripheral edema assessment\n3. Likely increase Furosemide\n4. Daily weight log instructions\n5. Consider cardiology referral",
      },
      clinicalSummary: "HIGH PRIORITY — Signs of CHF decompensation with significant fluid overload. Weight gain of 6 lbs, progressive dyspnea, and worsening orthopnea require urgent evaluation. Complex medication management with Warfarin and CKD considerations.",
      riskScore: 9.1,
      protocolsApplied: ["ACC/AHA Heart Failure Guidelines", "Schmitt-Thompson Shortness of Breath", "Schmitt-Thompson Edema Protocol"],
      ehrSyncStatus: "SYNCED",
      ehrSyncedAt: setTime(today, 7, 30),
      generatedAt: setTime(addDays(today, -1), 15, 0),
      appointmentId: appointments[2].id,
      patientId: patients[2].id,
      providerId: users[1].id,
    },
    {
      status: "READY",
      chiefComplaint: "Using rescue inhaler more frequently, 3-4 times per week",
      hpiNarrative:
        "Mr. Okafor is a 40-year-old male with moderate persistent asthma presenting via telehealth for follow-up. Reports increased albuterol use from 1x/week to 3-4x/week over the past month. Triggers include exercise and cold air. No nighttime awakenings. No ER visits since last exacerbation 3 weeks ago. Adherent to Fluticasone 110mcg BID. Denies fever, productive cough, or weight loss. Works in an office environment, no new exposures.",
      differentials: [
        { diagnosis: "Asthma — stepping up from moderate persistent, not well controlled", probability: "high" },
        { diagnosis: "Environmental trigger exposure", probability: "moderate" },
      ],
      redFlags: [],
      recommendations: [
        "Consider step-up therapy: increase Fluticasone to 220mcg or add LABA",
        "Review inhaler technique via video",
        "Assess triggers and environmental controls",
        "Provide updated asthma action plan",
        "Follow-up in 4 weeks to reassess control",
      ],
      soapNote: {
        subjective: "40yo M with moderate persistent asthma. Rescue inhaler use increased to 3-4x/week. No nighttime sx. Recent ER visit 3 weeks ago. Compliant with Fluticasone.",
        objective: "Telehealth visit — visual assessment only. Current: Albuterol PRN, Fluticasone 110mcg BID.",
        assessment: "Asthma — not well controlled by NAEPP criteria (rescue use >2x/week)",
        plan: "1. Step up: Fluticasone/Salmeterol 115/21 BID\n2. Inhaler technique review\n3. Updated action plan\n4. F/u 4 weeks",
      },
      clinicalSummary: "Asthma control has deteriorated based on rescue inhaler frequency. Step-up therapy recommended per guidelines. Recent ER visit adds urgency to regimen optimization.",
      riskScore: 5.8,
      protocolsApplied: ["NAEPP Asthma Stepwise Approach", "Schmitt-Thompson Wheezing Protocol"],
      ehrSyncStatus: "SYNCED",
      ehrSyncedAt: setTime(today, 8, 0),
      generatedAt: setTime(addDays(today, -1), 18, 0),
      appointmentId: appointments[3].id,
      patientId: patients[4].id,
      providerId: users[2].id,
    },
    {
      status: "READY",
      chiefComplaint: "Heartburn worsening despite medication, occasional chest tightness",
      hpiNarrative:
        "Ms. Clark is a 68-year-old female with HTN, GERD, and Osteoporosis. Heartburn has worsened over 3 weeks despite Omeprazole 20mg daily. Describes burning epigastric pain 30 minutes after meals, worse when lying down. Also reports occasional chest tightness — non-exertional, no radiation, relieved with antacids. No dysphagia, hematemesis, or melena. Diet includes spicy foods and coffee. ACE inhibitor allergy (cough).",
      differentials: [
        { diagnosis: "GERD flare — possibly PPI dose inadequate or break-through", probability: "high" },
        { diagnosis: "Atypical angina — must rule out given age, HTN, and chest tightness", probability: "moderate" },
        { diagnosis: "PPI-refractory GERD — may need evaluation for complications", probability: "low-moderate" },
      ],
      redFlags: [
        { flag: "Chest tightness in 68yo F with HTN — must differentiate cardiac vs GI", severity: "high", action: "ECG recommended, consider stress test" },
      ],
      recommendations: [
        "ECG today to rule out ischemic changes",
        "Increase Omeprazole to 40mg or switch to twice-daily dosing",
        "Consider H. pylori testing if not done recently",
        "Dietary modifications counseling (reduce coffee, spicy foods, elevate HOB)",
        "If chest tightness persists, consider cardiology referral for stress test",
      ],
      riskScore: 6.8,
      protocolsApplied: ["ACG GERD Guidelines", "Schmitt-Thompson Chest Pain Protocol", "ACC Chest Pain Evaluation"],
      ehrSyncStatus: "SYNCED",
      generatedAt: setTime(today, 6, 30),
      appointmentId: appointments[7].id,
      patientId: patients[5].id,
      providerId: users[1].id,
    },
  ];

  const briefs = [];
  for (const b of briefData) {
    briefs.push(await prisma.preVisitBrief.create({ data: b }));
  }

  console.log(`✅ Created ${briefs.length} pre-visit briefs`);

  // ─── Voice Calls ───────────────────────────────────────
  const voiceCallData = [
    {
      direction: "OUTBOUND",
      callType: "PRE_VISIT",
      status: "COMPLETED",
      phoneNumber: patients[0].phone,
      startedAt: setTime(addDays(today, -1), 14, 30),
      endedAt: setTime(addDays(today, -1), 14, 42),
      durationSeconds: 720,
      attempts: 1,
      sentiment: "cooperative",
      completionRate: 0.95,
      transcript: `AI: Good afternoon, may I speak with James Morrison?\nPatient: Speaking.\nAI: Hi James, this is the MyAIDoctor care assistant calling from Northville Family Medicine regarding your appointment tomorrow with Dr. Chen. I'd like to ask you a few questions to help prepare for your visit. Is now a good time?\nPatient: Sure, go ahead.\nAI: Thank you. What is the main reason for your visit tomorrow?\nPatient: I need to check on my diabetes. My blood sugar has been running high in the mornings.\nAI: I understand. Can you tell me what your fasting blood sugar readings have been?\nPatient: They've been around 160 to 190 for the past three weeks or so.\nAI: That's helpful to know. Have you noticed any increased thirst or more frequent urination?\nPatient: Yeah, actually both. I've been drinking a lot more water and going to the bathroom more often.\nAI: Have you had any changes in your vision, numbness or tingling in your hands or feet, or any chest pain?\nPatient: No, nothing like that.\nAI: Good. Are you still taking all your medications as prescribed — the Metformin, Lisinopril, and Atorvastatin?\nPatient: Yes, I take them every day like clockwork.\nAI: Have you noticed any changes in your diet or activity level recently?\nPatient: Well, I've been stressed at work and probably eating more carbs than I should. Haven't been walking as much either.\nAI: I appreciate your honesty. Have you had any weight changes?\nPatient: I think I've gained a few pounds. Maybe 4 or 5.\nAI: Thank you James. Have you been checking your blood pressure at home?\nPatient: Yes, it's been running around 138 over 88.\nAI: That's very helpful information. Do you have any allergies we should be aware of or any changes to report?\nPatient: Same as always — penicillin and sulfa drugs. Nothing new.\nAI: Perfect. Is there anything else you'd like Dr. Chen to know about or address during your visit?\nPatient: No, I think that covers it. Just want to get these sugars under control.\nAI: Absolutely. I've noted everything and Dr. Chen will have this information before your appointment. Thank you for your time, James. We'll see you tomorrow at 8:30 AM.\nPatient: Thank you. Bye.`,
      dataCollected: {
        chiefComplaint: "Blood sugar running high in mornings",
        fastingGlucose: "160-190 mg/dL x3 weeks",
        symptoms: ["polyuria", "polydipsia"],
        denies: ["vision changes", "neuropathy", "chest pain"],
        medicationCompliance: "fully compliant",
        dietChanges: "increased carbs due to work stress",
        weightChange: "+4-5 lbs",
        homeBP: "138/88",
        allergies: "no changes — penicillin, sulfa",
      },
      patientId: patients[0].id,
      appointmentId: appointments[0].id,
      providerId: users[0].id,
    },
    {
      direction: "OUTBOUND",
      callType: "PRE_VISIT",
      status: "COMPLETED",
      phoneNumber: patients[1].phone,
      startedAt: setTime(addDays(today, -1), 15, 0),
      endedAt: setTime(addDays(today, -1), 15, 9),
      durationSeconds: 540,
      attempts: 1,
      sentiment: "cooperative",
      completionRate: 0.92,
      transcript: "AI: Good afternoon, may I speak with Maria Santos?\nPatient: Yes, this is Maria.\nAI: Hi Maria, this is the MyAIDoctor care assistant calling from Northville Family Medicine about your appointment tomorrow with Dr. Chen...\n[Full conversation covering fatigue, anxiety, thyroid symptoms, and medication review]",
      dataCollected: {
        chiefComplaint: "Increased fatigue and worsening anxiety",
        symptoms: ["fatigue x6 weeks", "cold intolerance", "dry skin", "racing thoughts at night", "hypersomnia"],
        denies: ["weight change", "hair loss", "palpitations", "suicidal ideation"],
        medicationCompliance: "compliant with both medications",
        medicationConcerns: "Sertraline doesn't seem as effective as before",
      },
      patientId: patients[1].id,
      appointmentId: appointments[1].id,
      providerId: users[0].id,
    },
    {
      direction: "OUTBOUND",
      callType: "PRE_VISIT",
      status: "COMPLETED",
      phoneNumber: patients[2].phone,
      startedAt: setTime(addDays(today, -1), 13, 0),
      endedAt: setTime(addDays(today, -1), 13, 15),
      durationSeconds: 900,
      attempts: 2,
      sentiment: "concerned",
      completionRate: 0.98,
      transcript: "AI: Good afternoon, may I speak with Robert Kim?\n[Detailed conversation about worsening SOB, ankle swelling, weight gain, medication compliance, and daily activities]",
      dataCollected: {
        chiefComplaint: "Increased shortness of breath and ankle swelling",
        symptoms: ["DOE - reduced from 2 blocks to half block", "bilateral ankle edema", "orthopnea - 3 pillows", "occasional palpitations"],
        weightGain: "+6 lbs in 10 days",
        denies: ["chest pain", "syncope"],
        medicationCompliance: "fully compliant",
        dietCompliance: "strict 2L fluid restriction, low sodium",
        lastINR: "2.4 three weeks ago",
      },
      patientId: patients[2].id,
      appointmentId: appointments[2].id,
      providerId: users[1].id,
    },
    {
      direction: "OUTBOUND",
      callType: "PRE_VISIT",
      status: "COMPLETED",
      phoneNumber: patients[4].phone,
      startedAt: setTime(addDays(today, -1), 16, 0),
      endedAt: setTime(addDays(today, -1), 16, 8),
      durationSeconds: 480,
      attempts: 1,
      sentiment: "cooperative",
      completionRate: 0.90,
      transcript: "AI: Hello, may I speak with David Okafor?\n[Conversation about increased rescue inhaler use, triggers, and recent ER visit]",
      dataCollected: {
        chiefComplaint: "Increased rescue inhaler use 3-4x/week",
        triggers: ["exercise", "cold air"],
        denies: ["nighttime awakenings", "fever", "productive cough"],
        recentERVisit: "3 weeks ago for exacerbation",
        medicationCompliance: "compliant with Fluticasone",
      },
      patientId: patients[4].id,
      appointmentId: appointments[3].id,
      providerId: users[2].id,
    },
    {
      direction: "OUTBOUND",
      callType: "PRE_VISIT",
      status: "VOICEMAIL",
      phoneNumber: patients[6].phone,
      startedAt: setTime(addDays(today, -1), 14, 45),
      durationSeconds: 45,
      attempts: 2,
      voicemailLeft: true,
      callbackNumber: "(248) 555-0100",
      patientId: patients[6].id,
      appointmentId: appointments[5].id,
      providerId: users[0].id,
    },
    {
      direction: "INBOUND",
      callType: "SCHEDULING",
      status: "COMPLETED",
      phoneNumber: patients[3].phone,
      startedAt: setTime(addDays(today, -5), 10, 15),
      endedAt: setTime(addDays(today, -5), 10, 20),
      durationSeconds: 300,
      attempts: 1,
      sentiment: "positive",
      completionRate: 1.0,
      transcript: "Patient called to schedule prenatal visit. Appointment booked for next week.",
      dataCollected: { action: "scheduled_appointment", appointmentType: "prenatal_visit" },
      patientId: patients[3].id,
      providerId: users[3].id,
    },
    {
      direction: "INBOUND",
      callType: "INSURANCE_VERIFY",
      status: "COMPLETED",
      phoneNumber: patients[9].phone,
      startedAt: setTime(addDays(today, -3), 11, 0),
      endedAt: setTime(addDays(today, -3), 11, 8),
      durationSeconds: 480,
      attempts: 1,
      sentiment: "cooperative",
      completionRate: 1.0,
      transcript: "Patient called to verify insurance information before annual wellness visit.",
      dataCollected: { action: "insurance_verification", result: "pending_verification", carrier: "Blue Care Network" },
      patientId: patients[9].id,
    },
    {
      direction: "OUTBOUND",
      callType: "PRE_VISIT",
      status: "COMPLETED",
      phoneNumber: patients[5].phone,
      startedAt: setTime(today, 6, 30),
      endedAt: setTime(today, 6, 42),
      durationSeconds: 720,
      attempts: 1,
      sentiment: "cooperative",
      completionRate: 0.94,
      transcript: "AI: Good morning, may I speak with Susan Clark?\n[Conversation about worsening heartburn, chest tightness, medication review]",
      dataCollected: {
        chiefComplaint: "Heartburn worsening, occasional chest tightness",
        symptoms: ["epigastric burning 30min after meals", "worse lying down", "non-exertional chest tightness"],
        denies: ["dysphagia", "hematemesis", "melena"],
        dietFactors: ["spicy foods", "coffee"],
        medicationCompliance: "compliant with all medications",
      },
      patientId: patients[5].id,
      appointmentId: appointments[7].id,
      providerId: users[1].id,
    },
  ];

  const calls = [];
  for (const c of voiceCallData) {
    calls.push(await prisma.voiceCall.create({ data: c }));
  }

  console.log(`✅ Created ${calls.length} voice calls`);

  // ─── Clinical Protocols (comprehensive library) ────────
  const protocolDefs = [
    { name: "Schmitt-Thompson Diabetes Follow-up", category: "Endocrine", description: "Diabetes management follow-up: glucose monitoring, A1C review, complication screening, foot exam, eye exam referral, medication reconciliation", criteria: { conditions: ["Type 2 Diabetes", "Type 1 Diabetes"], visitTypes: ["FOLLOW_UP"], screenings: ["PHQ2"] }, actions: { required_labs: ["A1C", "CMP", "Lipid Panel", "Microalbumin"], screening: ["foot exam", "eye exam referral", "nephropathy screen"], intake_questions: ["glucose_readings", "hypo_episodes", "diet_adherence", "exercise", "foot_symptoms", "vision_changes"] } },
    { name: "Schmitt-Thompson Hypertension Protocol", category: "Cardiovascular", description: "BP monitoring, medication compliance, DASH diet adherence, lifestyle modification assessment per ACC/AHA guidelines", criteria: { conditions: ["Hypertension", "HTN"], visitTypes: ["FOLLOW_UP"] }, actions: { vitals: ["home BP log 7-14 days"], screening: ["sodium intake", "exercise frequency", "stress level", "weight"], red_flags: ["BP >180/120", "severe headache with HTN", "vision changes"] } },
    { name: "Schmitt-Thompson Chest Pain Protocol", category: "Cardiac", description: "Risk stratification for chest pain: location, radiation, exertional, associated symptoms, cardiac risk factors", criteria: { symptoms: ["chest pain", "chest tightness"] }, actions: { immediate: ["ECG", "vital signs"], risk_factors: ["age >50", "HTN", "DM", "smoking", "family history"], red_flags: ["chest pain + dyspnea + diaphoresis"] } },
    { name: "Heart Failure Pre-Visit Protocol", category: "Cardiac", description: "CHF monitoring: daily weights, orthopnea, PND, edema, medication compliance, sodium/fluid restriction per AHA guidelines", criteria: { conditions: ["Heart Failure", "CHF", "Cardiomyopathy"] }, actions: { daily_monitoring: ["weight", "dyspnea", "edema"], red_flags: ["weight gain >2 lbs/day or >5 lbs/week", "worsening dyspnea at rest"] } },
    { name: "NAEPP Asthma/COPD Stepwise Protocol", category: "Respiratory", description: "Asthma Control Test (ACT), rescue inhaler frequency, nighttime symptoms, trigger exposure, peak flow, step-up/step-down criteria", criteria: { conditions: ["Asthma", "COPD", "Reactive Airway"] }, actions: { screening: ["ACT score", "rescue inhaler use", "ER visits"], step_up: "rescue use >2x/week", step_down: "well-controlled x3 months" } },
    { name: "Schmitt-Thompson Shortness of Breath", category: "Respiratory/Cardiac", description: "Dyspnea evaluation: onset, exertional, orthopnea, cardiac vs pulmonary differentiation", criteria: { symptoms: ["dyspnea", "shortness of breath", "DOE"] }, actions: { immediate: ["vital signs", "pulse oximetry", "ECG"], labs: ["BNP", "CBC", "BMP"], imaging: ["chest X-ray"] } },
    { name: "Schmitt-Thompson Fatigue Protocol", category: "General", description: "Systematic fatigue evaluation: thyroid, anemia, depression, sleep disorders, medication side effects", criteria: { symptoms: ["fatigue", "tiredness"], duration: ">2 weeks" }, actions: { labs: ["TSH", "CBC", "CMP", "Iron", "Vitamin D", "B12"], screening: ["PHQ-9", "sleep history", "medication review"] } },
    { name: "PHQ-9 Depression Screening", category: "Mental Health", description: "Patient Health Questionnaire-9: validated 9-item depression severity scale. Score 0-27. Thresholds: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe", criteria: { universal: true, trigger: "PHQ-2 score >=3" }, actions: { escalation: "Item 9 positive → immediate C-SSRS and provider notification", scoring: { minimal: "0-4", mild: "5-9", moderate: "10-14", moderately_severe: "15-19", severe: "20-27" } } },
    { name: "GAD-7 Anxiety Screening", category: "Mental Health", description: "Generalized Anxiety Disorder-7: validated anxiety severity scale. Score 0-21. Universal screening per USPSTF 2025 recommendation", criteria: { universal: true, trigger: "GAD-2 score >=3" }, actions: { scoring: { minimal: "0-4", mild: "5-9", moderate: "10-14", severe: "15-21" } } },
    { name: "AUDIT-C Alcohol Screening", category: "Substance Use", description: "3-item alcohol use screening (WHO). Positive threshold: >=4 men, >=3 women. If positive, administer full AUDIT (10 items)", criteria: { universal: true, age: ">=18" }, actions: { positive: "Administer full AUDIT, brief intervention, referral if needed" } },
    { name: "Medication Reconciliation Protocol", category: "Medications", description: "Verify current medications, dose changes, new medications, OTC/supplements, compliance, side effects, refill needs, high-risk med flags (opioids, anticoagulants, insulin)", criteria: { universal: true }, actions: { high_risk_flags: ["Opioid+benzodiazepine concurrent use", "Polypharmacy (5+ meds)", "Anticoagulant bleeding signs", "Insulin hypoglycemia"] } },
    { name: "USPSTF Preventive Screening Protocol", category: "Preventive", description: "Age/gender-based screening gap closure: depression, anxiety, alcohol, tobacco, colorectal cancer (45+), mammography (40+), cervical cancer (21-65), lung cancer CT (50-80 smokers), diabetes (35-70 overweight), osteoporosis (65+ women)", criteria: { visitTypes: ["ANNUAL_WELLNESS", "NEW_PATIENT"] }, actions: { screens_by_age: { "18+": ["PHQ-2", "GAD-2", "AUDIT-C", "tobacco", "BMI"], "45+": ["colonoscopy status"], "40+_female": ["mammogram status"], "65+": ["fall risk (STEADI)", "bone density status"] } } },
    { name: "CDC STEADI Fall Risk Screening", category: "Geriatric", description: "3-question fall risk screen for adults 65+: fallen in past year, unsteady standing/walking, worried about falling. Any positive → in-office assessment", criteria: { age: ">=65" }, actions: { positive: "Timed Up and Go test in office, medication review, vision check, home safety assessment" } },
    { name: "Red Flag Emergency Escalation Protocol", category: "Emergency", description: "Immediate escalation triggers: chest pain + dyspnea, worst headache of life, stroke symptoms (BE-FAST), active suicidal ideation, severe bleeding, respiratory distress, anaphylaxis", criteria: { always_active: true }, actions: { step1: "Stop data collection", step2: "Acknowledge urgency", step3: "Warm transfer to on-call nurse/provider", step4: "If unavailable: direct to call 911", step5: "Log RED FLAG marker", step6: "Alert assigned provider" } },
    { name: "SDOH Social Determinants Screening", category: "Social", description: "Food insecurity (2-item Hunger Vital Sign), transportation barriers, housing stability, safety — per PRAPARE/Health Leads frameworks", criteria: { visitTypes: ["ANNUAL_WELLNESS", "NEW_PATIENT"], recommended: true }, actions: { positive_food: "Refer to food assistance programs", positive_transport: "Coordinate medical transport", positive_safety: "Private follow-up with social work" } },
  ];
  const protocols = await Promise.all(protocolDefs.map(p => prisma.clinicalProtocol.create({ data: p })));

  console.log(`✅ Created ${protocols.length} clinical protocols`);

  // ─── Audit Logs (sample) ───────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { action: "PRE_VISIT_BRIEF_GENERATED", entityType: "PreVisitBrief", entityId: briefs[0].id, userId: "SYSTEM", details: { triggerType: "automated", appointmentId: appointments[0].id } },
      { action: "VOICE_CALL_COMPLETED", entityType: "VoiceCall", entityId: calls[0].id, userId: "SYSTEM", details: { duration: 720, completionRate: 0.95 } },
      { action: "EHR_SYNC_SUCCESS", entityType: "PreVisitBrief", entityId: briefs[0].id, userId: "SYSTEM", details: { ehrSystem: "Epic", syncDuration: 2.3 } },
      { action: "PATIENT_CONSENT_GIVEN", entityType: "Patient", entityId: patients[0].id, details: { method: "voice_confirmation" } },
      { action: "BRIEF_REVIEWED", entityType: "PreVisitBrief", entityId: briefs[2].id, userId: users[1].id, details: { reviewNotes: "High priority — preparing for fluid overload management" } },
    ],
  });

  console.log(`✅ Created audit log entries`);

  // ─── Pre-Built AI Agents ─────────────────────────────────
  const agentDefs = [
    {
      name: "Pre-Visit Clinical Intake",
      description: "Comprehensive pre-visit data collection — calls patient 36hr before appointment, gathers CC, HPI, ROS, medications, and generates a physician-grade SOAP note and visit brief.",
      type: "pre_visit",
      status: "active",
      trigger: { type: "schedule", config: { hoursBefore: 36 } },
      steps: [
        { id: "s1", type: "ehr_sync", name: "Sync Patient Records", config: { sources: ["ehr", "labs", "referrals"] }, order: 0 },
        { id: "s2", type: "voice_call", name: "Call Patient", config: { greeting: "clinical_intake", maxDuration: 600 }, order: 1 },
        { id: "s3", type: "collect_intake", name: "Collect Chief Complaint & HPI", config: { fields: ["cc", "hpi", "ros", "medications", "allergies"] }, order: 2 },
        { id: "s4", type: "red_flag_check", name: "Screen for Red Flags", config: { protocols: ["schmitt_thompson"], severity: "all" }, order: 3 },
        { id: "s5", type: "generate_soap", name: "Generate SOAP Note", config: { engine: "ai", fallback: "template", includeDifferentials: true }, order: 4 },
        { id: "s6", type: "notify_provider", name: "Alert Provider if Red Flags", config: { condition: "red_flags_detected", channels: ["dashboard", "email"] }, order: 5 },
        { id: "s7", type: "deliver_brief", name: "Deliver Brief to EHR", config: { pushToEhr: true, notifyProvider: true }, order: 6 },
        { id: "s8", type: "trigger_agent", name: "Trigger Appointment Reminder", config: { agentName: "Appointment Reminder", condition: "if_appointment_confirmed", delayHours: 12 }, order: 7 },
      ],
      settings: { retryAttempts: 3, retryIntervalMin: 60, smsFallback: true, voicemailMessage: "Hello, this is MyAIDoctor calling about your upcoming appointment. Please call us back or use the link in your text message to complete your pre-visit questionnaire." },
    },
    {
      name: "Appointment Reminder",
      description: "Automated reminder call 24 hours before the appointment. Confirms attendance, offers rescheduling, and sends SMS confirmation.",
      type: "appointment_reminder",
      status: "active",
      trigger: { type: "schedule", config: { hoursBefore: 24 } },
      steps: [
        { id: "s1", type: "voice_call", name: "Reminder Call", config: { greeting: "appointment_reminder", maxDuration: 120 }, order: 0 },
        { id: "s2", type: "condition", name: "Patient Confirmed?", config: { field: "confirmed", ifTrue: "next", ifFalse: "reschedule" }, order: 1 },
        { id: "s3", type: "sms", name: "Send Confirmation SMS", config: { template: "appointment_confirmed" }, order: 2 },
        { id: "s4", type: "notify_provider", name: "Update Appointment Status", config: { updateStatus: true }, order: 3 },
      ],
      settings: { retryAttempts: 2, retryIntervalMin: 120, smsFallback: true },
    },
    {
      name: "Post-Visit Follow-Up",
      description: "48-hour post-visit check-in call. Assesses symptom changes, medication compliance, side effects, and generates a follow-up summary for the provider.",
      type: "follow_up",
      status: "draft",
      trigger: { type: "schedule", config: { hoursAfterVisit: 48 } },
      steps: [
        { id: "s1", type: "ehr_sync", name: "Pull Visit Notes", config: { sources: ["recent_visit", "prescriptions"] }, order: 0 },
        { id: "s2", type: "voice_call", name: "Follow-Up Call", config: { greeting: "post_visit_followup", maxDuration: 300 }, order: 1 },
        { id: "s3", type: "collect_intake", name: "Assess Recovery", config: { fields: ["symptom_changes", "medication_compliance", "side_effects", "concerns"] }, order: 2 },
        { id: "s4", type: "red_flag_check", name: "Check for Complications", config: { protocols: ["post_surgical", "medication_adverse"], severity: "all" }, order: 3 },
        { id: "s5", type: "generate_soap", name: "Generate Follow-Up Summary", config: { engine: "ai", type: "follow_up_note" }, order: 4 },
        { id: "s6", type: "deliver_brief", name: "Send to Provider", config: { pushToEhr: true }, order: 5 },
        { id: "s7", type: "trigger_agent", name: "Handle Refill if Needed", config: { agentName: "Refill Manager", condition: "if_medication_issues", context: "post_visit_followup" }, order: 6 },
      ],
      settings: { retryAttempts: 2, retryIntervalMin: 180, smsFallback: true },
    },
    {
      name: "Lab Results Review",
      description: "Triggered when new lab results arrive. AI reviews results against patient history, identifies abnormals, and notifies the provider with clinical context.",
      type: "lab_review",
      status: "draft",
      trigger: { type: "event", config: { event: "lab_results_received" } },
      steps: [
        { id: "s1", type: "ehr_sync", name: "Fetch Lab Results", config: { sources: ["labs", "patient_history"] }, order: 0 },
        { id: "s2", type: "red_flag_check", name: "Flag Critical Values", config: { protocols: ["lab_critical_values"], severity: "all" }, order: 1 },
        { id: "s3", type: "condition", name: "Abnormal Results?", config: { field: "has_abnormals", ifTrue: "notify", ifFalse: "file" }, order: 2 },
        { id: "s4", type: "generate_soap", name: "Generate Lab Interpretation", config: { engine: "ai", type: "lab_interpretation" }, order: 3 },
        { id: "s5", type: "notify_provider", name: "Alert Provider", config: { channels: ["dashboard", "email"], priority: "based_on_severity" }, order: 4 },
        { id: "s6", type: "voice_call", name: "Notify Patient", config: { greeting: "lab_results", maxDuration: 180 }, order: 5 },
        { id: "s7", type: "trigger_agent", name: "Referral if Specialist Needed", config: { agentName: "Referral Coordinator", condition: "if_specialist_recommended", context: "abnormal_labs" }, order: 6 },
      ],
      settings: { retryAttempts: 1, retryIntervalMin: 30, smsFallback: false },
    },
    {
      name: "Chronic Disease Check-In",
      description: "Monthly automated check-in for patients with chronic conditions (diabetes, hypertension, COPD). Tracks vitals, medication adherence, and generates care plan updates.",
      type: "custom",
      status: "draft",
      trigger: { type: "schedule", config: { intervalDays: 30, conditions: ["diabetes", "hypertension", "copd", "chf"] } },
      steps: [
        { id: "s1", type: "ehr_sync", name: "Pull Latest Records", config: { sources: ["ehr", "labs", "vitals", "medications"] }, order: 0 },
        { id: "s2", type: "voice_call", name: "Monthly Check-In Call", config: { greeting: "chronic_care_checkin", maxDuration: 480 }, order: 1 },
        { id: "s3", type: "collect_intake", name: "Collect Vitals & Symptoms", config: { fields: ["blood_sugar", "blood_pressure", "weight", "symptoms", "medication_compliance", "diet_exercise"] }, order: 2 },
        { id: "s4", type: "red_flag_check", name: "Screen for Deterioration", config: { protocols: ["diabetes_management", "hypertension_crisis", "copd_exacerbation"], severity: "all" }, order: 3 },
        { id: "s5", type: "generate_soap", name: "Generate Care Plan Update", config: { engine: "ai", type: "chronic_care_update", compareWithPrevious: true }, order: 4 },
        { id: "s6", type: "deliver_brief", name: "Update Care Plan in EHR", config: { pushToEhr: true, notifyProvider: true }, order: 5 },
        { id: "s7", type: "trigger_agent", name: "Refill if Meds Running Low", config: { agentName: "Refill Manager", condition: "if_refill_needed", context: "chronic_care_checkin" }, order: 6 },
        { id: "s8", type: "trigger_agent", name: "Schedule Follow-Up Visit", config: { agentName: "Schedule Assistant", condition: "if_followup_recommended", context: "chronic_care_review" }, order: 7 },
      ],
      settings: { retryAttempts: 3, retryIntervalMin: 240, smsFallback: true, voicemailMessage: "Hello, this is MyAIDoctor calling for your monthly health check-in. Please call us back at your convenience." },
    },
    {
      name: "New Patient Onboarding",
      description: "Comprehensive onboarding for new patients. Collects complete medical history, insurance verification, consent forms, and schedules first visit preparation.",
      type: "custom",
      status: "active",
      trigger: { type: "event", config: { event: "new_patient_registered" } },
      steps: [
        { id: "s1", type: "voice_call", name: "Welcome Call", config: { greeting: "new_patient_welcome", maxDuration: 900 }, order: 0 },
        { id: "s2", type: "collect_intake", name: "Full Medical History", config: { fields: ["demographics", "past_medical_history", "surgical_history", "family_history", "social_history", "medications", "allergies", "immunizations"] }, order: 1 },
        { id: "s3", type: "collect_intake", name: "Insurance Verification", config: { fields: ["insurance_carrier", "member_id", "group_id", "primary_care"] }, order: 2 },
        { id: "s4", type: "red_flag_check", name: "Screen History for Risks", config: { protocols: ["intake_risk_assessment"], severity: "all" }, order: 3 },
        { id: "s5", type: "generate_soap", name: "Generate Patient Summary", config: { engine: "ai", type: "new_patient_summary" }, order: 4 },
        { id: "s6", type: "deliver_brief", name: "Create Chart in EHR", config: { pushToEhr: true, createChart: true }, order: 5 },
        { id: "s7", type: "sms", name: "Send Welcome Kit", config: { template: "welcome_kit", includePortalLink: true }, order: 6 },
      ],
      settings: { retryAttempts: 3, retryIntervalMin: 120, smsFallback: true },
    },
    {
      name: "Schedule Assistant",
      description: "Helps patients reschedule or cancel appointments. Checks provider availability, confirms changes, and triggers pre-visit intake for rescheduled appointments.",
      type: "custom",
      status: "active",
      trigger: { type: "event", config: { events: ["patient_call_reschedule", "inbound_call_scheduling", "sms_keyword_reschedule"] } },
      steps: [
        { id: "s1", type: "voice_call", name: "Connect with Patient", config: { greeting: "scheduling_assistant", maxDuration: 300, intent: "reschedule_or_cancel" }, order: 0 },
        { id: "s2", type: "collect_intake", name: "Understand Request", config: { fields: ["action_type", "appointment_id", "preferred_dates", "preferred_times", "reason_for_change"] }, order: 1 },
        { id: "s3", type: "ehr_sync", name: "Pull Current Appointments", config: { sources: ["appointments", "provider_schedule"] }, order: 2 },
        { id: "s4", type: "condition", name: "Reschedule or Cancel?", config: { field: "action_type", conditions: { reschedule: "check_availability", cancel: "confirm_cancel" } }, order: 3 },
        { id: "s5", type: "check_availability", name: "Find Available Slots", config: { lookAheadDays: 14, respectPreferences: true, sameProvider: true }, order: 4 },
        { id: "s6", type: "update_appointment", name: "Update Appointment", config: { actions: ["reschedule", "cancel"], requireConfirmation: true }, order: 5 },
        { id: "s7", type: "patient_confirm", name: "Confirm with Patient", config: { channels: ["sms", "voice"], template: "appointment_updated" }, order: 6 },
        { id: "s8", type: "notify_provider", name: "Notify Provider of Change", config: { channels: ["dashboard", "email"], includeReason: true }, order: 7 },
        { id: "s9", type: "trigger_agent", name: "Start Pre-Visit Intake", config: { agentName: "Pre-Visit Clinical Intake", condition: "if_rescheduled", delayHours: 0 }, order: 8 },
      ],
      settings: { retryAttempts: 2, retryIntervalMin: 30, smsFallback: true, voicemailMessage: "Hello, this is MyAIDoctor. We received your scheduling request. Please call us back or reply to the text message to reschedule your appointment." },
    },
    {
      name: "Refill Manager",
      description: "Processes medication refill requests. Verifies current prescriptions, checks for interactions and expired scripts, routes to provider for approval, and sends to pharmacy.",
      type: "custom",
      status: "active",
      trigger: { type: "event", config: { events: ["patient_call_refill", "inbound_call_refill", "patient_portal_refill", "sms_keyword_refill"] } },
      steps: [
        { id: "s1", type: "voice_call", name: "Connect with Patient", config: { greeting: "refill_request", maxDuration: 240, intent: "medication_refill" }, order: 0 },
        { id: "s2", type: "collect_intake", name: "Collect Refill Details", config: { fields: ["medication_name", "medication_dose", "pharmacy_preference", "last_fill_date", "remaining_supply", "any_side_effects", "dosage_changes"] }, order: 1 },
        { id: "s3", type: "ehr_sync", name: "Verify Prescriptions", config: { sources: ["medications", "prescriptions", "allergies", "labs"] }, order: 2 },
        { id: "s4", type: "red_flag_check", name: "Safety Screening", config: { protocols: ["drug_interactions", "refill_too_early", "controlled_substance_check", "expired_prescription"], severity: "all" }, order: 3 },
        { id: "s5", type: "condition", name: "Auto-Approve or Review?", config: { field: "safety_status", conditions: { safe_routine: "auto_approve", needs_review: "provider_review", flagged: "urgent_review" } }, order: 4 },
        { id: "s6", type: "authorize_request", name: "Provider Approval", config: { urgency: "based_on_supply", autoApproveIfRoutine: true, requiresReviewFor: ["controlled", "new_medication", "dose_change"] }, order: 5 },
        { id: "s7", type: "pharmacy_request", name: "Send to Pharmacy", config: { method: "eRx", includeNotes: true, confirmPharmacy: true }, order: 6 },
        { id: "s8", type: "patient_confirm", name: "Confirm with Patient", config: { channels: ["sms"], template: "refill_sent", includePharmacy: true, includePickupTime: true }, order: 7 },
        { id: "s9", type: "condition", name: "Follow-Up Needed?", config: { field: "needs_followup", conditions: { yes: "schedule_followup", no: "complete" } }, order: 8 },
        { id: "s10", type: "trigger_agent", name: "Schedule Follow-Up", config: { agentName: "Schedule Assistant", condition: "if_followup_needed", context: "medication_review" }, order: 9 },
      ],
      settings: { retryAttempts: 2, retryIntervalMin: 60, smsFallback: true, autoApproveWindow: 72, voicemailMessage: "Hello, this is MyAIDoctor regarding your medication refill request. Please call us back or text REFILL to process your request." },
    },
    {
      name: "Referral Coordinator",
      description: "Manages referral requests from patients or providers. Gathers clinical context, finds in-network specialists, generates referral summaries, and handles authorization.",
      type: "custom",
      status: "active",
      trigger: { type: "event", config: { events: ["patient_call_referral", "provider_referral_request", "inbound_call_referral", "sms_keyword_referral"] } },
      steps: [
        { id: "s1", type: "voice_call", name: "Discuss Referral Need", config: { greeting: "referral_coordinator", maxDuration: 360, intent: "referral_request" }, order: 0 },
        { id: "s2", type: "collect_intake", name: "Gather Referral Details", config: { fields: ["specialty_needed", "reason_for_referral", "urgency_level", "symptoms", "preferred_location", "insurance_requirements", "prior_specialist_visits"] }, order: 1 },
        { id: "s3", type: "ehr_sync", name: "Pull Clinical Records", config: { sources: ["ehr", "labs", "imaging", "medications", "conditions"] }, order: 2 },
        { id: "s4", type: "generate_soap", name: "Generate Referral Summary", config: { engine: "ai", type: "referral_summary", includeRelevantHistory: true, includeRecentLabs: true }, order: 3 },
        { id: "s5", type: "find_specialist", name: "Find In-Network Specialist", config: { checkInsurance: true, maxDistance: 25, sortBy: "availability", includeRatings: true }, order: 4 },
        { id: "s6", type: "authorize_request", name: "Provider Authorization", config: { urgency: "based_on_clinical", requiresAuth: true, includeReferralSummary: true }, order: 5 },
        { id: "s7", type: "condition", name: "Authorization Status", config: { field: "auth_status", conditions: { approved: "send_referral", denied: "notify_patient_denied", pending: "wait_for_auth" } }, order: 6 },
        { id: "s8", type: "deliver_brief", name: "Send Referral Package", config: { sendTo: "specialist", includeRecords: true, includeSummary: true, method: "secure_fax_or_portal" }, order: 7 },
        { id: "s9", type: "patient_confirm", name: "Confirm with Patient", config: { channels: ["sms", "voice"], template: "referral_sent", includeSpecialistInfo: true, includeNextSteps: true }, order: 8 },
        { id: "s10", type: "trigger_agent", name: "Schedule Specialist Appointment", config: { agentName: "Schedule Assistant", condition: "always", context: "specialist_appointment" }, order: 9 },
        { id: "s11", type: "notify_provider", name: "Update Referring Provider", config: { channels: ["dashboard"], includeSpecialistResponse: true, trackStatus: true }, order: 10 },
      ],
      settings: { retryAttempts: 2, retryIntervalMin: 120, smsFallback: true, urgencyEscalation: true, voicemailMessage: "Hello, this is MyAIDoctor regarding your referral request. Please call us back or reply to the text message for assistance." },
    },
  ];

  for (const def of agentDefs) {
    await prisma.aIAgent.create({ data: def });
  }
  console.log(`✅ Created ${agentDefs.length} pre-built AI agents`);

  // Assign active agents to all clinics
  const activeAgents = await prisma.aIAgent.findMany({ where: { status: "active" } });
  for (const agent of activeAgents) {
    await prisma.aIAgentAssignment.create({
      data: { agentId: agent.id, scope: "all" },
    });
  }
  console.log(`✅ Assigned ${activeAgents.length} active agents to all clinics`);

  console.log("\n🎉 Seed complete! Database is ready.\n");
  // ─── Seed User Preferences ─────────────────────────────
  console.log("🎨 Seeding user preferences...");
  for (const user of users) {
    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        themeMode: "dark",
        themeAccent: "emerald",
        fontSize: 100,
        sidebarCollapsed: false,
      },
    });
  }
  console.log(`   ✓ ${users.length} user preferences created`);

  console.log("\n📋 ═══════════════════════════════════════════════════════");
  console.log("📋 LOGIN CREDENTIALS (all passwords: MyAIDoc2024!)");
  console.log("📋 ═══════════════════════════════════════════════════════");
  console.log("📋 Super Admin:  superadmin@myaidoctor.io");
  console.log("📋 Admin:        admin@myaidoctor.io");
  console.log("📋 Dr. Chen:     dr.chen@myaidoctor.io     (2 appointments with Jane)");
  console.log("📋 Dr. Patel:    dr.patel@myaidoctor.io    (1 appointment with Jane)");
  console.log("📋 Dr. Okonkwo:  dr.okonkwo@myaidoctor.io");
  console.log("📋 Dr. Martinez: dr.martinez@myaidoctor.io");
  console.log("📋 Patient Jane: jane.smith@email.com      (→ Patient Portal)");
  console.log("📋 ═══════════════════════════════════════════════════════");
  console.log("📋 Jane's Appointments:");
  console.log("📋   1. FOLLOW_UP in 2 days      → Dr. Chen  (Diabetes + HTN follow-up)");
  console.log("📋   2. ANNUAL_WELLNESS in 14 days → Dr. Chen  (Annual exam + lab review)");
  console.log("📋   3. FOLLOW_UP in 30 days      → Dr. Patel (Medication adjustment)");
  console.log("📋 ═══════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
