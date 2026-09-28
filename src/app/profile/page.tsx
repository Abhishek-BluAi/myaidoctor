"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  User, Lock, Shield, Eye, EyeOff, Check, X, Loader2,
  AlertCircle, QrCode, KeyRound, Copy, Download, AlertTriangle,
  ShieldCheck, ShieldOff, CheckCircle2,
} from "lucide-react";

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
  { test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p), label: "One special character" },
];

type MfaStep = "idle" | "confirm-password" | "qr" | "verify" | "backup" | "done";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const user = session?.user;

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // MFA reset
  const [mfaStep, setMfaStep] = useState<MfaStep>("idle");
  const [mfaPassword, setMfaPassword] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [copied, setCopied] = useState(false);

  const pwStrength = PASSWORD_RULES.filter((r) => r.test(newPw)).length;
  const pwMatch = confirmPw.length > 0 && newPw === confirmPw;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null); setPwLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwMsg({ type: "success", text: "Password changed successfully" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwMsg({ type: "error", text: data.error });
    }
    setPwLoading(false);
  }

  async function initiateMfaReset() {
    if (!mfaPassword) { setMfaError("Enter your password"); return; }
    setMfaError(""); setMfaLoading(true);
    const res = await fetch("/api/auth/reset-own-mfa", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "initiate", password: mfaPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setQrCode(data.qrCode); setTotpSecret(data.secret);
      setMfaStep("qr"); setMfaPassword("");
    } else {
      setMfaError(data.error);
    }
    setMfaLoading(false);
  }

  async function confirmMfaReset() {
    if (mfaCode.length < 6) { setMfaError("Enter 6-digit code"); return; }
    setMfaError(""); setMfaLoading(true);
    const res = await fetch("/api/auth/reset-own-mfa", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", code: mfaCode.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setBackupCodes(data.backupCodes); setMfaStep("backup");
      await update({ mfaVerified: true });
    } else { setMfaError(data.error); }
    setMfaLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Account & Security</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your password and multi-factor authentication</p>
      </div>

      {/* Account Info */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><User className="w-4 h-4 text-brand-400" />Account Details</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-slate-500">Name</p><p className="text-slate-200">{user?.firstName} {user?.lastName}</p></div>
          <div><p className="text-xs text-slate-500">Email</p><p className="text-slate-200">{user?.email}</p></div>
          <div><p className="text-xs text-slate-500">Role</p><p className="text-slate-200">{user?.role?.replace(/_/g, " ")}</p></div>
          <div><p className="text-xs text-slate-500">MFA Status</p>
            <p className={user?.mfaEnabled ? "text-brand-400" : "text-amber-400"}>
              {user?.mfaEnabled ? "✓ Enabled" : "✗ Not enabled"}
            </p></div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Lock className="w-4 h-4 text-brand-400" />Change Password</div>

        {pwMsg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${pwMsg.type === "success" ? "bg-brand-950/50 border border-brand-800/40 text-brand-300" : "bg-red-950/50 border border-red-800/50 text-red-300"}`}>
            {pwMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {pwMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Current Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required placeholder="Enter current password" className="input-field pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">New Password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required placeholder="Enter new password" className="input-field" />
            {newPw.length > 0 && (
              <div className="grid grid-cols-2 gap-1 mt-1">
                {PASSWORD_RULES.map((r, i) => (
                  <div key={i} className="flex items-center gap-1 text-[11px]">
                    {r.test(newPw) ? <Check className="w-3 h-3 text-brand-400" /> : <X className="w-3 h-3 text-slate-600" />}
                    <span className={r.test(newPw) ? "text-brand-400" : "text-slate-500"}>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Confirm New Password</label>
            <div className="relative">
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required placeholder="Confirm new password" className="input-field pr-10" />
              {confirmPw.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {pwMatch ? <Check className="w-4 h-4 text-brand-400" /> : <X className="w-4 h-4 text-red-400" />}
                </div>
              )}
            </div>
          </div>
          <button type="submit" disabled={pwLoading || pwStrength < 5 || !pwMatch}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Changing...</> : "Change Password"}
          </button>
        </form>
      </div>

      {/* MFA Management */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Shield className="w-4 h-4 text-brand-400" />Multi-Factor Authentication
        </div>

        {mfaError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-sm text-red-300">
            <AlertCircle className="w-4 h-4" />{mfaError}
          </div>
        )}

        {/* Idle state — show status and reset button */}
        {mfaStep === "idle" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-midnight-800/50">
              {user?.mfaEnabled ? (
                <><ShieldCheck className="w-6 h-6 text-brand-400" />
                <div><p className="text-sm font-medium text-white">MFA is enabled</p>
                <p className="text-xs text-slate-400">Your account is protected with an authenticator app</p></div></>
              ) : (
                <><ShieldOff className="w-6 h-6 text-amber-400" />
                <div><p className="text-sm font-medium text-white">MFA is not enabled</p>
                <p className="text-xs text-slate-400">Set up MFA to secure your account</p></div></>
              )}
            </div>
            <button onClick={() => { setMfaStep("confirm-password"); setMfaError(""); }}
              className={user?.mfaEnabled ? "btn-secondary" : "btn-primary"}>
              <Shield className="w-4 h-4" />
              {user?.mfaEnabled ? "Reset MFA (set up new authenticator)" : "Set Up MFA"}
            </button>
          </div>
        )}

        {/* Step 1: Confirm password */}
        {mfaStep === "confirm-password" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Enter your password to {user?.mfaEnabled ? "reset" : "set up"} MFA:</p>
            <input type="password" value={mfaPassword} onChange={(e) => setMfaPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") initiateMfaReset(); }}
              placeholder="Your current password" className="input-field max-w-sm" autoFocus />
            <div className="flex gap-3">
              <button onClick={initiateMfaReset} disabled={mfaLoading || !mfaPassword} className="btn-primary disabled:opacity-50">
                {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
              </button>
              <button onClick={() => { setMfaStep("idle"); setMfaError(""); setMfaPassword(""); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* Step 2: QR Code */}
        {mfaStep === "qr" && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-slate-300 mb-3">Scan with your authenticator app:</p>
              {qrCode && <div className="inline-block p-3 bg-white rounded-xl"><img src={qrCode} alt="QR" className="w-48 h-48" /></div>}
            </div>
            <div className="flex items-center gap-2 p-3 bg-midnight-800 rounded-lg border border-midnight-700">
              <KeyRound className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <code className="flex-1 text-sm font-mono text-brand-300 break-all select-all">{totpSecret}</code>
            </div>
            <button onClick={() => { setMfaStep("verify"); setMfaError(""); }} className="btn-primary w-full justify-center">
              I&apos;ve scanned the code — Next
            </button>
          </div>
        )}

        {/* Step 3: Verify */}
        {mfaStep === "verify" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Enter the 6-digit code from your authenticator:</p>
            <input type="text" inputMode="numeric" maxLength={6} value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && mfaCode.length === 6) confirmMfaReset(); }}
              placeholder="000000" className="input-field text-center text-2xl tracking-[0.5em] font-mono max-w-xs" autoFocus />
            <div className="flex gap-3">
              <button onClick={confirmMfaReset} disabled={mfaLoading || mfaCode.length < 6} className="btn-primary disabled:opacity-50">
                {mfaLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : "Verify & Enable"}
              </button>
              <button onClick={() => { setMfaStep("qr"); setMfaError(""); setMfaCode(""); }} className="btn-secondary">← Back</button>
            </div>
          </div>
        )}

        {/* Step 4: Backup codes */}
        {mfaStep === "backup" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-800/40">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div><p className="text-sm font-semibold text-amber-200">New recovery codes generated</p>
              <p className="text-xs text-amber-400/80 mt-1">Your old recovery codes no longer work. Save these new ones securely.</p></div>
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
              <button onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex-1 btn-secondary justify-center">
                {copied ? <><Check className="w-4 h-4 text-brand-400" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
              </button>
              <button onClick={() => {
                const blob = new Blob([backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")], { type: "text/plain" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "myaidoctor-recovery-codes.txt"; a.click();
              }} className="flex-1 btn-secondary justify-center"><Download className="w-4 h-4" />Download</button>
            </div>
            <button onClick={() => { setMfaStep("done"); }} className="btn-primary w-full justify-center">
              I&apos;ve saved my codes
            </button>
          </div>
        )}

        {/* Done */}
        {mfaStep === "done" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-950/50 border border-brand-800/40">
            <CheckCircle2 className="w-6 h-6 text-brand-400" />
            <div><p className="text-sm font-medium text-brand-300">MFA has been {user?.mfaEnabled ? "reset" : "enabled"} successfully</p>
            <p className="text-xs text-brand-400/70">Your account is now protected with the new authenticator</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
