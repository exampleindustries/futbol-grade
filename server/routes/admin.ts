// server/routes/admin.ts
import type { Express } from "express";
import { requireAdmin } from "../lib/supabase";

export function registerAdminRoutes(app: Express) {
  // Admin: dashboard stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const [pr, ar, rr, pl, al, pc, pci] = await Promise.all([
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved"),
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", "rejected"),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("coach_claims")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("coaches")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      const pe = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return res.json({
        reviews: {
          pending: pr.count || 0,
          approved: ar.count || 0,
          rejected: rr.count || 0,
        },
        listings: { pending: pl.count || 0, active: al.count || 0 },
        claims: { pending: pc.count || 0 },
        imports: { pending: pci.count || 0 },
        events: { pending: pe.count || 0 },
      });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: audit log
  app.get("/api/admin/audit-log", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const limit = Math.min(
        parseInt(req.query.limit as string) || 50,
        200
      );
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
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: list users
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

      const ids = (profiles || []).map((p: any) => p.id);
      if (!ids.length) return res.json([]);

      const [emailsRes, reviewCounts, listingCounts] = await Promise.all([
        supabase.rpc("get_user_emails", { user_ids: ids }),
        supabase.from("reviews").select("user_id").in("user_id", ids),
        supabase.from("listings").select("user_id").in("user_id", ids),
      ]);

      const emailMap = new Map(
        (emailsRes.data || []).map((e: any) => [e.id, e.email])
      );
      const reviewMap = new Map<string, number>();
      (reviewCounts.data || []).forEach((r: any) =>
        reviewMap.set(r.user_id, (reviewMap.get(r.user_id) || 0) + 1)
      );
      const listingMap = new Map<string, number>();
      (listingCounts.data || []).forEach((l: any) =>
        listingMap.set(l.user_id, (listingMap.get(l.user_id) || 0) + 1)
      );

      const users = (profiles || []).map((p: any) => ({
        ...p,
        email: emailMap.get(p.id) || null,
        review_count: reviewMap.get(p.id) || 0,
        listing_count: listingMap.get(p.id) || 0,
      }));

      return res.json(users);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: update user (ban/admin toggle)
  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const updates: Record<string, any> = {};
      if (typeof req.body.is_admin === "boolean")
        updates.is_admin = req.body.is_admin;
      if (typeof req.body.is_banned === "boolean")
        updates.is_banned = req.body.is_banned;
      if (!Object.keys(updates).length)
        return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
