import "server-only";
import { SITE_URL } from "@/lib/env";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Branded transactional email (pine band, white logo, Manrope, pine button). */
export function emailHtml({ title, body, cta, href }: { title: string; body: string; cta?: string; href?: string }) {
  const url = href ? (href.startsWith("http") ? href : `${SITE_URL}${href}`) : null;
  return `<!doctype html><html><body style="margin:0;background:#FAFBF8;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;color:#10201B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E3E8E2;border-radius:20px;overflow:hidden">
<tr><td style="background:#0F766E;padding:20px 28px"><img src="${SITE_URL}/brand/elevo-logo-white.svg" alt="Elevo" height="28" style="display:block;height:28px"></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#10201B">${esc(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#34433E">${esc(body)}</p>
${url && cta ? `<a href="${url}" style="display:inline-block;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(cta)}</a>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E3E8E2;font-size:12px;color:#5E6B66">Elevo · Mentoring that grows with you. You can change email preferences in Account.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Sends via Resend. No-ops (returns false) when RESEND_API_KEY isn't configured. */
export async function sendEmail(to: string, subject: string, content: Parameters<typeof emailHtml>[0]): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Elevo <onboarding@resend.dev>", to: [to], subject, html: emailHtml(content) }),
  });
  if (!res.ok) console.error("[elevo] email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}
