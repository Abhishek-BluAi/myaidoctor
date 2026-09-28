"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope, Mail, Lock, Eye, EyeOff, User, Building2, Briefcase,
  AlertCircle, Loader2, Check, X, ShieldCheck, QrCode, KeyRound,
  Copy, Download, AlertTriangle,
} from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>}>
      <SignupContent />
    </Suspense>
  );
}

interface Clinic { id: string; name: string; city: string; state: string; }

const ROLES = [
  { value: "PROVIDER", label: "Provider (Doctor/PA/NP)" },
  { value: "NURSE", label: "Nurse" },
  { value: "FRONT_DESK", label: "Front Desk" },
  { value: "BILLING", label: "Billing" },
];

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
  { test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p), label: "One special character" },
];

type Step = "form" | "qr" | "verify" | "backup" | "pending";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "",
    role: "PROVIDER", clinicId: "", specialty: "", npiNumber: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [registrationMode, setRegistrationMode] = useState("open");
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // MFA state
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/clinics").then(r => r.json()).then(data => {
      setClinics(data.clinics || []);
      setRegistrationMode(data.registrationMode || "open");
    }).catch(() => {}).finally(() => { if (!inviteToken) setPageLoading(false); });
  }, [inviteToken]);

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/auth/verify-invite?token=${inviteToken}`).then(r => r.json()).then(data => {
      if (data.valid) {
        setInviteValid(true);
        setForm(f => ({ ...f, email: data.email || f.email, role: data.role || f.role, clinicId: data.clinic?.id || f.clinicId }));
      } else { setInviteValid(false); setInviteError(data.error || "Invalid invitation"); }
    }).catch(() => { setInviteValid(false); setInviteError("Failed to verify invitation"); })
    .finally(() => setPageLoading(false));
  }, [inviteToken]);

  function updateForm(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }
  const passwordStrength = PASSWORD_RULES.filter(r => r.test(form.password)).length;
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, inviteToken: inviteToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      if (!data.isApproved) { setStep("pending"); setLoading(false); return; }

      // Show QR code for MFA setup
      setQrCode(data.mfaSetup.qrCode);
      setTotpSecret(data.mfaSetup.secret);
      setRegistrationToken(data.mfaSetup.registrationToken);
      setStep("qr");
      setLoading(false);
    } catch { setError("Registration failed."); setLoading(false); }
  }

  async function verifyMfaCode() {
    if (mfaCode.length < 6) { setError("Enter a 6-digit code"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationToken, code: mfaCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setBackupCodes(data.backupCodes);
      setStep("backup");
      setLoading(false);
    } catch { setError("Verification failed."); setLoading(false); }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function downloadBackupCodes() {
    const text = ["MyAIDoctor.io — MFA Recovery Codes", `Generated: ${new Date().toISOString()}`, "",
      "Each code can only be used once.", "", ...backupCodes.map((c, i) => `${(i+1).toString().padStart(2," ")}. ${c}`)].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "myaidoctor-recovery-codes.txt"; a.click();
  }

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  if (registrationMode === "invite" && !inviteToken) return (
    <div className="min-h-screen flex items-center justify-center p-6"><div className="w-full max-w-md text-center space-y-6">
      <div className="w-14 h-14 rounded-2xl bg-midnight-800 border border-midnight-700 flex items-center justify-center mx-auto"><ShieldCheck className="w-7 h-7 text-slate-400" /></div>
      <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Invitation Required</h1>
      <p className="text-slate-400">Registration is by invitation only. Contact your administrator.</p>
      <Link href="/login" className="btn-primary inline-flex">Back to Sign In</Link>
    </div></div>
  );

  if (inviteToken && inviteValid === false) return (
    <div className="min-h-screen flex items-center justify-center p-6"><div className="w-full max-w-md text-center space-y-6">
      <div className="w-14 h-14 rounded-2xl bg-red-950/50 border border-red-800/50 flex items-center justify-center mx-auto"><X className="w-7 h-7 text-red-400" /></div>
      <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Invalid Invitation</h1>
      <p className="text-slate-400">{inviteError}</p>
      <Link href="/login" className="btn-primary inline-flex">Back to Sign In</Link>
    </div></div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 py-12">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">MyAI<span className="text-brand-400">Doctor</span><span className="text-[10px] text-brand-500 font-mono ml-1">.io</span></span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white mt-4">
            {step === "form" ? "Create your account" : step === "qr" || step === "verify" ? "Set up authenticator" : step === "backup" ? "Save recovery codes" : "Account created"}
          </h1>
          <p className="text-sm text-slate-400">
            {step === "form" ? "Join MyAIDoctor.io to start using clinical AI" : step === "qr" ? "Scan the QR code with your authenticator app" : step === "verify" ? "Enter the code from your authenticator app" : step === "backup" ? "Store these codes securely — they're your backup" : ""}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800/50">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" /><p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Step 1: Registration Form */}
        {step === "form" && (
          <>
            {registrationMode === "approval" && !inviteToken && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-950/40 border border-amber-800/40">
                <ShieldCheck className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-300/80">New accounts require administrator approval.</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="card p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">First name</label>
                  <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" value={form.firstName} onChange={e => updateForm("firstName", e.target.value)} placeholder="Sarah" required className="input-field pl-10" /></div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Last name</label>
                  <input type="text" value={form.lastName} onChange={e => updateForm("lastName", e.target.value)} placeholder="Chen" required className="input-field" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Email address</label>
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} placeholder="you@clinic.com" required readOnly={!!inviteToken && !!form.email} className="input-field pl-10" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Role</label>
                  <div className="relative"><Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select value={form.role} onChange={e => updateForm("role", e.target.value)} className="input-field pl-10 appearance-none">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select></div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Clinic</label>
                  <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select value={form.clinicId} onChange={e => updateForm("clinicId", e.target.value)} className="input-field pl-10 appearance-none">
                    <option value="">Select a clinic</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name} — {c.city}, {c.state}</option>)}
                  </select></div>
                </div>
              </div>
              {form.role === "PROVIDER" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="block text-sm font-medium text-slate-300">Specialty <span className="text-slate-500">(optional)</span></label>
                  <input type="text" value={form.specialty} onChange={e => updateForm("specialty", e.target.value)} placeholder="Family Medicine" className="input-field" /></div>
                  <div className="space-y-1.5"><label className="block text-sm font-medium text-slate-300">NPI Number <span className="text-slate-500">(optional)</span></label>
                  <input type="text" value={form.npiNumber} onChange={e => updateForm("npiNumber", e.target.value)} placeholder="1234567890" maxLength={10} className="input-field" /></div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Password</label>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={e => updateForm("password", e.target.value)} placeholder="Create a strong password" required className="input-field pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button></div>
                {form.password.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                    {PASSWORD_RULES.map((rule, i) => { const passed = rule.test(form.password); return (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {passed ? <Check className="w-3 h-3 text-brand-400" /> : <X className="w-3 h-3 text-slate-600" />}
                        <span className={passed ? "text-brand-400" : "text-slate-500"}>{rule.label}</span>
                      </div>
                    ); })}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Confirm password</label>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="password" value={form.confirmPassword} onChange={e => updateForm("confirmPassword", e.target.value)} placeholder="Confirm your password" required className="input-field pl-10 pr-10" />
                {form.confirmPassword.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordsMatch ? <Check className="w-4 h-4 text-brand-400" /> : <X className="w-4 h-4 text-red-400" />}
                  </div>
                )}</div>
              </div>
              <button type="submit" disabled={loading || passwordStrength < 5 || !passwordsMatch} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</> : "Create Account & Set Up MFA"}
              </button>
            </form>
          </>
        )}

        {/* Step 2: QR Code */}
        {step === "qr" && (
          <div className="card p-6 space-y-5">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-300">
                <QrCode className="w-4 h-4 text-brand-400" />Scan with your authenticator app
              </div>
              <p className="text-xs text-slate-400">Use Google Authenticator, Authy, or any TOTP-compatible app</p>
              {qrCode && <div className="inline-block p-3 bg-white rounded-xl"><img src={qrCode} alt="MFA QR Code" className="w-48 h-48" /></div>}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">Or enter this key manually:</p>
              <div className="flex items-center gap-2 p-3 bg-midnight-800 rounded-lg border border-midnight-700">
                <KeyRound className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <code className="flex-1 text-sm font-mono text-brand-300 break-all select-all">{totpSecret}</code>
              </div>
            </div>
            <button onClick={() => setStep("verify")} className="w-full btn-primary justify-center py-3">
              I&apos;ve scanned the code — Next
            </button>
          </div>
        )}

        {/* Step 3: Verify Code */}
        {step === "verify" && (
          <div className="card p-6 space-y-5">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-slate-300">Enter the 6-digit code from your authenticator app</p>
            </div>
            <input type="text" inputMode="numeric" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000" className="input-field text-center text-2xl tracking-[0.5em] font-mono" autoFocus
              onKeyDown={e => { if (e.key === "Enter" && mfaCode.length === 6) verifyMfaCode(); }}
            />
            <button onClick={verifyMfaCode} disabled={loading || mfaCode.length < 6} className="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : "Verify Code"}
            </button>
            <button onClick={() => { setStep("qr"); setError(""); setMfaCode(""); }} className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors">
              ← Back to QR code
            </button>
          </div>
        )}

        {/* Step 4: Backup Codes */}
        {step === "backup" && (
          <div className="space-y-5">
            <div className="card p-6 space-y-5">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-800/40">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div><p className="text-sm font-semibold text-amber-200">Save your recovery codes</p>
                <p className="text-xs text-amber-400/80 mt-1">These are the only way to access your account if you lose your authenticator device. Each code can only be used once.</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 bg-midnight-800 rounded-lg border border-midnight-700">
                {backupCodes.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-slate-600 text-xs w-5 text-right">{i+1}.</span>
                    <span className="text-slate-200">{c}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={copyBackupCodes} className="flex-1 btn-secondary justify-center">
                  {copied ? <><Check className="w-4 h-4 text-brand-400" />Copied!</> : <><Copy className="w-4 h-4" />Copy codes</>}
                </button>
                <button onClick={downloadBackupCodes} className="flex-1 btn-secondary justify-center">
                  <Download className="w-4 h-4" />Download .txt
                </button>
              </div>
            </div>
            <button onClick={() => router.push("/login?registered=true")} className="w-full btn-primary justify-center py-3 text-base font-semibold">
              I&apos;ve saved my codes — Continue to Sign In
            </button>
          </div>
        )}

        {/* Pending Approval */}
        {step === "pending" && (
          <div className="card p-8 text-center space-y-4">
            <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-lg font-semibold text-white">Account Pending Approval</h2>
            <p className="text-sm text-slate-400">Your account has been created and is awaiting administrator approval. You&apos;ll be able to sign in once approved.</p>
            <Link href="/login" className="btn-primary inline-flex">Back to Sign In</Link>
          </div>
        )}

        {step === "form" && (
          <p className="text-center text-sm text-slate-400">Already have an account?{" "}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
