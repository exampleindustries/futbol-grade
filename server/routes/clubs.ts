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

  // Admin: import clubs + coaches from GotSport SOCAL event
  app.post("/api/admin/clubs/import-gotsport", async (req, res) => {
    try {
      const supabase = await requireAdmin(req, res);
      if (!supabase) return;

      const BASE = "https://system.gotsport.com";
      const EVENT_URL = `${BASE}/org_event/events/43086/clubs`;
      const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const HEADERS = { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" };
      const { batch = 5 } = req.body; // how many clubs to process per run

      async function fetchHtml(url: string): Promise<string | null> {
        try {
          const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000), redirect: "follow" });
          if (!r.ok) return null;
          return await r.text();
        } catch { return null; }
      }

      // ── Step 1: get club list ────────────────────────────────
      const clubsHtml = await fetchHtml(EVENT_URL);
      if (!clubsHtml) return res.status(502).json({ error: "Could not reach GotSport" });

      // Parse club rows: <a href="/org_event/events/43086/clubs/XXXX">Club Name</a>
      const clubLinkRe = /href="(\/org_event\/events\/43086\/clubs\/(\d+)[^"]*)"[^>]*>\s*([^<]+?)\s*</gi;
      const clubLinks: { url: string; gsId: string; name: string }[] = [];
      let cm;
      while ((cm = clubLinkRe.exec(clubsHtml)) !== null) {
        const name = cm[3].trim();
        if (name && !clubLinks.find(c => c.gsId === cm![2])) {
          clubLinks.push({ url: `${BASE}${cm[1]}`, gsId: cm[2], name });
        }
      }

      if (!clubLinks.length) return res.status(502).json({ error: "Could not parse club list from GotSport", preview: clubsHtml.substring(0, 500) });

      // Get existing club names to skip already-imported ones
      const { data: existingClubs } = await supabase.from("clubs").select("id, name").limit(1000);
      const existingNames = new Set((existingClubs || []).map((c: any) => c.name.toLowerCase().trim()));

      // Take next batch of clubs not yet in DB by name
      const toProcess = clubLinks.filter(c => !existingNames.has(c.name.toLowerCase().trim())).slice(0, batch);
      if (!toProcess.length) return res.json({ ok: true, message: `All ${clubLinks.length} GotSport clubs already exist in DB`, total: clubLinks.length });

      const storeLogo = async (id: string, imgUrl: string): Promise<string | null> => {
        try {
          const imgR = await fetch(imgUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
          if (!imgR.ok) return null;
          const buf = Buffer.from(await imgR.arrayBuffer());
          const ext = imgUrl.match(/\.(png|jpg|jpeg|webp|svg)/i)?.[1] || "png";
          await supabase.storage.from("club-logos").upload(`${id}.${ext}`, buf, {
            upsert: true,
            contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
          });
          const { data: pu } = supabase.storage.from("club-logos").getPublicUrl(`${id}.${ext}`);
          return pu.publicUrl;
        } catch { return null; }
      };

      let clubsCreated = 0;
      let clubsUpdated = 0;
      let coachesCreated = 0;
      const log: string[] = [];

      for (const clubEntry of toProcess) {
        // ── Step 2: get team list for this club ──────────────
        const clubHtml = await fetchHtml(clubEntry.url);
        if (!clubHtml) { log.push(`SKIP ${clubEntry.name}: could not fetch`); continue; }

        const teamLinkRe = /href="(\/org_event\/events\/43086\/schedule[^"]*team_id=(\d+)[^"]*)"[^>]*>/gi;
        const altTeamRe = /href="([^"]*\/teams?\/(\d+)[^"]*)"[^>]*>/gi;
        const teamLinks: Array<{ url: string; id: string }> = [];
        let tm: RegExpExecArray | null;
        while ((tm = teamLinkRe.exec(clubHtml)) !== null) {
          if (!teamLinks.find(t => t.id === tm![2])) teamLinks.push({ url: `${BASE}${tm[1]}`, id: tm[2] });
        }
        if (!teamLinks.length) {
          while ((tm = altTeamRe.exec(clubHtml)) !== null) {
            if (!teamLinks.find(t => t.id === tm![2])) teamLinks.push({ url: `${BASE}${tm[1]}`, id: tm[2] });
          }
        }

        // ── Step 3: logo + coaches from team pages ───────────
        let logoImgUrl: string | null = null;
        const coaches: Array<{ firstName: string; lastName: string; gender: string; ageGroup: string }> = [];

        for (const team of teamLinks.slice(0, 20)) {
          const teamHtml = await fetchHtml(team.url);
          if (!teamHtml) continue;

          if (!logoImgUrl) {
            const m1 = /<img[^>]+src="([^"]+)"[^>]*(?:class|alt)="[^"]*(?:logo|crest|badge|club)[^"]*"/i.exec(teamHtml)
              || /class="[^"]*(?:logo|crest|badge|team-img)[^"]*"[^>]*src="([^"]+)"/i.exec(teamHtml)
              || /<img[^>]+src="(https?:\/\/[^"]+(?:png|jpg|jpeg|webp|svg)[^"]*)"[^>]*>/i.exec(teamHtml);
            if (m1) logoImgUrl = m1[1].startsWith("http") ? m1[1] : `${BASE}${m1[1]}`;
          }

          const ageMatch = teamHtml.match(/\b(U\d+)\b/i);
          const genderMatch = teamHtml.match(/\b(Female|Male)\b/i);
          const ageGroup = ageMatch ? ageMatch[1].toUpperCase() : "";
          const gender = genderMatch ? (genderMatch[1] === "Female" ? "girls" : "boys") : "coed";

          const coachRe = /Coach:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
          let coachMatch: RegExpExecArray | null;
          while ((coachMatch = coachRe.exec(teamHtml)) !== null) {
            const parts = coachMatch[1].trim().split(/\s+/);
            if (parts.length >= 2) {
              const firstName = parts[0];
              const lastName = parts.slice(1).join(" ");
              if (!coaches.find(c => c.firstName === firstName && c.lastName === lastName)) {
                coaches.push({ firstName, lastName, gender, ageGroup });
              }
            }
          }
        }

        // ── Step 4: upsert club ──────────────────────────────
        const { data: matchedClub } = await supabase
          .from("clubs").select("id, logo_url").eq("name", clubEntry.name).maybeSingle();

        let clubId = "";
        if (matchedClub) {
          clubId = matchedClub.id;
          if (logoImgUrl && !matchedClub.logo_url) {
            const stored = await storeLogo(clubId, logoImgUrl);
            if (stored) await supabase.from("clubs").update({ logo_url: stored }).eq("id", clubId);
          }
          clubsUpdated++;
          log.push(`UPDATED ${clubEntry.name} (${coaches.length} coaches)`);
        } else {
          const { data: ins } = await supabase.from("clubs")
            .insert({ name: clubEntry.name, status: "pending" }).select("id").single();
          if (ins) {
            clubId = ins.id;
            if (logoImgUrl) {
              const stored = await storeLogo(clubId, logoImgUrl);
              if (stored) await supabase.from("clubs").update({ logo_url: stored }).eq("id", clubId);
            }
          }
          clubsCreated++;
          log.push(`CREATED ${clubEntry.name} (${coaches.length} coaches)`);
        }

        // ── Step 5: upsert coaches ───────────────────────────
        if (!clubId) continue;
        for (const coach of coaches) {
          const { data: existing } = await supabase
            .from("coaches").select("id")
            .eq("first_name", coach.firstName)
            .eq("last_name", coach.lastName)
            .eq("club_id", clubId)
            .maybeSingle();
          if (!existing) {
            await supabase.from("coaches").insert({
              first_name: coach.firstName,
              last_name: coach.lastName,
              club_id: clubId,
              gender: coach.gender,
              age_groups: coach.ageGroup ? [coach.ageGroup] : [],
              status: "pending",
            });
            coachesCreated++;
          }
        }
      }

      return res.json({
        ok: true,
        clubsTotal: clubLinks.length,
        remaining: clubLinks.filter(c => !existingNames.has(c.name.toLowerCase().trim())).length - toProcess.length,
        clubsCreated,
        clubsUpdated,
        coachesCreated,
        message: `Processed ${toProcess.length} clubs: ${clubsCreated} created, ${clubsUpdated} updated, ${coachesCreated} coaches added`,
        log,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Server error" });
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
