"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Clock,
  Send,
  Check,
  X,
  Copy,
  Loader2,
  Mail,
  Link as LinkIcon,
  Users,
  AlertCircle,
} from "lucide-react";

interface PendingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  specialty: string | null;
  createdAt: string;
  clinic: { name: string } | null;
}

interface Invitation {
  id: string;
  email: string;
  token: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  clinic: { name: string } | null;
}

export default function AdminPage() {
  const [tab, setTab] = useState<"pending" | "invite" | "invitations">(
    "pending"
  );
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("PROVIDER");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    url?: string;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, inviteRes] = await Promise.all([
        fetch("/api/admin/pending-users"),
        fetch("/api/admin/invitations"),
      ]);
      const pendingData = await pendingRes.json();
      const inviteData = await inviteRes.json();
      setPendingUsers(pendingData.pendingUsers || []);
      setInvitations(inviteData.invitations || []);
    } catch {
      console.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleApprove(userId: string, action: "approve" | "reject") {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) {
        setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch {
      console.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteSending(true);
    setInviteResult(null);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInviteResult({ error: data.error });
      } else {
        setInviteResult({ url: data.inviteUrl });
        setInviteEmail("");
        loadData();
      }
    } catch {
      setInviteResult({ error: "Failed to send invitation" });
    } finally {
      setInviteSending(false);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs = [
    {
      id: "pending" as const,
      label: "Pending Approvals",
      icon: Clock,
      count: pendingUsers.length,
    },
    { id: "invite" as const, label: "Send Invitation", icon: UserPlus },
    {
      id: "invitations" as const,
      label: "Invitation History",
      icon: Mail,
      count: invitations.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">
          User Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage registrations, approvals, and invitations
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-midnight-900/80 rounded-lg border border-midnight-700/50 w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-midnight-950 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      ) : (
        <>
          {/* Pending Approvals */}
          {tab === "pending" && (
            <div className="space-y-3">
              {pendingUsers.length === 0 ? (
                <div className="card p-8 text-center">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No pending approvals</p>
                </div>
              ) : (
                pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="card p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-900/50 border border-amber-700/30 flex items-center justify-center text-sm font-bold text-amber-300">
                      {user.firstName[0]}
                      {user.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {user.email} · {user.role}
                        {user.specialty ? ` · ${user.specialty}` : ""}
                        {user.clinic ? ` · ${user.clinic.name}` : ""}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Registered{" "}
                        {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleApprove(user.id, "approve")}
                        disabled={actionLoading === user.id}
                        className="btn-primary py-1.5 px-3 text-xs"
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprove(user.id, "reject")}
                        disabled={actionLoading === user.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 border border-red-700/30 text-red-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Send Invitation */}
          {tab === "invite" && (
            <div className="card p-6 max-w-lg space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-white">
                  Invite a Team Member
                </h2>
                <p className="text-sm text-slate-400">
                  Send an invitation link via email. The link expires in 7 days.
                </p>
              </div>

              <form onSubmit={sendInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@clinic.com"
                    required
                    className="input-field"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="input-field appearance-none"
                  >
                    <option value="PROVIDER">Provider</option>
                    <option value="NURSE">Nurse</option>
                    <option value="FRONT_DESK">Front Desk</option>
                    <option value="BILLING">Billing</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviteSending || !inviteEmail}
                  className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
                >
                  {inviteSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Invitation
                    </>
                  )}
                </button>
              </form>

              {inviteResult?.error && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-950/50 border border-red-800/50">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                  <p className="text-sm text-red-300">{inviteResult.error}</p>
                </div>
              )}

              {inviteResult?.url && (
                <div className="space-y-2 p-4 rounded-lg bg-brand-950/50 border border-brand-800/30">
                  <p className="text-sm font-medium text-brand-300">
                    Invitation created!
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-midnight-800 rounded border border-midnight-700 overflow-x-auto">
                      <code className="text-xs text-slate-300 whitespace-nowrap">
                        {inviteResult.url}
                      </code>
                    </div>
                    <button
                      onClick={() => copyUrl(inviteResult.url!)}
                      className="btn-secondary py-2 px-3"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-brand-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Share this link with the invitee. In production, this would
                    be emailed automatically.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Invitation History */}
          {tab === "invitations" && (
            <div className="space-y-3">
              {invitations.length === 0 ? (
                <div className="card p-8 text-center">
                  <Mail className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">
                    No invitations sent yet
                  </p>
                </div>
              ) : (
                invitations.map((inv) => {
                  const expired = new Date() > new Date(inv.expiresAt);
                  const used = !!inv.usedAt;
                  return (
                    <div
                      key={inv.id}
                      className="card p-4 flex items-center gap-4"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${
                          used
                            ? "bg-brand-900/50 border border-brand-700/30 text-brand-300"
                            : expired
                            ? "bg-slate-800 border border-slate-700 text-slate-500"
                            : "bg-blue-900/50 border border-blue-700/30 text-blue-300"
                        }`}
                      >
                        {used ? (
                          <Check className="w-4 h-4" />
                        ) : expired ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <LinkIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm">
                          {inv.email}
                        </p>
                        <p className="text-xs text-slate-400">
                          {inv.role}
                          {inv.clinic ? ` · ${inv.clinic.name}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`badge text-[11px] ${
                            used
                              ? "bg-brand-900/50 text-brand-300"
                              : expired
                              ? "bg-slate-800 text-slate-500"
                              : "bg-blue-900/50 text-blue-300"
                          }`}
                        >
                          {used
                            ? "Used"
                            : expired
                            ? "Expired"
                            : "Pending"}
                        </span>
                        <p className="text-[11px] text-slate-600 mt-1">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
