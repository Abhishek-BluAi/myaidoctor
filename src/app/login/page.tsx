"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2,
  CheckCircle2, Shield, KeyRound, ArrowLeft, QrCode, Copy, Check,
  Download, AlertTriangle,
} from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex px-4 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

type Step = "credentials" | "mfa-setup-qr" | "mfa-setup-verify" | "mfa-setup-backup" | "mfa-verify";

function LoginContent() {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";
  const { update } = useSession();

  // Force dark mode on login page — prevent unreadable text if user was in light mode
  useEffect(() => {
    const savedMode = document.documentElement.getAttribute("data-mode");
    document.documentElement.setAttribute("data-mode", "dark");
    return () => {
      const restoreMode = localStorage.getItem("theme-mode") || savedMode || "dark";
      document.documentElement.setAttribute("data-mode", restoreMode);
    };
  }, []);

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // MFA verify state
  const [mfaCode, setMfaCode] = useState("");
  const [mfaType, setMfaType] = useState<"totp" | "backup">("totp");

  // MFA setup state
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Demo / Signup overlay state
  const [overlay, setOverlay] = useState<"demo" | "signup" | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const initialFormData = { firstName: "", lastName: "", email: "", phone: "", organization: "", location: "", title: "", role: "", practiceSize: "", currentEmr: "", timeline: "", source: "", notes: "" };
  const [formData, setFormData] = useState(initialFormData);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    try {
      await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: overlay, ...formData, submittedAt: new Date().toISOString() }),
      });
    } catch {} // best-effort
    setFormLoading(false);
    setFormSubmitted(true);
  }

  function goToDashboard() {
    window.location.href = "/dashboard";
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Fetch fresh session to check MFA status
      const res = await fetch("/api/auth/session");
      const sess = await res.json();

      if (!sess?.user) {
        setError("Session error. Please try again.");
        setLoading(false);
        return;
      }

      // If MFA is not required for this user, skip directly to dashboard
      if (sess.user.mfaRequired === false) {
        goToDashboard();
        return;
      }

      if (!sess.user.mfaEnabled) {
        // User needs to set up MFA — fetch QR code
        const setupRes = await fetch("/api/auth/mfa/setup");
        const setupData = await setupRes.json();

        if (!setupRes.ok) {
          setError(setupData.error || "Failed to initialize MFA setup");
          setLoading(false);
          return;
        }

        setQrCode(setupData.qrCode);
        setTotpSecret(setupData.secret);
        setStep("mfa-setup-qr");
        setLoading(false);
      } else if (!sess.user.mfaVerified) {
        // User has MFA — needs to verify
        setStep("mfa-verify");
        setLoading(false);
      } else {
        // Fully authenticated
        goToDashboard();
      }
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  async function handleSetupVerify() {
    if (mfaCode.length < 6) { setError("Enter a 6-digit code"); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setBackupCodes(data.backupCodes);
      setMfaCode("");
      setStep("mfa-setup-backup");
      setLoading(false);
    } catch {
      setError("Verification failed.");
      setLoading(false);
    }
  }

  async function handleMfaVerify() {
    const code = mfaCode.trim().replace(/-/g, "");
    if (!code) { setError("Enter a code"); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, type: mfaType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Update JWT to set mfaVerified=true
      await update({ mfaVerified: true });
      goToDashboard();
    } catch {
      setError("Verification failed.");
      setLoading(false);
    }
  }

  async function handleBackupDone() {
    // MFA was just set up, so mfaVerifiedAt is already set by the setup API.
    // Update the JWT to reflect this.
    await update({ mfaVerified: true });
    goToDashboard();
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBackupCodes() {
    const text = ["MyAIDoctor.io — Recovery Codes", "", ...backupCodes.map((c, i) => `${i + 1}. ${c}`)].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "myaidoctor-recovery-codes.txt";
    a.click();
  }

  // ── MFA Setup: QR Code ─────────────────────────────────
  if (step === "mfa-setup-qr") {
    return (
      <CenteredCard title="Set Up Authenticator" subtitle="Scan the QR code with Google Authenticator, Authy, or any TOTP app">
        {qrCode && <div className="text-center"><div className="inline-block p-3 bg-white rounded-xl"><img src={qrCode} alt="QR" className="w-48 h-48" /></div></div>}
        <div className="space-y-2">
          <p className="text-xs text-slate-500 text-center">Or enter manually:</p>
          <div className="flex items-center gap-2 p-3 bg-midnight-800 rounded-lg border border-midnight-700">
            <KeyRound className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <code className="flex-1 text-sm font-mono text-brand-300 break-all select-all">{totpSecret}</code>
          </div>
        </div>
        <button onClick={() => { setStep("mfa-setup-verify"); setError(""); }} className="w-full btn-primary justify-center py-3">
          I&apos;ve scanned the code — Next
        </button>
      </CenteredCard>
    );
  }

  // ── MFA Setup: Verify Code ─────────────────────────────
  if (step === "mfa-setup-verify") {
    return (
      <CenteredCard title="Verify Authenticator" subtitle="Enter the 6-digit code from your authenticator app">
        {error && <ErrorBox message={error} />}
        <input type="text" inputMode="numeric" maxLength={6} value={mfaCode}
          onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={e => { if (e.key === "Enter" && mfaCode.length === 6) handleSetupVerify(); }}
          placeholder="000000" className="input-field text-center text-2xl tracking-[0.5em] font-mono" autoFocus />
        <button onClick={handleSetupVerify} disabled={loading || mfaCode.length < 6}
          className="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : "Verify & Enable MFA"}
        </button>
        <button onClick={() => { setStep("mfa-setup-qr"); setError(""); setMfaCode(""); }}
          className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors">← Back to QR code</button>
      </CenteredCard>
    );
  }

  // ── MFA Setup: Backup Codes ────────────────────────────
  if (step === "mfa-setup-backup") {
    return (
      <CenteredCard title="Save Recovery Codes" subtitle="">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-800/40">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div><p className="text-sm font-semibold text-amber-200">Save these codes now</p>
          <p className="text-xs text-amber-400/80 mt-1">They&apos;re the only way to access your account if you lose your authenticator. Each code works once.</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 bg-midnight-800 rounded-lg border border-midnight-700">
          {backupCodes.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm font-mono">
              <span className="text-slate-600 text-xs w-5 text-right">{i + 1}.</span>
              <span className="text-slate-200">{c}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={copyBackupCodes} className="flex-1 btn-secondary justify-center">
            {copied ? <><Check className="w-4 h-4 text-brand-400" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
          </button>
          <button onClick={downloadBackupCodes} className="flex-1 btn-secondary justify-center">
            <Download className="w-4 h-4" />Download
          </button>
        </div>
        <button onClick={handleBackupDone} className="w-full btn-primary justify-center py-3 text-base font-semibold">
          I&apos;ve saved my codes — Go to Dashboard
        </button>
      </CenteredCard>
    );
  }

  // ── MFA Verify (returning user) ────────────────────────
  if (step === "mfa-verify") {
    return (
      <CenteredCard
        title="Two-Factor Authentication"
        subtitle={mfaType === "totp" ? "Enter the 6-digit code from your authenticator app" : "Enter one of your recovery codes"}
        icon={<Shield className="w-7 h-7 text-white" />}
      >
        {error && <ErrorBox message={error} />}
        {mfaType === "totp" ? (
          <input type="text" inputMode="numeric" maxLength={6} value={mfaCode}
            onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={e => { if (e.key === "Enter" && mfaCode.length === 6) handleMfaVerify(); }}
            placeholder="000000" className="input-field text-center text-2xl tracking-[0.5em] font-mono" autoFocus />
        ) : (
          <input type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter" && mfaCode.length >= 8) handleMfaVerify(); }}
            placeholder="XXXX-XXXX" className="input-field text-center text-xl tracking-widest font-mono uppercase" autoFocus />
        )}
        <button onClick={handleMfaVerify}
          disabled={loading || (mfaType === "totp" ? mfaCode.length < 6 : mfaCode.length < 8)}
          className="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : "Verify"}
        </button>
        <button onClick={() => { setMfaType(mfaType === "totp" ? "backup" : "totp"); setMfaCode(""); setError(""); }}
          className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          {mfaType === "totp" ? <><KeyRound className="w-4 h-4" />Use a recovery code</> : <><ArrowLeft className="w-4 h-4" />Back to authenticator</>}
        </button>
      </CenteredCard>
    );
  }

  // ── Credentials Step ───────────────────────────────────
  return (<>
    <div className="min-h-screen flex px-4">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-midnight-950 via-midnight-900 to-brand-950 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg"><Stethoscope className="w-5 h-5 text-white" /></div>
          <div><span className="font-display font-bold text-xl text-white tracking-tight">MyAI<span className="text-brand-400">Doctor</span></span><span className="text-[10px] text-brand-500 font-mono ml-1">.io</span></div>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-display font-bold text-white leading-tight">Clinical Context Engine for <span className="text-brand-400">Outpatient Care</span></h1>
          <p className="text-lg text-slate-400 leading-relaxed">AI-powered pre-visit preparation, voice intake, and clinical intelligence — so you can focus on what matters most.</p>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-600">
          <span>HIPAA Compliant</span><span className="w-1 h-1 rounded-full bg-slate-700" /><span>SOC 2 Type II</span><span className="w-1 h-1 rounded-full bg-slate-700" /><span>256-bit Encryption</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md px-4 sm:px-0 space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center"><Stethoscope className="w-5 h-5 text-white" /></div>
            <span className="font-display font-bold text-xl text-white">MyAI<span className="text-brand-400">Doctor</span><span className="text-[10px] text-brand-500 font-mono ml-1">.io</span></span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">Sign in to access your clinical dashboard</p>
          </div>

          {justRegistered && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-brand-950/50 border border-brand-800/40">
              <CheckCircle2 className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
              <div><p className="text-sm font-medium text-brand-300">Account created with MFA enabled</p>
              <p className="text-sm text-brand-400/80 mt-0.5">Sign in and enter your authenticator code.</p></div>
            </div>
          )}

          {error && <ErrorBox message={error} />}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Email address</label>
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@myaidoctor.io" required autoComplete="email" className="input-field pl-10" /></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">Forgot password?</Link>
              </div>
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password" className="input-field pl-10 pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button></div>
            </div>
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-lg shadow-brand-900/30">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</> : "Sign in"}
            </button>
          </form>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={() => setOverlay("demo")} className="flex-1 py-2.5 rounded-lg border border-brand-600/50 text-brand-400 hover:bg-brand-950/40 text-sm font-medium transition-colors">Request a Demo</button>
            <button onClick={() => setOverlay("signup")} className="flex-1 py-2.5 rounded-lg border border-emerald-600/50 text-emerald-400 hover:bg-emerald-950/40 text-sm font-medium transition-colors">Sign Up</button>
          </div>

          <p className="text-center text-xs text-slate-600">By signing in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>

    {/* ── Request a Demo / Sign Up Overlay ─────────────── */}
    {overlay && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg bg-midnight-900 border border-midnight-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          {formSubmitted ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-display font-bold text-white">
                {overlay === "demo" ? "Thank You for Your Interest!" : "Thank You for Signing Up!"}
              </h2>
              <p className="text-sm text-slate-400">
                {overlay === "demo"
                  ? "We've received your demo request. A member of our team will reach out within 1 business day to schedule a personalized walkthrough of MyAIDoctor."
                  : "We've received your signup request. Our onboarding team will set up your account and send you your sign-in credentials within 1–2 business days."}
              </p>
              <p className="text-xs text-slate-500">Check your email at <span className="text-brand-400">{formData.email}</span> for next steps.</p>
              <button onClick={() => { setOverlay(null); setFormSubmitted(false); setFormData(initialFormData); }} className="btn-primary mx-auto">Back to Login</button>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-bold text-white">{overlay === "demo" ? "Request a Demo" : "Sign Up for MyAIDoctor"}</h2>
                  <p className="text-xs text-slate-500">{overlay === "demo" ? "See the platform in action with a personalized walkthrough" : "Get started with your own MyAIDoctor instance"}</p>
                </div>
                <button onClick={() => setOverlay(null)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-midnight-800">✕</button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">First Name *</label>
                    <input value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} required placeholder="Jane" className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Last Name *</label>
                    <input value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} required placeholder="Smith" className="input-field" />
                  </div>
                </div>

                {/* Contact row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Email Address *</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required placeholder="jane@clinic.com" className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Phone Number *</label>
                    <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required placeholder="(555) 123-4567" className="input-field" />
                  </div>
                </div>

                {/* Organization */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Organization / Practice *</label>
                    <input value={formData.organization} onChange={e => setFormData({ ...formData, organization: e.target.value })} required placeholder="City Medical Group" className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Location *</label>
                    <input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} required placeholder="Chicago, IL" className="input-field" />
                  </div>
                </div>

                {/* Title and role */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Your Title *</label>
                    <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required placeholder="Practice Manager" className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Your Role / Responsibilities</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="input-field">
                      <option value="">Select...</option>
                      <option value="physician">Physician / Provider</option>
                      <option value="practice_manager">Practice Manager</option>
                      <option value="office_admin">Office Administrator</option>
                      <option value="it_director">IT Director / CTO</option>
                      <option value="cmo">Chief Medical Officer</option>
                      <option value="ceo">CEO / Owner</option>
                      <option value="billing">Billing / Revenue Cycle</option>
                      <option value="nursing">Nursing / Clinical Staff</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Organization size */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Practice Size</label>
                    <select value={formData.practiceSize} onChange={e => setFormData({ ...formData, practiceSize: e.target.value })} className="input-field">
                      <option value="">Select...</option>
                      <option value="solo">Solo practitioner</option>
                      <option value="small">Small (2–5 providers)</option>
                      <option value="medium">Medium (6–20 providers)</option>
                      <option value="large">Large (21–50 providers)</option>
                      <option value="enterprise">Enterprise (50+ providers)</option>
                      <option value="hospital">Hospital / Health System</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Current EMR System</label>
                    <select value={formData.currentEmr} onChange={e => setFormData({ ...formData, currentEmr: e.target.value })} className="input-field">
                      <option value="">Select...</option>
                      <option value="epic">Epic</option>
                      <option value="cerner">Cerner / Oracle</option>
                      <option value="athena">athenahealth</option>
                      <option value="ecw">eClinicalWorks</option>
                      <option value="allscripts">Veradigm (Allscripts)</option>
                      <option value="nextgen">NextGen</option>
                      <option value="drchrono">DrChrono</option>
                      <option value="kareo">Kareo / Tebra</option>
                      <option value="other">Other</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">{overlay === "demo" ? "How soon are you looking to implement?" : "When would you like to go live?"}</label>
                  <select value={formData.timeline} onChange={e => setFormData({ ...formData, timeline: e.target.value })} className="input-field">
                    <option value="">Select...</option>
                    <option value="immediately">Immediately / ASAP</option>
                    <option value="1month">Within 1 month</option>
                    <option value="1-3months">1–3 months</option>
                    <option value="3-6months">3–6 months</option>
                    <option value="6plus">6+ months / Just exploring</option>
                  </select>
                </div>

                {/* How did you hear about us */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">How did you hear about us?</label>
                  <select value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} className="input-field">
                    <option value="">Select...</option>
                    <option value="google">Google / Search Engine</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="referral">Colleague / Referral</option>
                    <option value="conference">Conference / Event</option>
                    <option value="social">Social Media</option>
                    <option value="article">Article / Blog / News</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Additional notes */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">{overlay === "demo" ? "Anything specific you'd like to see in the demo?" : "Any special requirements or questions?"}</label>
                  <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} placeholder="Optional" className="input-field resize-none" />
                </div>

                <button type="submit" disabled={formLoading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-800 text-white font-semibold rounded-lg transition-colors shadow-lg">
                  {formLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : overlay === "demo" ? "Submit Demo Request" : "Submit Sign Up Request"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    )}
  </>
  );
}

// ── Shared Components ──────────────────────────────────
function CenteredCard({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex px-4 items-center justify-center p-8">
      <div className="w-full max-w-md px-4 sm:px-0 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto shadow-lg">
            {icon || <Shield className="w-7 h-7 text-white" />}
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className="card p-6 space-y-5">{children}</div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800/50">
      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-red-300">{message}</p>
    </div>
  );
}
