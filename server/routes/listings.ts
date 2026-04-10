// server/routes/listings.ts
import type { Express } from "express";
import { getSupabaseClient, requireAdmin, logAudit } from "../lib/supabase";
import { sendAdminAlert } from "../lib/email";
import {
  listingLimiter,
  viewLimiter,
  deleteLimiter,
  bulkActionLimiter,
  BULK_DELETE_CAP,
} from "../lib/rate-limiters";

export function registerListingRoutes(app: Express) {
  // Submit a listing (requires auth)
  app.post("/api/listings", listingLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Not authenticated" });

      const supabase = getSupabaseClient(authHeader);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

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

      if (error) return res.status(400).json({ error: error.message });

      sendAdminAlert("listing", {
        Title: listing.title,
        Type: listing.type,
        Price: listing.price_text,
      }).catch(() => {});

      return res.json(data);
    } catch {
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

  // Admin: list listings
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
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: update listing
  app.patch("/api/admin/listings/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const allowed = [
        "status",
        "title",
        "description",
        "price_cents",
        "price_text",
        "type",
        "featured",
      ];
      const updates: Record<string, any> = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      }
      if (updates.status) updates.approved_at = new Date().toISOString();
      if (!Object.keys(updates).length)
        return res.status(400).json({ error: "No valid fields" });
      const { data, error } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: delete listing
  app.delete("/api/admin/listings/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "listing", [String(req.params.id)]);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: bulk action on listings
  app.post("/api/admin/listings/bulk", bulkActionLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { ids, status } = req.body;
      if (!ids?.length || !status)
        return res
          .status(400)
          .json({ error: "ids array and status required" });
      if (status === "delete") {
        if (ids.length > BULK_DELETE_CAP)
          return res.status(400).json({
            error: `Cannot delete more than ${BULK_DELETE_CAP} items at once`,
          });
        const { error } = await supabase
          .from("listings")
          .delete()
          .in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      } else {
        const { error } = await supabase
          .from("listings")
          .update({ status, approved_at: new Date().toISOString() })
          .in("id", ids);
        if (error) return res.status(400).json({ error: error.message });
      }
      await logAudit(
        supabase,
        status === "delete" ? "bulk_delete" : "bulk_status_change",
        "listing",
        ids,
        { new_status: status }
      );
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
