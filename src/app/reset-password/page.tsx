"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Stethoscope, Lock, Loader2, Check, X, CheckCircle2, AlertCircle } from "lucide-react";

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
  { test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p), label: "One special character" },
];

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const strength = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const match = confirmPw.length > 0 && password === confirmPw;

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    fetch(`/api/auth/reset-password-token?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        setTokenValid(data.valid);
        setMaskedEmail(data.email || "");
      })
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/auth/reset-password-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const data = await res.json();
    if (res.ok) { setDone(true); }
    else { setError(data.error); }
    setLoading(false);
  }

  if (validating) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">
              MyAI<span className="text-brand-400">Doctor</span>
              <span className="text-[10px] text-brand-500 font-mono ml-1">.io</span>
            </span>
          </Link>
        </div>

        {!token || !tokenValid ? (
          <div className="card p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-display font-bold text-white">Invalid Reset Link</h2>
            <p className="text-sm text-slate-400">This password reset link is invalid or has expired.</p>
            <Link href="/forgot-password" className="btn-primary inline-flex">Request New Link</Link>
          </div>
        ) : done ? (
          <div className="card p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-brand-400 mx-auto" />
            <h2 className="text-xl font-display font-bold text-white">Password Reset!</h2>
            <p className="text-sm text-slate-400">Your password has been updated successfully.</p>
            <Link href="/login" className="btn-primary inline-flex">Sign In</Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white">Set New Password</h2>
              {maskedEmail && <p className="mt-2 text-sm text-slate-400">For account: <span className="text-slate-300">{maskedEmail}</span></p>}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-sm text-red-300">
                <AlertCircle className="w-4 h-4" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="card p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">New Password</label>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required placeholder="New password" className="input-field pl-10" autoFocus /></div>
                {password.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {PASSWORD_RULES.map((r, i) => (
                      <div key={i} className="flex items-center gap-1 text-[11px]">
                        {r.test(password) ? <Check className="w-3 h-3 text-brand-400" /> : <X className="w-3 h-3 text-slate-600" />}
                        <span className={r.test(password) ? "text-brand-400" : "text-slate-500"}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  required placeholder="Confirm password" className="input-field pl-10 pr-10" />
                {confirmPw.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {match ? <Check className="w-4 h-4 text-brand-400" /> : <X className="w-4 h-4 text-red-400" />}
                  </div>
                )}</div>
              </div>
              <button type="submit" disabled={loading || strength < 5 || !match}
                className="w-full btn-primary justify-center py-3 disabled:opacity-50">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Resetting...</> : "Reset Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
