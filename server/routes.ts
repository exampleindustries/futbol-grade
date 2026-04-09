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

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "racampos@exampleindustries.com";

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
        <a href="https://exampleindustries.github.io/futbol-grade/#/admin"
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
        <a href="https://exampleindustries.github.io/futbol-grade/#/coaches/${coachId}"
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
          if (coach?.email) {
            sendCoachAlert(coach.email, coach.first_name, scores, body.coach_id);
          }
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

  // ── Admin: Reviews ───────────────────────────────────────────

  app.get("/api/admin/reviews", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      const { data, error } = await supabase
        .from("reviews")
        .select("*, coach:coaches(id, first_name, last_name), reviewer:profiles(alias, alias_emoji)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(50);
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

  app.delete("/api/admin/reviews/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("reviews").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Listings ──────────────────────────────────────────

  app.get("/api/admin/listings", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      const { data, error } = await supabase
        .from("listings")
        .select("*, seller:profiles(alias, alias_emoji)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.patch("/api/admin/listings/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { status } = req.body;
      if (!status || !["active", "removed"].includes(status)) {
        return res.status(400).json({ error: "status must be 'active' or 'removed'" });
      }
      const { data, error } = await supabase
        .from("listings")
        .update({ status, approved_at: new Date().toISOString() })
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  app.delete("/api/admin/listings/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase.from("listings").delete().eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  // ── Admin: Stats ─────────────────────────────────────────────

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const [pr, ar, rr, pl, al] = await Promise.all([
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "rejected"),
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return res.json({
        reviews: { pending: pr.count || 0, approved: ar.count || 0, rejected: rr.count || 0 },
        listings: { pending: pl.count || 0, active: al.count || 0 },
      });
    } catch { return res.status(500).json({ error: "Server error" }); }
  });

  return httpServer;
}
