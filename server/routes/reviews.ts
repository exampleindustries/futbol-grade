// server/routes/reviews.ts
import type { Express } from "express";
import { getSupabaseClient, requireAdmin, logAudit } from "../lib/supabase";
import { sendAdminAlert } from "../lib/email";
import { reviewLimiter, deleteLimiter } from "../lib/rate-limiters";

export function registerReviewRoutes(app: Express) {
  // Submit a review (requires auth)
  app.post("/api/reviews", reviewLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Not authenticated" });

      const supabase = getSupabaseClient(authHeader);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

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

      // Fire-and-forget admin email alert
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
          const name = coach
            ? `${coach.first_name} ${coach.last_name}`
            : `Coach #${body.coach_id}`;
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

  // Admin: list reviews
  app.get("/api/admin/reviews", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const status = (req.query.status as string) || "pending";
      let query = supabase
        .from("reviews")
        .select(
          "*, coach:coaches(id, first_name, last_name), reviewer:profiles(alias, alias_emoji)"
        )
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

  // Admin: approve/reject review
  app.patch("/api/admin/reviews/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { status } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res
          .status(400)
          .json({ error: "status must be 'approved' or 'rejected'" });
      }
      const { data, error } = await supabase
        .from("reviews")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: delete review
  app.delete("/api/admin/reviews/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "review", [req.params.id]);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });
}
