// server/routes/clubs.ts
import type { Express } from "express";
import { getSupabaseClient, requireAdmin, logAudit } from "../lib/supabase";
import { bulkActionLimiter } from "../lib/rate-limiters";

export function registerClubRoutes(app: Express) {
  // Public: nearby clubs (geo-search)
  app.get("/api/clubs/nearby", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = Math.min(
        parseFloat(req.query.radius as string) || 25,
        100
      );
      if (isNaN(lat) || isNaN(lng))
        return res.status(400).json({ error: "lat and lng required" });

      const supabase = getSupabaseClient();
      const { data: clubs, error } = await supabase
        .from("clubs")
        .select("id, name, city, state, logo_url, lat, lng, avg_overall, coach_count")
        .eq("status", "approved")
        .not("lat", "is", null);
      if (error) return res.status(400).json({ error: error.message });

      function haversine(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
      ) {
        const R = 3959;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      const nearby = (clubs || [])
        .map((c: any) => ({
          ...c,
          distance: Math.round(haversine(lat, lng, c.lat, c.lng) * 10) / 10,
        }))
        .filter((c: any) => c.distance <= radius)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      return res.json(nearby);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: list clubs
  app.get("/api/admin/clubs", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { data: clubs, error } = await supabase
        .from("clubs")
        .select(
          "id, name, abbr, city, state, region, logo_url, website, contact_email, status, coach_count, avg_overall"
        )
        .order("name");
      if (error) return res.status(400).json({ error: error.message });

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

      const result = (clubs || []).map((c: any) => ({
        ...c,
        coaches: coachMap.get(c.id) || [],
      }));
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: update club
  app.patch("/api/admin/clubs/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = [
        "name",
        "abbr",
        "city",
        "state",
        "logo_url",
        "status",
        "website",
        "contact_email",
        "region",
      ];
      const updates: Record<string, any> = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      }
      if (!Object.keys(updates).length)
        return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase
        .from("clubs")
        .update(updates)
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: bulk action on clubs
  app.post("/api/admin/clubs/bulk", bulkActionLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { ids, status } = req.body;
      if (!ids?.length || !status)
        return res.status(400).json({ error: "ids array and status required" });
      const { error } = await supabase
        .from("clubs")
        .update({ status })
        .in("id", ids);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "bulk_status_change", "club", ids, {
        new_status: status,
      });
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
