import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Action categories and their severity levels for HIPAA compliance.
 */
const ACTION_META: Record<string, { category: string; severity: string }> = {
  // Auth
  AUTH_LOGIN:              { category: "authentication", severity: "info" },
  AUTH_LOGIN_FAILED:       { category: "authentication", severity: "warning" },
  AUTH_LOGOUT:             { category: "authentication", severity: "info" },

  // MFA
  MFA_ENABLED:             { category: "mfa", severity: "info" },
  MFA_VERIFIED:            { category: "mfa", severity: "info" },
  MFA_VERIFY_FAILED:       { category: "mfa", severity: "warning" },
  MFA_RESET_INITIATED:     { category: "mfa", severity: "warning" },
  MFA_RESET_COMPLETED:     { category: "mfa", severity: "info" },
  MFA_ADMIN_RESET:         { category: "mfa", severity: "critical" },

  // Password
  PASSWORD_CHANGED:        { category: "password", severity: "info" },
  PASSWORD_RESET_REQUESTED:{ category: "password", severity: "warning" },
  PASSWORD_RESET_COMPLETED:{ category: "password", severity: "info" },
  PASSWORD_ADMIN_RESET:    { category: "password", severity: "critical" },

  // User Management
  USER_REGISTERED:         { category: "user_management", severity: "info" },
  USER_CREATED:            { category: "user_management", severity: "info" },
  USER_UPDATED:            { category: "user_management", severity: "info" },
  USER_APPROVED:           { category: "user_management", severity: "info" },
  USER_REJECTED:           { category: "user_management", severity: "warning" },
  USER_DEACTIVATED:        { category: "user_management", severity: "warning" },
  USER_ACTIVATED:          { category: "user_management", severity: "info" },

  // Roles
  ROLE_CREATED:            { category: "role_management", severity: "info" },
  ROLE_UPDATED:            { category: "role_management", severity: "info" },
  ROLE_DELETED:            { category: "role_management", severity: "warning" },
  ROLE_ASSIGNED:           { category: "role_management", severity: "info" },

  // Organizations
  HOSPITAL_CREATED:        { category: "organization", severity: "info" },
  HOSPITAL_UPDATED:        { category: "organization", severity: "info" },
  CLINIC_CREATED:          { category: "organization", severity: "info" },
  CLINIC_UPDATED:          { category: "organization", severity: "info" },

  // Invitations
  INVITATION_CREATED:      { category: "invitation", severity: "info" },
  INVITATION_USED:         { category: "invitation", severity: "info" },

  // Settings
  SETTINGS_UPDATED:        { category: "settings", severity: "info" },
  BRANDING_UPDATED:        { category: "settings", severity: "info" },

  // Email
  EMAIL_SENT:              { category: "email", severity: "info" },
  EMAIL_FAILED:            { category: "email", severity: "warning" },

  // Voice AI
  VOICE_CALL_INITIATED:    { category: "voice_ai", severity: "info" },
  VOICE_CALL_STARTED:      { category: "voice_ai", severity: "info" },
  VOICE_CALL_COMPLETED:    { category: "voice_ai", severity: "info" },
  VOICE_CALL_FAILED:       { category: "voice_ai", severity: "warning" },
  VOICE_PATIENT_LOOKUP:    { category: "voice_ai", severity: "info" },
  VOICE_RED_FLAG_DETECTED: { category: "voice_ai", severity: "critical" },
  VOICE_AI_SETTINGS_UPDATED: { category: "voice_ai", severity: "info" },

  // Pre-Visit Workflow
  WORKFLOW_CREATED:          { category: "workflow", severity: "info" },
  WORKFLOW_MANUAL_TRIGGER:   { category: "workflow", severity: "info" },
  WORKFLOW_EHR_SYNC:         { category: "workflow", severity: "info" },
  WORKFLOW_SYNTHESIZED:      { category: "workflow", severity: "info" },
  WORKFLOW_AUTO_SCHEDULE:    { category: "workflow", severity: "info" },
  SOAP_GENERATED:            { category: "clinical", severity: "info" },
  PATIENT_INTAKE_SUBMITTED:  { category: "clinical", severity: "info" },

  // AI Agents
  AGENT_CREATED:             { category: "ai_agent", severity: "info" },
  AGENT_STATUS_CHANGED:      { category: "ai_agent", severity: "info" },
  AGENT_DELETED:             { category: "ai_agent", severity: "warning" },

  // Data access (for HIPAA)
  PATIENT_VIEWED:          { category: "data_access", severity: "info" },
  PATIENT_CREATED:         { category: "data_access", severity: "info" },
  PATIENT_UPDATED:         { category: "data_access", severity: "info" },
  RECORD_EXPORTED:         { category: "data_access", severity: "warning" },
};

interface AuditData {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  userEmail?: string | null;
  details?: Record<string, any> | null;
}

/**
 * Log an audit event with full request context.
 * Use this in API routes where you have access to the NextRequest.
 */
export async function audit(req: NextRequest, data: AuditData): Promise<void> {
  const meta = ACTION_META[data.action] || { category: "system", severity: "info" };

  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        category: meta.category,
        entityType: data.entityType,
        entityId: data.entityId,
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        details: (data.details || undefined) as any,
        severity: meta.severity,
        ipAddress: extractIp(req),
        userAgent: req.headers.get("user-agent")?.slice(0, 500) || null,
        method: req.method,
        path: req.nextUrl?.pathname || null,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
    // Never throw — audit failures shouldn't break the app
  }
}

/**
 * Log an audit event without a request context (e.g., from NextAuth callbacks).
 */
export async function auditSimple(data: AuditData): Promise<void> {
  const meta = ACTION_META[data.action] || { category: "system", severity: "info" };

  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        category: meta.category,
        entityType: data.entityType,
        entityId: data.entityId,
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        details: (data.details || undefined) as any,
        severity: meta.severity,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}

function extractIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

/** All known action types for the filter UI */
export const AUDIT_ACTIONS = Object.keys(ACTION_META);
export const AUDIT_CATEGORIES = Array.from(new Set(Object.values(ACTION_META).map((m) => m.category)));
