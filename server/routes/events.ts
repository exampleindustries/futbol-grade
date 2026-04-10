// server/routes/events.ts
import type { Express } from "express";
import { getSupabaseClient, requireAdmin, logAudit } from "../lib/supabase";
import { sendAdminAlert, RESEND_API_KEY } from "../lib/email";
import { deleteLimiter } from "../lib/rate-limiters";

const CRON_SECRET = process.env.CRON_SECRET || "fg-cron-2026-scan";

async function scanClubWebsitesForEvents(
  submittedBy?: string
): Promise<{ found: number; scanned: number; logos: number }> {
  const supabase = getSupabaseClient();
  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name, website, logo_url")
    .not("website", "is", null)
    .eq("status", "approved");

  if (!clubs || clubs.length === 0) return { found: 0, scanned: 0, logos: 0 };

  const eventKeywords =
    /camp|clinic|tournament|tryout|training|showcase|league|cup|classic|festival|jamboree|combine|registration|sign[- ]?up|open\s+house/i;
  const pathSuffixes = [
    "",
    "/events",
    "/camps",
    "/tournaments",
    "/programs",
    "/news",
    "/tryouts",
    "/schedule",
    "/calendar",
    "/clinics",
    "/registration",
  ];
  let found = 0;
  let logos = 0;

  for (const club of clubs) {
    if (!club.website) continue;
    const base = club.website.replace(/\/$/, "");

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

          const ogMatch =
            homeHtml.match(
              /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
            ) ||
            homeHtml.match(
              /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
            );
          if (ogMatch) logoUrl = ogMatch[1];

          if (!logoUrl) {
            const iconMatch =
              homeHtml.match(
                /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i
              ) ||
              homeHtml.match(
                /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i
              );
            if (iconMatch) logoUrl = iconMatch[1];
          }

          if (!logoUrl) {
            const logoImgMatch =
              homeHtml.match(
                /<img[^>]+src=["']([^"']+)["'][^>]*(?:class|alt|id)=["'][^"']*logo[^"']*["']/i
              ) ||
              homeHtml.match(
                /<img[^>]*(?:class|alt|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i
              );
            if (logoImgMatch) logoUrl = logoImgMatch[1] || logoImgMatch[2];
          }

          if (logoUrl) {
            if (!logoUrl.startsWith("http"))
              logoUrl = new URL(logoUrl, base).href;
            try {
              const imgResp = await fetch(logoUrl, {
                signal: AbortSignal.timeout(8000),
              });
              if (imgResp.ok) {
                const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
                const ext =
                  logoUrl.match(/\.(png|jpg|jpeg|webp|svg)/i)?.[1] || "png";
                const storagePath = `${club.id}.${ext}`;
                await supabase.storage
                  .from("club-logos")
                  .upload(storagePath, imgBuffer, {
                    upsert: true,
                    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
                  });
                const { data: urlData } = supabase.storage
                  .from("club-logos")
                  .getPublicUrl(storagePath);
                const finalUrl = urlData.publicUrl + "?v=" + Date.now();
                await supabase
                  .from("clubs")
                  .update({ logo_url: finalUrl })
                  .eq("id", club.id);
                logos++;
                console.log(`[CRAWL] Logo found for ${club.name}: ${logoUrl}`);
              }
            } catch {
              /* skip logo download errors */
            }
          }
        }
      } catch {
        /* skip homepage errors */
      }
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

          const { data: existing } = await supabase
            .from("events")
            .select("id")
            .eq("source_url", url)
            .limit(1);
          if (existing && existing.length > 0) continue;

          if (!eventKeywords.test(html)) continue;

          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          let pageTitle = (
            h1Match?.[1]?.trim() ||
            titleMatch?.[1]?.trim() ||
            "Event"
          ).replace(/\s+/g, " ");
          if (pageTitle.length > 120) pageTitle = pageTitle.slice(0, 120);

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

          const imgPattern =
            /(?:src|href)=["']([^"']+\.(?:jpg|jpeg|png|webp|gif|pdf))["']/gi;
          let flyerUrl: string | null = null;
          let imgMatch;
          while ((imgMatch = imgPattern.exec(html)) !== null) {
            const imgUrl = imgMatch[1];
            if (
              eventKeywords.test(imgUrl) ||
              /flyer|poster|banner/i.test(imgUrl)
            ) {
              flyerUrl = imgUrl.startsWith("http")
                ? imgUrl
                : new URL(imgUrl, url).href;
              break;
            }
          }

          if (eventDate || eventKeywords.test(pageTitle)) {
            await supabase.from("events").insert({
              title: pageTitle,
              description: `Auto-discovered from ${club.name} website`,
              flyer_url: flyerUrl,
              event_date:
                eventDate ||
                new Date(Date.now() + 30 * 86400000)
                  .toISOString()
                  .split("T")[0],
              club_id: club.id,
              source: "club_crawl",
              status: "pending",
              submitted_by: submittedBy || null,
              source_url: url,
            });
            found++;
          }
        } catch {
          /* skip URL */
        }
      }
    } catch {
      /* skip club */
    }
  }

  await supabase
    .from("events")
    .update({ status: "expired" })
    .eq("status", "approved")
    .lt("event_date", new Date().toISOString().split("T")[0]);

  return { found, scanned: clubs.length, logos };
}

export function registerEventRoutes(app: Express) {
  // Public: list upcoming approved events
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
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Submit event flyer (authenticated users)
  app.post("/api/events", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Not authenticated" });
      const supabase = getSupabaseClient(authHeader);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { title, description, flyer_url, event_date, end_date, club_id } =
        req.body;
      if (!title || !event_date)
        return res
          .status(400)
          .json({ error: "Title and event date are required" });

      const { data, error } = await supabase
        .from("events")
        .insert({
          title,
          description: description || null,
          flyer_url: flyer_url || null,
          event_date,
          end_date: end_date || null,
          club_id: club_id || null,
          source: "user_upload",
          status: "pending",
          submitted_by: user.id,
        })
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });

      sendAdminAlert("listing", {
        Type: "Event Flyer Submission",
        Title: title,
        "Event Date": event_date,
        Description: description || "(none)",
      });

      return res.status(201).json(data);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: list events
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
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: approve/reject event
  app.patch("/api/admin/events/:id", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const updates: Record<string, any> = {};
      if (req.body.status) {
        updates.status = req.body.status;
        if (req.body.status === "approved") {
          updates.approved_by = user?.id;
          updates.approved_at = new Date().toISOString();
        }
      }
      if (!Object.keys(updates).length)
        return res.status(400).json({ error: "No valid fields" });
      const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: delete event
  app.delete("/api/admin/events/:id", deleteLimiter, async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      await logAudit(supabase, "delete", "event", [req.params.id]);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin: manually trigger event crawl
  app.post("/api/admin/events/crawl", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const result = await scanClubWebsitesForEvents(user?.id);
      return res.json({
        ...result,
        message: `Scanned ${result.scanned} clubs: ${result.found} events found, ${result.logos} logos discovered`,
      });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Cron: scheduled event scan
  app.post("/api/cron/scan-events", async (req, res) => {
    try {
      const secret = req.headers["x-cron-secret"] || req.query.secret;
      if (secret !== CRON_SECRET) {
        return res.status(401).json({ error: "Invalid cron secret" });
      }
      console.log(`[CRON] Event scan started at ${new Date().toISOString()}`);
      const result = await scanClubWebsitesForEvents();
      console.log(
        `[CRON] Event scan complete: scanned=${result.scanned}, found=${result.found}`
      );

      if (result.found > 0 && RESEND_API_KEY) {
        sendAdminAlert("listing", {
          Type: "Scheduled Event Scan",
          "Events Found": String(result.found),
          "Clubs Scanned": String(result.scanned),
          Note: "New events are pending your approval in the Events tab",
        });
      }

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[CRON] Event scan failed:", err);
      return res.status(500).json({ error: "Scan failed" });
    }
  });
}
