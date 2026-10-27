// Generates the branded Supabase auth email templates into supabase/templates/.
// Paste each into Supabase → Authentication → Emails → Templates (see DEPLOY.md).
import { writeFileSync } from "node:fs";

const shell = (title, body, cta, href) => `<!doctype html>
<html><body style="margin:0;background:#FAFBF8;font-family:Manrope,'Segoe UI',Helvetica,Arial,sans-serif;color:#10201B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E3E8E2;border-radius:20px;overflow:hidden">
<tr><td style="background:#0F766E;padding:20px 28px"><img src="{{ .SiteURL }}/brand/elevo-logo-white.svg" alt="Elevo" height="28" style="display:block;height:28px"></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#10201B">${title}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#34433E">${body}</p>
<a href="${href}" style="display:inline-block;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${cta}</a>
<p style="margin:22px 0 0;font-size:13px;line-height:20px;color:#5E6B66">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${href}</span></p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E3E8E2;font-size:12px;color:#5E6B66">Elevo · Mentoring that grows with you. If you didn't expect this email, you can ignore it.</td></tr>
</table></td></tr></table></body></html>
`;

const T = {
  invite: {
    subject: "You're invited to Elevo",
    html: shell("Welcome to Elevo", "Your HOD has invited you to Elevo, your department's mentoring space. Set a password to activate your account — setup takes about five minutes.", "Accept invite", "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/accept-invite"),
  },
  recovery: {
    subject: "Reset your Elevo password",
    html: shell("Reset your password", "Someone (hopefully you) asked to reset the password for this Elevo account. The link works once and expires in an hour.", "Choose a new password", "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"),
  },
  magic_link: {
    subject: "Your Elevo sign-in link",
    html: shell("Sign in to Elevo", "Use this one-time link to sign in. It expires shortly.", "Sign in", "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/login"),
  },
};

for (const [k, v] of Object.entries(T)) writeFileSync(`supabase/templates/${k}.html`, v.html);
writeFileSync("supabase/templates/SUBJECTS.md", `# Email template subjects\n\n| Template | Subject |\n|---|---|\n${Object.entries(T).map(([k, v]) => `| ${k} | ${v.subject} |`).join("\n")}\n`);
console.log("templates written");
