"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Shield,
  KeyRound,
  Loader2,
  ArrowLeft,
  Phone,
  MessageSquare,
  Smartphone,
  LogOut,
} from "lucide-react";

type VerifyMode = "code" | "backup";

export default function MfaVerifyPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState<VerifyMode>("code");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Auto-send OTP for SMS/WhatsApp users on mount
  const sendOTP = useCallback(async () => {
    if (cooldown > 0) return;
    try {
      const res = await fetch("/api/auth/mfa/send-otp", { method: "POST" });
      const data = await res.json();

      if (res.status === 429) {
        setError(data.error);
        return;
      }

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setOtpSent(true);
      setCooldown(30);
      setError("");
    } catch {
      setError("Failed to send verification code");
    }
  }, [cooldown]);

  // Detect if user uses SMS/WhatsApp and hasn't sent OTP yet
  useEffect(() => {
    // We don't know the method from session, so we'll let the user trigger resend
  }, []);

  async function verifyCode() {
    const cleanCode = code.trim().replace(/-/g, "");
    if (!cleanCode) {
      setError("Please enter a code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          type: mode === "backup" ? "backup" : "totp",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // If backup code was used, warn about remaining codes
      if (data.usedBackupCode && data.backupCodesRemaining !== undefined) {
        if (data.backupCodesRemaining <= 3) {
          console.warn(
            `⚠️ Only ${data.backupCodesRemaining} backup codes remaining!`
          );
        }
      }

      // Update session to mark MFA as verified
      await update({ mfaVerified: true });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Verification failed");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && code.length >= 6) {
      verifyCode();
    }
  }

  const isSmsOrWhatsApp = true; // We show "send code" option for all — it'll error if TOTP

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto shadow-lg shadow-brand-900/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">
            Two-Factor Authentication
          </h1>
          <p className="text-sm text-slate-400">
            {session?.user?.email && (
              <span>
                Signed in as{" "}
                <span className="text-slate-300">{session.user.email}</span>
              </span>
            )}
          </p>
        </div>

        {/* Code entry */}
        {mode === "code" && (
          <div className="card p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Smartphone className="w-4 h-4 text-brand-400" />
                <p className="text-sm font-medium text-slate-300">
                  Enter verification code
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Open your authenticator app or check your phone for a 6-digit
                code
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleKeyDown}
              placeholder="000000"
              className="input-field text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={verifyCode}
              disabled={loading || code.length < 6}
              className="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </button>

            {/* SMS/WhatsApp resend */}
            <div className="border-t border-midnight-700/50 pt-4 space-y-2">
              <p className="text-xs text-slate-500 text-center">
                Using SMS or WhatsApp?
              </p>
              <button
                onClick={sendOTP}
                disabled={cooldown > 0}
                className="w-full text-sm text-brand-400 hover:text-brand-300 disabled:text-slate-600 transition-colors"
              >
                {cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : otpSent
                  ? "Resend verification code"
                  : "Send verification code to my phone"}
              </button>
            </div>

            {/* Backup code toggle */}
            <button
              onClick={() => {
                setMode("backup");
                setCode("");
                setError("");
              }}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              Use a recovery code instead
            </button>
          </div>
        )}

        {/* Backup code entry */}
        {mode === "backup" && (
          <div className="card p-6 space-y-5">
            <button
              onClick={() => {
                setMode("code");
                setCode("");
                setError("");
              }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to verification code
            </button>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-medium text-slate-300">
                  Enter a recovery code
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Use one of the backup codes you saved during MFA setup. Each
                code can only be used once.
              </p>
            </div>

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="XXXX-XXXX"
              className="input-field text-center text-xl tracking-widest font-mono uppercase"
              autoFocus
            />

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={verifyCode}
              disabled={loading || code.length < 8}
              className="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Recovery Code"
              )}
            </button>
          </div>
        )}

        {/* Sign out link */}
        <button
          onClick={() => signOut({ callbackUrl: window.location.origin + "/login" })}
          className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign in with a different account
        </button>
      </div>
    </div>
  );
}
