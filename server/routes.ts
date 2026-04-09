import type { Express } from "express";
import { createServer, type Server } from "http";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";

// Rate limiters — keyed by IP
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 reviews per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reviews submitted. Please try again in 15 minutes." },
});

const listingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   // 10 listings per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many listings submitted. Please try again in 15 minutes." },
});

const viewLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 30,                   // 30 view pings per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
});

// Admin bulk action limiter — 10 bulk ops per 15min window
const bulkActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many bulk actions. Please wait 15 minutes." },
});

// Admin delete limiter — 5 delete ops per 15min window (stricter)
const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Delete rate limit reached. Please wait 15 minutes." },
});

// Max items per single bulk delete request
const BULK_DELETE_CAP = 25;

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "racampos@exampleindustries.com";
const CRON_SECRET = process.env.CRON_SECRET || "fg-cron-2026-scan";

function getSupabaseClient(authHeader?: string) {
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    return createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return createClient(supabaseUrl, supabaseKey);
}

// ── Email alert helpers ────────────────────────────────────────

function buildAlertHtml(type: "review" | "listing", details: Record<string, string>) {
  const heading = type === "review"
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

function buildCoachAlertHtml(coachName: string, scores: Record<string, number>, coachId: string) {
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
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

async function sendCoachAlert(
  coachEmail: string,
  coachName: string,
  scores: Record<string, number>,
  coachId: string,
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

function buildClaimApprovalHtml(coachName: string, coachId: string) {
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

async function sendClaimApprovalEmail(coachEmail: string, coachName: string, coachId: string) {
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
    if (!resp.ok) console.error("Claim approval email error:", await resp.text());
  } catch (err) {
    console.error("Claim approval email failed:", err);
  }
}

async function sendAdminAlert(type: "review" | "listing", details: Record<string, string>) {
  if (!RESEND_API_KEY) return;
  const subject = type === "review"
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check for Railway / hosting platforms
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // Dynamic sitemap for SEO
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const base = "https://futbolgrade.com";
      const supabase = getSupabaseClient();
      const [coaches, clubs] = await Promise.all([
        supabase.from("coaches").select("id, updated_at").eq("status", "approved"),
        supabase.from("clubs").select("id, updated_at").eq("status", "approved"),
      ]);

      const staticPages = [
        { loc: "/", priority: "1.0", changefreq: "daily" },
        { loc: "/coaches", priority: "0.9", changefreq: "daily" },
        { loc: "/clubs", priority: "0.9", changefreq: "daily" },
        { loc: "/marketplace", priority: "0.7", changefreq: "weekly" },
      ];

      const urls = staticPages.map(p =>
        `  <url><loc>${base}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
      );

      for (const c of coaches.data || []) {
        const lastmod = c.updated_at ? `<lastmod>${c.updated_at.split("T")[0]}</lastmod>` : "";
        urls.push(`  <url><loc>${base}/coaches/${c.id}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
      }
      for (const c of clubs.data || []) {
        const lastmod = c.updated_at ? `<lastmod>${c.updated_at.split("T")[0]}</lastmod>` : "";
        urls.push(`  <url><loc>${base}/clubs/${c.id}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch {
      res.status(500).send("Error generating sitemap");
    }
  });

  // robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(`User-agent: *\nAllow: /\n\nSitemap: https://futbolgrade.com/sitemap.xml\n`);
  });

  // Submit a review (requires auth)
  app.post("/api/reviews", reviewLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const supabase = getSupabaseClient(authHeader);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const body = req.body;
      const review = {
        coach_id: body.coach_id,
        reviewer_id: user.id,
        is_anonymous: body.is_anonymous ?? true,
        display_name: body.display_name || null,
        player_position: body.player_position || null,
        years_with_coach: body.years_with_coach || null,
        score_technical: body.score_technical,
        score_team_building: body.score_team_building,
        score_development: body.score_development,
        score_approachability: body.score_approachability,
        score_professionalism: body.score_professionalism,
        score_dedication: body.score_dedication,
        pros: body.pros || [],
        cons: body.cons || [],
        body: body.body || null,
        status: "pending",
      };

      // Validate scores
      const scoreKeys = [
        "score_technical",
        "score_team_building",
        "score_development",
        "score_approachability",
        "score_professionalism",
        "score_dedication",
      ];
      for (const key of scoreKeys) {
        const val = (review as any)[key];
        if (!val || val < 1 || val > 5) {
          return res.status(400).json({ error: `Invalid ${key}: must be 1-5` });
        }
      }

      const { data, error } = await supabase
        .from("reviews")
        .insert(review)
        .select()
        .single();

      if (error) {
        console.error("Review insert error:", error);
        return res.status(400).json({ error: error.message });
      }

      // Fire-and-forget email alerts (admin + coach)
      const scores = {
        Technical: body.score_technical,
        "Team Building": body.score_team_building,
        Development: body.score_development,
        Approachability: body.score_approachability,
        Professionalism: body.score_professionalism,
        Dedication: body.score_dedication,
      };
      const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 6;
      supabase
        .from("coaches")
        .select("first_name, last_name, email")
        .eq("id", body.coach_id)
        .single()
        .then(({ data: coach }) => {
          const name = coach ? `${coach.first_name} ${coach.last_name}` : `Coach #${body.coach_id}`;
          sendAdminAlert("review", {
            Coach: name,
            "Avg Score": `${avgScore.toFixed(1)} / 5.0`,
            Excerpt: (body.body || "No written review").substring(0, 120),
          });
          // Coach email alerts disabled for now
          // if (coach?.email) {
          //   sendCoachAlert(coach.email, coach.first_name, scores, body.coach_id);
          // }
        })
        .catch(() => {});

      return res.json(data);
    } catch (err: any) {
      console.error("Review error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Submit a listing (requires auth)
  app.post("/api/listings", listingLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const supabase = getSupabaseClient(authHeader);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const body = req.body;
      const listing = {
        seller_id: user.id,
        type: body.type || "other",
        title: body.title,
        description: body.description || null,
        price_cents: body.price_cents || null,
        price_text: body.price_text || "Free",
        image_urls: body.image_urls || [],
        status: "pending",
      };

      const { data, error } = await supabase
        .from("listings")
        .insert(listing)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Fire-and-forget admin email alert
      sendAdminAlert("listing", {
        Title: listing.title,
        Type: listing.type,
        Price: listing.price_text,
      }).catch(() => {});

      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Increment view count
  app.post("/api/listings/:id/view", viewLimiter, async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      await supabase.rpc("increment_view_count", {
        listing_id: req.params.id,
      });
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true });
    }
  });

  // ── Admin helpers ────────────────────────────────────────────

  async function requireAdmin(req: any, res: any): Promise<ReturnType<typeof getSupabaseClient> | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: "Not authenticated" }); return null; }
    const supabase = getSupabaseClient(authHeader);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return null; }
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) { res.status(403).json({ error: "Forbidden" }); return null; }
    return supabase;
  }

  async function logAudit(
    supabase: ReturnType<typeof getSupabaseClient>,
    action: string,
    entityType: string,
    entityIds: string[],
    details?: Record<string, any>
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("admin_audit_log").insert({
        admin_id: user?.id || null,
        admin_email: user?.email || null,
        action,
        entity_type: entityType,
        entity_ids: entityIds,
        entity_count: entityIds.length,
        details: details || {},
      });
    } catch (err) {
      console.error("[AUDIT] Failed to log:", err);
    }
  }

  // ── Admin: Reviews ───────────────────────────────────────────

  app.get("/api/admin/reviews", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      let query = supabase
        .from("reviews")
        .select("*, coach:coaches(id, first_name, last_name), reviewer:profiles(alias, alias_emoji)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/reviews/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { status } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
      }
      const { data, error } = await supabase
        .from("reviews")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.delete("/api/admin/reviews/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("reviews").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
      await logAudit(supabase, "delete", "review", [req.params.id]);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Listings ──────────────────────────────────────────

  app.get("/api/admin/listings", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      let query = supabase
        .from("listings")
        .select("*, seller:profiles(alias, alias_emoji)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/listings/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = ["status", "title", "description", "price_cents", "price_text", "type", "featured"];
      const updates: Record<string, any> = {};
      for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
      if (updates.status) updates.approved_at = new Date().toISOString();
      if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields" });
      const { data, error } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.delete("/api/admin/listings/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("listings").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
      await logAudit(supabase, "delete", "listing", [req.params.id]);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.post("/api/admin/listings/bulk", bulkActionLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { ids, status } = req.body;
      if (!ids?.length || !status) return res.status(400).json({ error: "ids array and status required" });
      if (status === "delete") {
        if (ids.length > BULK_DELETE_CAP) return res.status(400).json({ error: `Cannot delete more than ${BULK_DELETE_CAP} items at once` });
        const { error } = await supabase.from("listings").delete().in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      } else {
        const { error } = await supabase.from("listings").update({ status, approved_at: new Date().toISOString() }).in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      }
      return res.json({ ok: true });
      await logAudit(supabase, status === "delete" ? "bulk_delete" : "bulk_status_change", "listing", ids, { new_status: status });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Coach Claims ────────────────────────────────────────────

  const claimLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many claim requests. Please try again later." },
  });

  app.post("/api/claims", claimLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Not authenticated" });
      const supabase = getSupabaseClient(authHeader);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { coach_id, email, phone, license_number, verification_note } = req.body;
      if (!coach_id || !email) return res.status(400).json({ error: "coach_id and email are required" });

      // Check coach exists and isn't already claimed
      const { data: coach } = await supabase.from("coaches").select("id, user_id, first_name, last_name").eq("id", coach_id).single();
      if (!coach) return res.status(404).json({ error: "Coach not found" });
      if (coach.user_id) return res.status(409).json({ error: "This profile has already been claimed" });

      const { data, error } = await supabase
        .from("coach_claims")
        .insert({ coach_id, user_id: user.id, email, phone: phone || null, license_number: license_number || null, verification_note: verification_note || null })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") return res.status(409).json({ error: "A pending claim already exists for this coach" });
        return res.status(400).json({ error: error.message });
      }

      // Fire-and-forget admin email alert
      sendAdminAlert("review", {
        Type: "Coach Claim",
        Coach: `${coach.first_name} ${coach.last_name}`,
        Email: email,
        License: license_number || "Not provided",
      }).catch(() => {});

      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // Check if user already has a pending/approved claim for a coach
  app.get("/api/claims/mine", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Not authenticated" });
      const supabase = getSupabaseClient(authHeader);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { data } = await supabase
        .from("coach_claims")
        .select("id, coach_id, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return res.json(data || []);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Coach Imports ─────────────────────────────────

  app.get("/api/admin/coaches", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      let query = supabase
        .from("coaches")
        .select("*, club:clubs(id, name, city)")
        .order("last_name", { ascending: true })
        .limit(300);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/coaches/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = ["status", "first_name", "last_name", "city", "state", "club_id", "gender", "age_groups", "license", "email", "specialization"];
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (updates.status && !["approved", "rejected", "pending"].includes(updates.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase.from("coaches").update(updates).eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.post("/api/admin/coaches/bulk", bulkActionLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { ids, status } = req.body;
      if (!ids?.length || !status) return res.status(400).json({ error: "ids array and status required" });
      if (status === "delete") {
        if (ids.length > BULK_DELETE_CAP) return res.status(400).json({ error: `Cannot delete more than ${BULK_DELETE_CAP} items at once` });
        const { error } = await supabase.from("coaches").delete().in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      } else {
        const { error } = await supabase.from("coaches").update({ status }).in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      }
      return res.json({ ok: true });
      await logAudit(supabase, status === "delete" ? "bulk_delete" : "bulk_status_change", "coach", ids, { new_status: status });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.delete("/api/admin/coaches/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("coaches").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
      await logAudit(supabase, "delete", "coach", [req.params.id]);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Claims ───────────────────────────────────────────

  app.get("/api/admin/claims", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      const { data, error } = await supabase
        .from("coach_claims")
        .select("*, coach:coaches(id, first_name, last_name), claimant:profiles(alias, alias_emoji)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/claims/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { status } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
      }

      // Fetch the claim with coach details
      const { data: claim } = await supabase
        .from("coach_claims")
        .select("*, coach:coaches(first_name, last_name)")
        .eq("id", req.params.id)
        .single();
      if (!claim) return res.status(404).json({ error: "Claim not found" });

      // Update claim status
      const { error: claimError } = await supabase
        .from("coach_claims")
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", req.params.id);
      if (claimError) return res.status(400).json({ error: claimError.message });

      // If approved, link the coach to the user and update email
      if (status === "approved") {
        await supabase
          .from("coaches")
          .update({ user_id: claim.user_id, email: claim.email })
          .eq("id", claim.coach_id);

        // Coach approval email disabled for now
        // const coachName = claim.coach ? `${claim.coach.first_name}` : "Coach";
        // sendClaimApprovalEmail(claim.email, coachName, claim.coach_id).catch(() => {});
      }

      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.delete("/api/admin/claims/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("coach_claims").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "claim", [req.params.id]);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Clubs ──────────────────────────────────────

  app.get("/api/admin/clubs", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { data: clubs, error } = await supabase
        .from("clubs")
        .select("id, name, abbr, city, state, region, logo_url, website, contact_email, status, coach_count, avg_overall")
        .order("name");
      if (error) return res.status(400).json({ error: error.message });

      // Fetch coaches grouped by club for the associated coaches list
      const { data: coaches } = await supabase
        .from("coaches")
        .select("id, first_name, last_name, club_id, status")
        .order("last_name");
      const coachMap = new Map<string, any[]>();
      (coaches || []).forEach((c: any) => {
        if (!c.club_id) return;
        if (!coachMap.has(c.club_id)) coachMap.set(c.club_id, []);
        coachMap.get(c.club_id)!.push(c);
      });

      const result = (clubs || []).map((c: any) => ({ ...c, coaches: coachMap.get(c.id) || [] }));
      return res.json(result);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/clubs/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = ["name", "abbr", "city", "state", "logo_url", "status", "website", "contact_email", "region"];
      const updates: Record<string, any> = {};
      for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
      if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase.from("clubs").update(updates).eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.post("/api/admin/clubs/bulk", bulkActionLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { ids, status } = req.body;
      if (!ids?.length || !status) return res.status(400).json({ error: "ids array and status required" });
      const { error } = await supabase.from("clubs").update({ status }).in("id", ids);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "bulk_status_change", "club", ids, { new_status: status });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Users ───────────────────────────────────────

  app.get("/api/admin/users", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const search = (req.query.search as string) || "";
      let query = supabase
        .from("profiles")
        .select("id, alias, alias_emoji, is_admin, is_banned, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search) query = query.or(`alias.ilike.%${search}%`);
      const { data: profiles, error } = await query;
      if (error) return res.status(400).json({ error: error.message });

      // Get emails from auth.users and activity counts
      const ids = (profiles || []).map((p: any) => p.id);
      if (!ids.length) return res.json([]);

      const [emailsRes, reviewCounts, listingCounts] = await Promise.all([
        supabase.rpc("get_user_emails", { user_ids: ids }),
        supabase.from("reviews").select("user_id").in("user_id", ids),
        supabase.from("listings").select("user_id").in("user_id", ids),
      ]);

      const emailMap = new Map((emailsRes.data || []).map((e: any) => [e.id, e.email]));
      const reviewMap = new Map<string, number>();
      (reviewCounts.data || []).forEach((r: any) => reviewMap.set(r.user_id, (reviewMap.get(r.user_id) || 0) + 1));
      const listingMap = new Map<string, number>();
      (listingCounts.data || []).forEach((l: any) => listingMap.set(l.user_id, (listingMap.get(l.user_id) || 0) + 1));

      const users = (profiles || []).map((p: any) => ({
        ...p,
        email: emailMap.get(p.id) || null,
        review_count: reviewMap.get(p.id) || 0,
        listing_count: listingMap.get(p.id) || 0,
      }));

      return res.json(users);
    } catch (err: any) { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const updates: Record<string, any> = {};
      if (typeof req.body.is_admin === "boolean") updates.is_admin = req.body.is_admin;
      if (typeof req.body.is_banned === "boolean") updates.is_banned = req.body.is_banned;
      if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase.from("profiles").update(updates).eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Nearby clubs (public, geo-search) ─────────────────

  app.get("/api/clubs/nearby", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = Math.min(parseFloat(req.query.radius as string) || 25, 100); // miles, max 100
      if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: "lat and lng required" });

      const supabase = getSupabaseClient();
      const { data: clubs, error } = await supabase
        .from("clubs")
        .select("id, name, city, state, logo_url, lat, lng, avg_overall, coach_count")
        .eq("status", "approved")
        .not("lat", "is", null);
      if (error) return res.status(400).json({ error: error.message });

      // Haversine distance in miles
      function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 3959;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      const nearby = (clubs || [])
        .map((c: any) => ({ ...c, distance: Math.round(haversine(lat, lng, c.lat, c.lng) * 10) / 10 }))
        .filter((c: any) => c.distance <= radius)
        .sort((a: any, b: any) => a.name.localeCompare(b.name)); // alphabetical

      return res.json(nearby);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Events (public) ─────────────────────────────────────────

  app.get("/api/events", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("events")
        .select("*, club:clubs(id, name, logo_url)")
        .eq("status", "approved")
        .gte("event_date", new Date().toISOString().split("T")[0])
        .order("event_date", { ascending: true })
        .limit(50);
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // Submit event flyer (authenticated users)
  app.post("/api/events", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Not authenticated" });
      const supabase = getSupabaseClient(authHeader);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { title, description, flyer_url, event_date, end_date, club_id } = req.body;
      if (!title || !event_date) return res.status(400).json({ error: "Title and event date are required" });

      const { data, error } = await supabase.from("events").insert({
        title,
        description: description || null,
        flyer_url: flyer_url || null,
        event_date,
        end_date: end_date || null,
        club_id: club_id || null,
        source: "user_upload",
        status: "pending",
        submitted_by: user.id,
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });

      // Send admin alert
      sendAdminAlert("listing", {
        "Type": "Event Flyer Submission",
        "Title": title,
        "Event Date": event_date,
        "Description": description || "(none)",
      });

      return res.status(201).json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Events ───────────────────────────────────────────

  app.get("/api/admin/events", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      const { data, error } = await supabase
        .from("events")
        .select("*, club:clubs(id, name)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/events/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      const updates: Record<string, any> = {};
      if (req.body.status) {
        updates.status = req.body.status;
        if (req.body.status === "approved") {
          updates.approved_by = user?.id;
          updates.approved_at = new Date().toISOString();
        }
      }
      if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase.from("events").update(updates).eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.delete("/api/admin/events/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("events").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "event", [req.params.id]);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Shared crawl logic ───────────────────────────────────

  async function scanClubWebsitesForEvents(submittedBy?: string): Promise<{ found: number; scanned: number; logos: number }> {
    const supabase = getSupabaseClient();
    const { data: clubs } = await supabase
      .from("clubs")
      .select("id, name, website, logo_url")
      .not("website", "is", null)
      .eq("status", "approved");

    if (!clubs || clubs.length === 0) return { found: 0, scanned: 0, logos: 0 };

    const eventKeywords = /camp|clinic|tournament|tryout|training|showcase|league|cup|classic|festival|jamboree|combine|registration|sign[- ]?up|open\s+house/i;
    const pathSuffixes = ["", "/events", "/camps", "/tournaments", "/programs", "/news", "/tryouts", "/schedule", "/calendar", "/clinics", "/registration"];
    let found = 0;
    let logos = 0;

    for (const club of clubs) {
      if (!club.website) continue;
      const base = club.website.replace(/\/$/, "");

      // Auto-discover logo from homepage if club has no logo
      if (!club.logo_url) {
        try {
          const homeResp = await fetch(base, {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "FutbolGrade-EventScanner/1.0" },
            redirect: "follow",
          });
          if (homeResp.ok) {
            const homeHtml = await homeResp.text();
            let logoUrl: string | null = null;

            // Priority 1: og:image
            const ogMatch = homeHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
              || homeHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            if (ogMatch) logoUrl = ogMatch[1];

            // Priority 2: <link rel="icon"> or apple-touch-icon (higher res)
            if (!logoUrl) {
              const iconMatch = homeHtml.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)
                || homeHtml.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
              if (iconMatch) logoUrl = iconMatch[1];
            }

            // Priority 3: img with "logo" in src or class or alt
            if (!logoUrl) {
              const logoImgMatch = homeHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*(?:class|alt|id)=["'][^"']*logo[^"']*["']/i)
                || homeHtml.match(/<img[^>]*(?:class|alt|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i);
              if (logoImgMatch) logoUrl = logoImgMatch[1] || logoImgMatch[2];
            }

            if (logoUrl) {
              // Make absolute URL
              if (!logoUrl.startsWith("http")) logoUrl = new URL(logoUrl, base).href;
              // Upload to Supabase storage
              try {
                const imgResp = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
                if (imgResp.ok) {
                  const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
                  const ext = logoUrl.match(/\.(png|jpg|jpeg|webp|svg)/i)?.[1] || "png";
                  const storagePath = `${club.id}.${ext}`;
                  await supabase.storage.from("club-logos").upload(storagePath, imgBuffer, { upsert: true, contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
                  const { data: urlData } = supabase.storage.from("club-logos").getPublicUrl(storagePath);
                  const finalUrl = urlData.publicUrl + "?v=" + Date.now();
                  await supabase.from("clubs").update({ logo_url: finalUrl }).eq("id", club.id);
                  logos++;
                  console.log(`[CRAWL] Logo found for ${club.name}: ${logoUrl}`);
                }
              } catch { /* skip logo download errors */ }
            }
          }
        } catch { /* skip homepage errors */ }
      }

      try {
        for (const suffix of pathSuffixes) {
          const url = base + suffix;
          try {
            const resp = await fetch(url, {
              signal: AbortSignal.timeout(10000),
              headers: { "User-Agent": "FutbolGrade-EventScanner/1.0" },
              redirect: "follow",
            });
            if (!resp.ok) continue;
            const ct = resp.headers.get("content-type") || "";
            if (!ct.includes("text/html")) continue;
            const html = await resp.text();

            // Skip if already scanned this URL
            const { data: existing } = await supabase
              .from("events")
              .select("id")
              .eq("source_url", url)
              .limit(1);
            if (existing && existing.length > 0) continue;

            if (!eventKeywords.test(html)) continue;

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            let pageTitle = (h1Match?.[1]?.trim() || titleMatch?.[1]?.trim() || "Event").replace(/\s+/g, " ");
            if (pageTitle.length > 120) pageTitle = pageTitle.slice(0, 120);

            // Extract future dates
            const datePatterns = [
              /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
              /\d{1,2}\/\d{1,2}\/\d{4}/g,
              /\d{4}-\d{2}-\d{2}/g,
            ];
            let eventDate: string | null = null;
            for (const pat of datePatterns) {
              const matches = html.match(pat);
              if (matches) {
                for (const m of matches) {
                  const d = new Date(m);
                  if (!isNaN(d.getTime()) && d > new Date()) {
                    eventDate = d.toISOString().split("T")[0];
                    break;
                  }
                }
                if (eventDate) break;
              }
            }

            // Look for flyer images
            const imgPattern = /(?:src|href)=["']([^"']+\.(?:jpg|jpeg|png|webp|gif|pdf))["']/gi;
            let flyerUrl: string | null = null;
            let imgMatch;
            while ((imgMatch = imgPattern.exec(html)) !== null) {
              const imgUrl = imgMatch[1];
              if (eventKeywords.test(imgUrl) || /flyer|poster|banner/i.test(imgUrl)) {
                flyerUrl = imgUrl.startsWith("http") ? imgUrl : new URL(imgUrl, url).href;
                break;
              }
            }

            // Only insert if future date found or title matches event keywords
            if (eventDate || eventKeywords.test(pageTitle)) {
              await supabase.from("events").insert({
                title: pageTitle,
                description: `Auto-discovered from ${club.name} website`,
                flyer_url: flyerUrl,
                event_date: eventDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                club_id: club.id,
                source: "club_crawl",
                status: "pending",
                submitted_by: submittedBy || null,
                source_url: url,
              });
              found++;
            }
          } catch { /* skip URL */ }
        }
      } catch { /* skip club */ }
    }

    // Also auto-expire past events
    await supabase.from("events")
      .update({ status: "expired" })
      .eq("status", "approved")
      .lt("event_date", new Date().toISOString().split("T")[0]);

    return { found, scanned: clubs.length, logos };
  }

  // ── Admin: Manual crawl trigger ───────────────────────

  app.post("/api/admin/events/crawl", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      const result = await scanClubWebsitesForEvents(user?.id);
      return res.json({ ...result, message: `Scanned ${result.scanned} clubs: ${result.found} events found, ${result.logos} logos discovered` });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Cron: Scheduled event scan (called by external scheduler) ──

  app.post("/api/cron/scan-events", async (req, res) => {
    try {
      const secret = req.headers["x-cron-secret"] || req.query.secret;
      if (secret !== CRON_SECRET) {
        return res.status(401).json({ error: "Invalid cron secret" });
      }
      console.log(`[CRON] Event scan started at ${new Date().toISOString()}`);
      const result = await scanClubWebsitesForEvents();
      console.log(`[CRON] Event scan complete: scanned=${result.scanned}, found=${result.found}`);

      // Notify admin if new events found
      if (result.found > 0 && RESEND_API_KEY) {
        sendAdminAlert("listing", {
          "Type": "Scheduled Event Scan",
          "Events Found": String(result.found),
          "Clubs Scanned": String(result.scanned),
          "Note": "New events are pending your approval in the Events tab",
        });
      }

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[CRON] Event scan failed:", err);
      return res.status(500).json({ error: "Scan failed" });
    }
  });

  // ── Admin: Stats ─────────────────────────────────────────────

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const [pr, ar, rr, pl, al, pc, pci] = await Promise.all([
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "rejected"),
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("coach_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("coaches").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const pe = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending");
      return res.json({
        reviews: { pending: pr.count || 0, approved: ar.count || 0, rejected: rr.count || 0 },
        listings: { pending: pl.count || 0, active: al.count || 0 },
        claims: { pending: pc.count || 0 },
        imports: { pending: pci.count || 0 },
        events: { pending: pe.count || 0 },
      });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Audit Log ───────────────────────────────────

  app.get("/api/admin/audit-log", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const entityType = req.query.entity_type as string;
      const action = req.query.action as string;

      let query = supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (entityType) query = query.eq("entity_type", entityType);
      if (action) query = query.eq("action", action);

      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Public: Sponsors (location-based) ─────────────────────

  app.get("/api/sponsors", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);

      // Always fetch active, non-expired sponsors
      let query = supabase
        .from("sponsors")
        .select("id, name, logo_url, website, description, city, state, is_main_sponsor, lat, lng, radius_miles")
        .eq("is_active", true)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

      const { data, error } = await query;
      if (error) return res.status(400).json({ error: error.message });

      let sponsors = data || [];

      // If user has location, filter by distance (keep main sponsors regardless)
      if (!isNaN(lat) && !isNaN(lng)) {
        sponsors = sponsors.filter(s => {
          if (s.is_main_sponsor) return true; // main sponsors always show
          if (!s.lat || !s.lng) return false;
          const R = 3958.8;
          const dLat = (s.lat - lat) * Math.PI / 180;
          const dLon = (s.lng - lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(s.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return dist <= (s.radius_miles || 25);
        });
      }

      // Sort: main sponsors first, then by name
      sponsors.sort((a, b) => {
        if (a.is_main_sponsor && !b.is_main_sponsor) return -1;
        if (!a.is_main_sponsor && b.is_main_sponsor) return 1;
        return a.name.localeCompare(b.name);
      });

      return res.json(sponsors);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Sponsors CRUD ──────────────────────────────────

  app.get("/api/admin/sponsors", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { data, error } = await supabase
        .from("sponsors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.post("/api/admin/sponsors", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = ["name", "logo_url", "website", "description", "city", "state", "region", "lat", "lng", "radius_miles", "is_active", "is_main_sponsor", "expires_at", "total_spent", "contact_name", "contact_email"];
      const fields: any = {};
      for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
      const { data, error } = await supabase.from("sponsors").insert(fields).select().single();
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "create", "sponsor", [data.id]);
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/sponsors/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = ["name", "logo_url", "website", "description", "city", "state", "region", "lat", "lng", "radius_miles", "is_active", "is_main_sponsor", "expires_at", "total_spent", "contact_name", "contact_email"];
      const fields: any = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
      const { data, error } = await supabase.from("sponsors").update(fields).eq("id", req.params.id).select().single();
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "update", "sponsor", [req.params.id]);
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.delete("/api/admin/sponsors/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("sponsors").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "sponsor", [req.params.id]);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  return httpServer;
}
