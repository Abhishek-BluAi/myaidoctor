"use client";

import Link from "next/link";
import { Clock, Mail, ArrowLeft } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">
            Account Pending Approval
          </h1>
          <p className="text-slate-400 leading-relaxed">
            Your account has been created and is awaiting administrator
            approval. You&apos;ll be able to sign in once your account is
            approved.
          </p>
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Mail className="w-4 h-4 text-slate-500" />
            What happens next?
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            An administrator will review your registration. Once approved,
            you can sign in with your email and password, then set up
            multi-factor authentication.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
