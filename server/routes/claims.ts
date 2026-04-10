// server/routes/claims.ts
import type { Express } from "express";
import { getSupabaseClient, requireAdmin, logAudit } from "../lib/supabase";
import { sendAdminAlert } from "../lib/email";
import { claimLimiter, deleteLimiter } from "../lib/rate-limiters";

export function registerClaimRoutes(app: Express) {
  // Submit a coach claim (requires auth)
  app.post("/api/claims", claimLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Not authenticated" });
      const supabase = getSupabaseClient(authHeader);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { coach_id, email, phone, license_number, verification_note } =
        req.body;
      if (!coach_id || !email)
        return res
          .status(400)
          .json({ error: "coach_id and email are required" });

      const { data: coach } = await supabase
        .from("coaches")
        .select("id, user_id, first_name, last_name")
        .eq("id", coach_id)
        .single();
      if (!coach) return res.status(404).json({ error: "Coach not found" });
      if (coach.user_id)
        return res
          .status(409)
          .json({ error: "This profile has already been claimed" });

      const { data, error } = await supabase
        .from("coach_claims")
        .insert({
          coach_id,
          user_id: user.id,
          email,
          phone: phone || null,
          license_number: license_number || null,
          verification_note: verification_note || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505")
          return res
            .status(409)
            .json({ error: "A pending claim already exists for this coach" });
        return res.status(400).json({ error: error.message });
      }

      sendAdminAlert("review", {
        Type: "Coach Claim",
        Coach: `${coach.first_name} ${coach.last_name}`,
        Email: email,
        License: license_number || "Not provided",
      }).catch(() => {});

      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Get current user's claims
  app.get("/api/claims/mine", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Not authenticated" });
      const supabase = getSupabaseClient(authHeader);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { data } = await supabase
        .from("coach_claims")
        .select("id, coach_id, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return res.json(data || []);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: list claims
  app.get("/api/admin/claims", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      const { data, error } = await supabase
        .from("coach_claims")
        .select(
          "*, coach:coaches(id, first_name, last_name), claimant:profiles(alias, alias_emoji)"
        )
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: approve/reject claim
  app.patch("/api/admin/claims/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { status } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res
          .status(400)
          .json({ error: "status must be 'approved' or 'rejected'" });
      }

      const { data: claim } = await supabase
        .from("coach_claims")
        .select("*, coach:coaches(first_name, last_name)")
        .eq("id", req.params.id)
        .single();
      if (!claim) return res.status(404).json({ error: "Claim not found" });

      const { error: claimError } = await supabase
        .from("coach_claims")
        .update({
          status,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", req.params.id);
      if (claimError)
        return res.status(400).json({ error: claimError.message });

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
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: delete claim
  app.delete("/api/admin/claims/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase
        .from("coach_claims")
        .delete()
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "claim", [req.params.id]);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
