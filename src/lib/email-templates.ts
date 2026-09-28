/**
 * Branded HTML email templates for MyAIDoctor.io
 */

function baseLayout(content: string, preheader: string = ""): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#0a0a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.container{max-width:560px;margin:0 auto;padding:40px 20px}
.card{background:#141427;border:1px solid #1e1e3a;border-radius:12px;padding:32px;color:#e2e8f0}
.logo{text-align:center;margin-bottom:24px}
.logo span{font-size:20px;font-weight:700;color:#fff}
.logo .accent{color:#10b981}
h1{color:#fff;font-size:22px;margin:0 0 8px}
p{color:#94a3b8;font-size:14px;line-height:1.6;margin:8px 0}
.btn{display:inline-block;padding:12px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin:16px 0}
.code-box{background:#0a0a1a;border:1px solid #1e1e3a;border-radius:8px;padding:16px;text-align:center;margin:16px 0}
.code{font-size:32px;font-weight:700;letter-spacing:8px;color:#10b981;font-family:monospace}
.footer{text-align:center;margin-top:24px;color:#475569;font-size:12px}
.divider{border:none;border-top:1px solid #1e1e3a;margin:24px 0}
</style></head>
<body><div style="display:none">${preheader}</div>
<div class="container"><div class="card">
<div class="logo"><span>MyAI<span class="accent">Doctor</span></span><span style="font-size:10px;color:#10b981;font-family:monospace">.io</span></div>
${content}
</div>
<div class="footer">
<p>This is an automated message from MyAIDoctor.io</p>
<p>If you didn't request this, you can safely ignore this email.</p>
</div></div></body></html>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Welcome to MyAIDoctor.io",
    html: baseLayout(`
      <h1>Welcome, ${name}!</h1>
      <p>Your MyAIDoctor.io account has been created successfully.</p>
      <p>You can now sign in and start using the platform for AI-powered clinical operations.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" class="btn">Sign In to Your Account</a>
      <hr class="divider">
      <p style="font-size:12px">If you didn't create this account, please contact your administrator.</p>
    `, "Your MyAIDoctor.io account is ready"),
  };
}

export function invitationEmail(email: string, inviteUrl: string, role: string): { subject: string; html: string } {
  return {
    subject: "You're Invited to MyAIDoctor.io",
    html: baseLayout(`
      <h1>You've Been Invited</h1>
      <p>You've been invited to join MyAIDoctor.io as a <strong style="color:#fff">${role.replace(/_/g, " ")}</strong>.</p>
      <p>Click below to create your account and get started:</p>
      <a href="${inviteUrl}" class="btn">Accept Invitation</a>
      <hr class="divider">
      <p style="font-size:12px">This invitation expires in 7 days. If you weren't expecting this, you can ignore it.</p>
    `, "You've been invited to MyAIDoctor.io"),
  };
}

export function passwordResetEmail(name: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Reset Your Password — MyAIDoctor.io",
    html: baseLayout(`
      <h1>Password Reset</h1>
      <p>Hi ${name}, we received a request to reset your password.</p>
      <p>Click the button below to set a new password:</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <hr class="divider">
      <p style="font-size:12px">This link expires in 1 hour. If you didn't request a password reset, your account is still secure — no action needed.</p>
    `, "Reset your MyAIDoctor.io password"),
  };
}

export function otpEmail(name: string, code: string, purpose: string): { subject: string; html: string } {
  return {
    subject: `Your Verification Code — MyAIDoctor.io`,
    html: baseLayout(`
      <h1>Verification Code</h1>
      <p>Hi ${name}, here's your verification code for ${purpose}:</p>
      <div class="code-box"><div class="code">${code}</div></div>
      <p>This code expires in <strong style="color:#fff">5 minutes</strong>. Do not share it with anyone.</p>
      <hr class="divider">
      <p style="font-size:12px">If you didn't request this code, please change your password immediately.</p>
    `, `Your code: ${code}`),
  };
}

export function accountApprovedEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Your Account Has Been Approved — MyAIDoctor.io",
    html: baseLayout(`
      <h1>Account Approved!</h1>
      <p>Great news, ${name}! Your MyAIDoctor.io account has been approved by an administrator.</p>
      <p>You can now sign in and start using the platform:</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" class="btn">Sign In Now</a>
    `, "Your MyAIDoctor.io account has been approved"),
  };
}

export function mfaResetNotificationEmail(name: string): { subject: string; html: string } {
  return {
    subject: "MFA Has Been Reset — MyAIDoctor.io",
    html: baseLayout(`
      <h1>MFA Reset Notice</h1>
      <p>Hi ${name}, your multi-factor authentication has been reset by an administrator.</p>
      <p>You will need to set up MFA again on your next login.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" class="btn">Sign In & Set Up MFA</a>
      <hr class="divider">
      <p style="font-size:12px">If you didn't expect this, contact your administrator immediately.</p>
    `, "Your MFA has been reset"),
  };
}

export function passwordChangedNotificationEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Password Changed — MyAIDoctor.io",
    html: baseLayout(`
      <h1>Password Changed</h1>
      <p>Hi ${name}, your password has been changed successfully.</p>
      <p>If you made this change, no further action is needed.</p>
      <hr class="divider">
      <p style="font-size:12px">If you didn't change your password, reset it immediately and contact your administrator.</p>
    `, "Your password has been changed"),
  };
}

export function testEmail(): { subject: string; html: string } {
  return {
    subject: "SMTP Test — MyAIDoctor.io",
    html: baseLayout(`
      <h1>SMTP Test Successful</h1>
      <p>If you're reading this, your email configuration is working correctly.</p>
      <p>Timestamp: <strong style="color:#fff">${new Date().toISOString()}</strong></p>
    `, "SMTP test email"),
  };
}
