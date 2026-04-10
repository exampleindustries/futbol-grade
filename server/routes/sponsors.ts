// server/routes/sponsors.ts
import type { Express } from "express";
import { getSupabaseClient, requireAdmin, logAudit } from "../lib/supabase";
import { deleteLimiter, sponsorTrackLimiter } from "../lib/rate-limiters";

export function registerSponsorRoutes(app: Express) {
  // Public: list active sponsors (location-filtered)
  app.get("/api/sponsors", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);

      const { data, error } = await supabase
        .from("sponsors")
        .select(
          "id, name, logo_url, website, description, city, state, is_main_sponsor, lat, lng, radius_miles"
        )
        .eq("is_active", true)
        .or(
          "expires_at.is.null,expires_at.gt." + new Date().toISOString()
        );
      if (error) return res.status(400).json({ error: error.message });

      let sponsors = data || [];

      if (!isNaN(lat) && !isNaN(lng)) {
        sponsors = sponsors.filter((s) => {
          if (s.is_main_sponsor) return true;
          if (!s.lat || !s.lng) return false;
          const R = 3958.8;
          const dLat = ((s.lat - lat) * Math.PI) / 180;
          const dLon = ((s.lng - lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) *
              Math.cos((s.lat * Math.PI) / 180) *
              Math.sin(dLon / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return dist <= (s.radius_miles || 25);
        });
      }

      sponsors.sort((a, b) => {
        if (a.is_main_sponsor && !b.is_main_sponsor) return -1;
        if (!a.is_main_sponsor && b.is_main_sponsor) return 1;
        return a.name.localeCompare(b.name);
      });

      return res.json(sponsors);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Public: track sponsor impressions/clicks
  app.post("/api/sponsors/track", sponsorTrackLimiter, async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { sponsor_ids, event_type } = req.body;
      if (!Array.isArray(sponsor_ids) || sponsor_ids.length === 0)
        return res.status(400).json({ error: "sponsor_ids required" });
      if (event_type !== "impression" && event_type !== "click")
        return res
          .status(400)
          .json({ error: "event_type must be impression or click" });
      const col = event_type === "impression" ? "impressions" : "clicks";
      const today = new Date().toISOString().slice(0, 10);

      for (const sid of sponsor_ids.slice(0, 50)) {
        await supabase
          .rpc("increment_sponsor_analytics", {
            p_sponsor_id: sid,
            p_date: today,
            p_col: col,
          })
          .then(() => {})
          .catch(() => {
            supabase
              .from("sponsor_analytics")
              .upsert(
                { sponsor_id: sid, date: today, [col]: 1 },
                { onConflict: "sponsor_id,date" }
              )
              .then(() => {});
          });

        await supabase
          .rpc("increment_sponsor_counter", {
            p_sponsor_id: sid,
            p_col: col,
          })
          .catch(() => {});
      }

      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: list all sponsors
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
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: create sponsor
  app.post("/api/admin/sponsors", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = [
        "name",
        "logo_url",
        "website",
        "description",
        "city",
        "state",
        "region",
        "lat",
        "lng",
        "radius_miles",
        "is_active",
        "is_main_sponsor",
        "expires_at",
        "total_spent",
        "contact_name",
        "contact_email",
      ];
      const fields: any = {};
      for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
      const { data, error } = await supabase
        .from("sponsors")
        .insert(fields)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "create", "sponsor", [data.id]);
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: update sponsor
  app.patch("/api/admin/sponsors/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = [
        "name",
        "logo_url",
        "website",
        "description",
        "city",
        "state",
        "region",
        "lat",
        "lng",
        "radius_miles",
        "is_active",
        "is_main_sponsor",
        "expires_at",
        "total_spent",
        "contact_name",
        "contact_email",
      ];
      const fields: any = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
      const { data, error } = await supabase
        .from("sponsors")
        .update(fields)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "update", "sponsor", [req.params.id]);
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: delete sponsor
  app.delete(
    "/api/admin/sponsors/:id",
    deleteLimiter,
    async (req, res) => {
      try {
        const supabase = await requireAdmin(req, res);
        if (!supabase) return;
        const { error } = await supabase
          .from("sponsors")
          .delete()
          .eq("id", req.params.id);
        if (error) return res.status(400).json({ error: error.message });
        await logAudit(supabase, "delete", "sponsor", [req.params.id]);
        return res.json({ ok: true });
      } catch {
        return res.status(500).json({ error: "Server error" });
      }
    }
  );

  // Admin: sponsor analytics
  app.get("/api/admin/sponsors/:id/analytics", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const days = Math.min(
        parseInt(req.query.days as string) || 30,
        90
      );
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("sponsor_analytics")
        .select("date, impressions, clicks")
        .eq("sponsor_id", req.params.id)
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
