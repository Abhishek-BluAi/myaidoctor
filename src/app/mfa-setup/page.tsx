"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Smartphone,
  MessageSquare,
  Phone,
  QrCode,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Download,
} from "lucide-react";

type MfaMethod = "TOTP" | "SMS" | "WHATSAPP";
type Step = "choose" | "configure" | "verify" | "backup";

export default function MfaSetupPage() {
  const { update } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<Step>("choose");
  const [method, setMethod] = useState<MfaMethod | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // TOTP setup data
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");

  // Backup codes
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  async function initSetup(selectedMethod: MfaMethod) {
    setMethod(selectedMethod);
    setError("");

    if (selectedMethod === "TOTP") {
      setLoading(true);
      try {
        const res = await fetch(`/api/auth/mfa/setup?method=TOTP`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error);
          return;
        }

        setQrCode(data.qrCode);
        setTotpSecret(data.secret);
        setStep("configure");
      } catch {
        setError("Failed to initialize MFA setup");
      } finally {
        setLoading(false);
      }
    } else {
      // SMS or WhatsApp — need phone number first
      setStep("configure");
    }
  }

  async function sendPhoneOTP() {
    if (!phone.trim()) {
      setError("Please enter a phone number");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/auth/mfa/setup?method=${method}&phone=${encodeURIComponent(phone)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setStep("verify");
    } catch {
      setError("Failed to send verification code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!code.trim() || code.length < 6) {
      setError("Enter a 6-digit verification code");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setBackupCodes(data.backupCodes);
      setStep("backup");
    } catch {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function finishSetup() {
    // Update the session to reflect MFA is now enabled and verified
    await update({ mfaVerified: true });
    router.push("/dashboard");
    router.refresh();
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBackupCodes() {
    const text = [
      "MyAIDoctor.io — MFA Recovery Codes",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Keep these codes in a safe place. Each code can only be used once.",
      "",
      ...backupCodes.map((c, i) => `${(i + 1).toString().padStart(2, " ")}. ${c}`),
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "myaidoctor-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto shadow-lg shadow-brand-900/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">
            Set Up Multi-Factor Authentication
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            MFA is required for all MyAIDoctor.io accounts to protect patient
            data and maintain HIPAA compliance.
          </p>
        </div>

        {/* Step 1: Choose Method */}
        {step === "choose" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300 text-center">
              Choose your verification method
            </p>

            <button
              onClick={() => initSetup("TOTP")}
              disabled={loading}
              className="card-hover w-full p-5 flex items-start gap-4 text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-900/50 border border-brand-700/30 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-800/50 transition-colors">
                <Smartphone className="w-5 h-5 text-brand-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">
                  Authenticator App
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Use Google Authenticator, Authy, or any TOTP-compatible app.
                  Most secure option.
                </p>
              </div>
              <span className="badge bg-brand-900/50 text-brand-300 mt-1">
                Recommended
              </span>
            </button>

            <button
              onClick={() => initSetup("SMS")}
              disabled={loading}
              className="card-hover w-full p-5 flex items-start gap-4 text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-midnight-800 border border-midnight-700/50 flex items-center justify-center flex-shrink-0 group-hover:bg-midnight-700 transition-colors">
                <Phone className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">SMS Text Message</p>
                <p className="text-xs text-slate-400 mt-1">
                  Receive a verification code via text message to your phone.
                </p>
              </div>
            </button>

            <button
              onClick={() => initSetup("WHATSAPP")}
              disabled={loading}
              className="card-hover w-full p-5 flex items-start gap-4 text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-midnight-800 border border-midnight-700/50 flex items-center justify-center flex-shrink-0 group-hover:bg-midnight-700 transition-colors">
                <MessageSquare className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">WhatsApp</p>
                <p className="text-xs text-slate-400 mt-1">
                  Receive a verification code via WhatsApp message.
                </p>
              </div>
            </button>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400 pt-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing...
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure TOTP */}
        {step === "configure" && method === "TOTP" && (
          <div className="card p-6 space-y-5">
            <button
              onClick={() => { setStep("choose"); setError(""); }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-300">
                <QrCode className="w-4 h-4 text-brand-400" />
                Scan QR Code
              </div>

              {qrCode && (
                <div className="inline-block p-3 bg-white rounded-xl">
                  <img
                    src={qrCode}
                    alt="MFA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              )}

              <p className="text-xs text-slate-400">
                Scan this code with your authenticator app
              </p>
            </div>

            {/* Manual entry key */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">
                Or enter this key manually:
              </p>
              <div className="flex items-center gap-2 p-3 bg-midnight-800 rounded-lg border border-midnight-700">
                <KeyRound className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <code className="flex-1 text-sm font-mono text-brand-300 break-all select-all">
                  {totpSecret}
                </code>
              </div>
            </div>

            {/* Verify code */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">
                Enter the 6-digit code from your app
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
            </div>

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
                "Verify & Enable MFA"
              )}
            </button>
          </div>
        )}

        {/* Step 2: Configure SMS/WhatsApp — enter phone */}
        {step === "configure" && (method === "SMS" || method === "WHATSAPP") && (
          <div className="card p-6 space-y-5">
            <button
              onClick={() => { setStep("choose"); setError(""); }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-slate-300">
                {method === "SMS" ? "Enter your phone number" : "Enter your WhatsApp number"}
              </p>
              <p className="text-xs text-slate-400">
                We&apos;ll send a verification code to confirm this number.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (248) 555-0100"
                className="input-field text-center text-lg"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={sendPhoneOTP}
              disabled={loading || !phone.trim()}
              className="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                `Send verification code via ${method === "SMS" ? "SMS" : "WhatsApp"}`
              )}
            </button>
          </div>
        )}

        {/* Step 3: Verify OTP (SMS/WhatsApp) */}
        {step === "verify" && (
          <div className="card p-6 space-y-5">
            <button
              onClick={() => { setStep("configure"); setError(""); setCode(""); }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-slate-300">
                Enter verification code
              </p>
              <p className="text-xs text-slate-400">
                A 6-digit code was sent to your{" "}
                {method === "SMS" ? "phone" : "WhatsApp"}. It expires in 5 minutes.
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
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
                "Verify & Enable MFA"
              )}
            </button>

            <button
              onClick={sendPhoneOTP}
              disabled={loading}
              className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Didn&apos;t receive a code? Resend
            </button>
          </div>
        )}

        {/* Step 4: Backup codes */}
        {step === "backup" && (
          <div className="space-y-5">
            <div className="card p-6 space-y-5">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-800/40">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-200">
                    Save your recovery codes
                  </p>
                  <p className="text-xs text-amber-400/80 mt-1">
                    These codes are the only way to access your account if you
                    lose your authenticator device. Each code can only be used
                    once. Store them securely.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-midnight-800 rounded-lg border border-midnight-700">
                {backupCodes.map((bcode, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm font-mono"
                  >
                    <span className="text-slate-600 text-xs w-5 text-right">
                      {i + 1}.
                    </span>
                    <span className="text-slate-200">{bcode}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyBackupCodes}
                  className="flex-1 btn-secondary justify-center"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-brand-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy codes
                    </>
                  )}
                </button>
                <button
                  onClick={downloadBackupCodes}
                  className="flex-1 btn-secondary justify-center"
                >
                  <Download className="w-4 h-4" />
                  Download .txt
                </button>
              </div>
            </div>

            <button
              onClick={finishSetup}
              className="w-full btn-primary justify-center py-3 text-base font-semibold"
            >
              I&apos;ve saved my codes — Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
