"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
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

        {sent ? (
          <div className="card p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-brand-400 mx-auto" />
            <h2 className="text-xl font-display font-bold text-white">Check Your Email</h2>
            <p className="text-sm text-slate-400">
              If an account exists with <span className="text-slate-200">{email}</span>,
              you&apos;ll receive a password reset link shortly.
            </p>
            <p className="text-xs text-slate-500">The link expires in 1 hour.</p>
            <Link href="/login" className="btn-primary inline-flex mt-4">
              <ArrowLeft className="w-4 h-4" />Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white">Forgot Password?</h2>
              <p className="mt-2 text-sm text-slate-400">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            <form onSubmit={handleSubmit} className="card p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@myaidoctor.io" required autoFocus className="input-field pl-10" />
                </div>
              </div>
              <button type="submit" disabled={loading || !email}
                className="w-full btn-primary justify-center py-3 disabled:opacity-50">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : "Send Reset Link"}
              </button>
            </form>

            <p className="text-center text-sm text-slate-400">
              Remember your password?{" "}
              <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
