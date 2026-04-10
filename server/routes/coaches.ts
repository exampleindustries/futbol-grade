// server/routes/coaches.ts
import type { Express } from "express";
import { requireAdmin, logAudit } from "../lib/supabase";
import { deleteLimiter, bulkActionLimiter, BULK_DELETE_CAP } from "../lib/rate-limiters";

export function registerCoachRoutes(app: Express) {
  // Admin: list coaches
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
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: update coach
  app.patch("/api/admin/coaches/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = [
        "status",
        "first_name",
        "last_name",
        "city",
        "state",
        "club_id",
        "gender",
        "age_groups",
        "license",
        "email",
        "specialization",
      ];
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (
        updates.status &&
        !["approved", "rejected", "pending"].includes(updates.status)
      ) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (!Object.keys(updates).length)
        return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase
        .from("coaches")
        .update(updates)
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: bulk action on coaches
  app.post("/api/admin/coaches/bulk", bulkActionLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { ids, status } = req.body;
      if (!ids?.length || !status)
        return res.status(400).json({ error: "ids array and status required" });
      if (status === "delete") {
        if (ids.length > BULK_DELETE_CAP)
          return res.status(400).json({
            error: `Cannot delete more than ${BULK_DELETE_CAP} items at once`,
          });
        const { error } = await supabase
          .from("coaches")
          .delete()
          .in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      } else {
        const { error } = await supabase
          .from("coaches")
          .update({ status })
          .in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      }
      await logAudit(
        supabase,
        status === "delete" ? "bulk_delete" : "bulk_status_change",
        "coach",
        ids,
        { new_status: status }
      );
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: delete coach
  app.delete("/api/admin/coaches/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase
        .from("coaches")
        .delete()
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "coach", [String(req.params.id)]);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
