// server/routes/clubs.ts
import type { Express } from "express";
import { getSupabaseClient, requireAdmin, logAudit } from "../lib/supabase";
import { bulkActionLimiter } from "../lib/rate-limiters";

export function registerClubRoutes(app: Express) {
  // Public: all approved clubs (for map)
  app.get("/api/clubs", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, city, state, logo_url, lat, lng, avg_overall, website, coach_count")
        .eq("status", "approved")
        .not("lat", "is", null);
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data || []);
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

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

  // Admin: crawl logos for top 10 pending clubs via DuckDuckGo image search
  app.post("/api/admin/clubs/crawl-logos", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;

      // Fetch all pending clubs — no website requirement
      const { data: clubs } = await supabase
        .from("clubs")
        .select("id, name, city, state, website, logo_url")
        .eq("status", "pending")
        .order("name")
        .limit(10);

      if (!clubs || clubs.length === 0)
        return res.json({ ok: true, crawled: 0, logos: 0, coaches: 0, message: "No pending clubs found" });

      const UA = "Mozilla/5.0 (compatible; FutbolGrade-LogoCrawler/1.0)";

      async function downloadAndStore(clubId: string, imgUrl: string): Promise<string | null> {
        try {
          const imgResp = await fetch(imgUrl, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": UA },
          });
          if (!imgResp.ok) return null;
          const ct = imgResp.headers.get("content-type") || "";
          if (!ct.startsWith("image/")) return null;
          const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
          if (imgBuffer.length < 500) return null; // skip tiny/broken images
          const ext = imgUrl.match(/\.(png|jpg|jpeg|webp|svg)/i)?.[1] ||
            (ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("svg") ? "svg" : "jpeg");
          const storagePath = `${clubId}.${ext}`;
          const { error } = await supabase.storage.from("club-logos").upload(storagePath, imgBuffer, {
            upsert: true,
            contentType: ct.split(";")[0],
          });
          if (error) return null;
          const { data: urlData } = supabase.storage.from("club-logos").getPublicUrl(storagePath);
          return urlData.publicUrl + "?v=" + Date.now();
        } catch {
          return null;
        }
      }

      async function scrapeLogoFromSite(siteUrl: string): Promise<string | null> {
        try {
          const base = siteUrl.replace(/\/$/, "");
          const resp = await fetch(base, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": UA },
            redirect: "follow",
          });
          if (!resp.ok) return null;
          const ct = resp.headers.get("content-type") || "";
          if (!ct.includes("text/html")) return null;
          const html = await resp.text();

          // og:image
          const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          if (og?.[1]) return og[1].startsWith("http") ? og[1] : new URL(og[1], base).href;

          // apple-touch-icon
          const icon = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)
            || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
          if (icon?.[1]) return icon[1].startsWith("http") ? icon[1] : new URL(icon[1], base).href;

          // img with logo in class/alt/id
          const logoImg = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*(?:class|alt|id)=["'][^"']*logo[^"']*["']/i)
            || html.match(/<img[^>]*(?:class|alt|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i);
          if (logoImg?.[1]) return logoImg[1].startsWith("http") ? logoImg[1] : new URL(logoImg[1], base).href;

          return null;
        } catch {
          return null;
        }
      }

      async function searchDuckDuckGoForLogo(club: any): Promise<string | null> {
        const location = [club.city, club.state].filter(Boolean).join(" ");
        const query = encodeURIComponent(`${club.name} soccer ${location} logo`);
        try {
          // DuckDuckGo HTML search — grab first image result URLs from results
          const searchResp = await fetch(`https://html.duckduckgo.com/html/?q=${query}&iax=images&ia=images`, {
            signal: AbortSignal.timeout(12000),
            headers: {
              "User-Agent": UA,
              "Accept": "text/html",
            },
          });
          if (!searchResp.ok) return null;
          const html = await searchResp.text();

          // Extract site links from search results to find the club's website
          const siteLinks: string[] = [];
          const linkPattern = /href="(https?:\/\/(?!duckduckgo|google|facebook|twitter|instagram|youtube|yelp)[^"]+)"/gi;
          let m;
          while ((m = linkPattern.exec(html)) !== null && siteLinks.length < 5) {
            const url = m[1];
            if (!siteLinks.includes(url)) siteLinks.push(url);
          }

          // Try scraping each candidate site for a logo
          for (const siteUrl of siteLinks) {
            const logoUrl = await scrapeLogoFromSite(siteUrl);
            if (logoUrl) {
              console.log(`[LOGO-CRAWL] ${club.name}: found logo via DDG at ${siteUrl}`);
              return logoUrl;
            }
          }
          return null;
        } catch {
          return null;
        }
      }

      let logos = 0;
      let coachesUpdated = 0;

      for (const club of clubs) {
        let logoUrl: string | null = club.logo_url || null;

        if (!logoUrl) {
          // 1. Try the club's own website first if we have it
          if (club.website) {
            const fromSite = await scrapeLogoFromSite(club.website);
            if (fromSite) {
              logoUrl = await downloadAndStore(club.id, fromSite);
            }
          }

          // 2. Fall back to DuckDuckGo search
          if (!logoUrl) {
            const fromSearch = await searchDuckDuckGoForLogo(club);
            if (fromSearch) {
              logoUrl = await downloadAndStore(club.id, fromSearch);
            }
          }

          if (logoUrl) {
            await supabase.from("clubs").update({ logo_url: logoUrl }).eq("id", club.id);
            logos++;
            console.log(`[LOGO-CRAWL] Saved logo for ${club.name}`);
          } else {
            console.log(`[LOGO-CRAWL] No logo found for ${club.name}`);
          }
        }

        // Set coaches without a photo to use the club logo
        if (logoUrl) {
          const { data: coaches } = await supabase
            .from("coaches")
            .select("id")
            .eq("club_id", club.id)
            .is("photo_url", null);
          if (coaches && coaches.length > 0) {
            await supabase
              .from("coaches")
              .update({ photo_url: logoUrl })
              .in("id", coaches.map((c: any) => c.id));
            coachesUpdated += coaches.length;
          }
        }
      }

      return res.json({
        ok: true,
        crawled: clubs.length,
        logos,
        coaches: coachesUpdated,
        message: `Crawled ${clubs.length} clubs: ${logos} logos found, ${coachesUpdated} coaches updated`,
      });
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
