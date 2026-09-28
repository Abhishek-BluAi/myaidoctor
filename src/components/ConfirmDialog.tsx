"use client";

import { useState } from "react";
import { AlertTriangle, Lock, Unlock, Loader2, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: "red" | "amber" | "brand";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", confirmColor = "red", onConfirm, onCancel }: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const colors = {
    red: "bg-red-600 hover:bg-red-500",
    amber: "bg-amber-600 hover:bg-amber-500",
    brand: "bg-brand-600 hover:bg-brand-500",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-midnight-900 border border-midnight-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-display font-bold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={onCancel} className="flex-1 btn-secondary justify-center py-2.5">Cancel</button>
          <button onClick={async () => {
            setLoading(true);
            await onConfirm();
            setLoading(false);
          }} disabled={loading}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${colors[confirmColor]}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Settings lock toggle — prevents accidental edits */
export function SettingsLock({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} title={locked ? "Unlock settings to edit" : "Lock settings to prevent changes"}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
        locked
          ? "bg-amber-900/30 border-amber-700/40 text-amber-300 hover:bg-amber-900/50"
          : "bg-midnight-800 border-midnight-600 text-slate-400 hover:text-slate-200"
      }`}>
      {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      {locked ? "Locked" : "Unlocked"}
    </button>
  );
}
