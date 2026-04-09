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

function getSupabaseClient(authHeader?: string) {
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    return createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return createClient(supabaseUrl, supabaseKey);
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
