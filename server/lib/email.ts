// server/lib/email.ts

export const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "racampos@exampleindustries.com";

export function buildAlertHtml(
  type: "review" | "listing",
  details: Record<string, string>
) {
  const heading =
    type === "review"
      ? "New Coach Review Submitted"
      : "New Marketplace Listing Submitted";

  const rows = Object.entries(details)
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#1a3c24;white-space:nowrap;vertical-align:top;">${label}</td>
        <td style="padding:8px 12px;color:#374151;">${value}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
      <tr><td style="background:#1a3c24;padding:20px 24px;">
        <span style="color:#4ade80;font-size:20px;font-weight:700;">&#9917; Futbol Grade</span>
      </td></tr>
      <tr><td style="padding:24px;">
        <h2 style="margin:0 0 16px;color:#1a3c24;font-size:18px;">${heading}</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:20px;">
          ${rows}
        </table>
        <a href="https://futbolgrade.com/admin"
           style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
          Review in Admin Panel &#8594;
        </a>
      </td></tr>
      <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <span style="color:#9ca3af;font-size:12px;">Automated alert from Futbol Grade</span>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function buildCoachAlertHtml(
  coachName: string,
  scores: Record<string, number>,
  coachId: string
) {
  const avg =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    Object.values(scores).length;
  const scoreRows = Object.entries(scores)
    .map(
      ([label, val]) => `
      <tr>
        <td style="padding:6px 12px;color:#374151;">${label}</td>
        <td style="padding:6px 12px;font-weight:600;color:#1a3c24;text-align:right;">${val.toFixed(1)} / 5.0</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
      <tr><td style="background:#1a3c24;padding:20px 24px;">
        <span style="color:#4ade80;font-size:20px;font-weight:700;">&#9917; Futbol Grade</span>
      </td></tr>
      <tr><td style="padding:24px;">
        <h2 style="margin:0 0 8px;color:#1a3c24;font-size:18px;">New Review Received</h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.5;">Hi ${coachName}, someone just submitted a review of your coaching. It&#8217;s currently pending moderation&#8202;&#8212;&#8202;once approved it will appear on your profile.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:8px;">
          ${scoreRows}
          <tr><td colspan="2" style="border-top:1px solid #e5e7eb;"></td></tr>
          <tr>
            <td style="padding:8px 12px;font-weight:700;color:#1a3c24;">Overall</td>
            <td style="padding:8px 12px;font-weight:700;color:#16a34a;text-align:right;font-size:16px;">${avg.toFixed(1)} / 5.0</td>
          </tr>
        </table>
        <p style="margin:16px 0 20px;color:#9ca3af;font-size:12px;">Reviewer details are kept confidential.</p>
        <a href="https://futbolgrade.com/coaches/${coachId}"
           style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
          View Your Profile &#8594;
        </a>
      </td></tr>
      <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <span style="color:#9ca3af;font-size:12px;">Automated alert from Futbol Grade</span>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendCoachAlert(
  coachEmail: string,
  coachName: string,
  scores: Record<string, number>,
  coachId: string
) {
  if (!RESEND_API_KEY || !coachEmail) return;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Futbol Grade <onboarding@resend.dev>",
        to: [coachEmail],
        subject: "You received a new review on Futbol Grade",
        html: buildCoachAlertHtml(coachName, scores, coachId),
      }),
    });
    if (!resp.ok) console.error("Coach email alert error:", await resp.text());
  } catch (err) {
    console.error("Coach email alert failed:", err);
  }
}

export function buildClaimApprovalHtml(coachName: string, coachId: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
      <tr><td style="background:#1a3c24;padding:20px 24px;">
        <span style="color:#4ade80;font-size:20px;font-weight:700;">&#9917; Futbol Grade</span>
      </td></tr>
      <tr><td style="padding:24px;">
        <h2 style="margin:0 0 8px;color:#1a3c24;font-size:18px;">Your Profile Is Verified!</h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.5;">Hi ${coachName}, great news &#8212; your claim has been approved and your coaching profile is now verified. Your email is on file and you&#8217;ll receive notifications when players leave reviews.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin-bottom:20px;">
          <tr>
            <td style="padding:12px 16px;text-align:center;">
              <span style="font-size:24px;">&#10003;</span>
              <div style="font-weight:700;color:#16a34a;font-size:14px;margin-top:4px;">VERIFIED COACH</div>
              <div style="color:#6b7280;font-size:12px;margin-top:2px;">Your profile now shows a verified badge</div>
            </td>
          </tr>
        </table>
        <a href="https://futbolgrade.com/coaches/${coachId}"
           style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
          View Your Verified Profile &#8594;
        </a>
      </td></tr>
      <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <span style="color:#9ca3af;font-size:12px;">Automated alert from Futbol Grade</span>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendClaimApprovalEmail(
  coachEmail: string,
  coachName: string,
  coachId: string
) {
  if (!RESEND_API_KEY || !coachEmail) return;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Futbol Grade <onboarding@resend.dev>",
        to: [coachEmail],
        subject: "Your Futbol Grade profile is now verified!",
        html: buildClaimApprovalHtml(coachName, coachId),
      }),
    });
    if (!resp.ok)
      console.error("Claim approval email error:", await resp.text());
  } catch (err) {
    console.error("Claim approval email failed:", err);
  }
}

export async function sendAdminAlert(
  type: "review" | "listing",
  details: Record<string, string>
) {
  if (!RESEND_API_KEY) return;
  const subject =
    type === "review"
      ? "New coach review awaiting moderation"
      : "New listing awaiting moderation";
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Futbol Grade <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject,
        html: buildAlertHtml(type, details),
      }),
    });
    if (!resp.ok) console.error("Email alert error:", await resp.text());
  } catch (err) {
    console.error("Email alert failed:", err);
  }
}
