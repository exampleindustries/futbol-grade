import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";

/**
 * Social-media crawler detection + per-page OG tag injection.
 *
 * When a known bot (Instagram, Facebook, Twitter, iMessage, etc.)
 * requests /coaches/:id or /clubs/:id, we return a minimal HTML
 * page with the correct Open Graph tags so link previews render
 * the coach/club name, rating, and branded image.
 *
 * Normal browser traffic falls through to the SPA.
 */

const CRAWLER_UA =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Googlebot|bingbot|Applebot|bot|crawl|spider|preview/i;

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

function ogHtml(meta: {
  title: string;
  description: string;
  url: string;
  image: string;
  type?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}" />
  <meta property="og:type" content="${meta.type || "website"}" />
  <meta property="og:site_name" content="Futbol Grade" />
  <meta property="og:title" content="${esc(meta.title)}" />
  <meta property="og:description" content="${esc(meta.description)}" />
  <meta property="og:image" content="${esc(meta.image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${esc(meta.url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(meta.title)}" />
  <meta name="twitter:description" content="${esc(meta.description)}" />
  <meta name="twitter:image" content="${esc(meta.image)}" />
</head>
<body>
  <p>Redirecting&hellip;</p>
  <script>window.location.href="${esc(meta.url)}";</script>
</body>
</html>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const OG_IMAGE = "https://futbolgrade.com/og-image.png";
const BASE = "https://futbolgrade.com";

async function serveCoachOg(id: string, res: Response) {
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data: coach } = await sb
      .from("coaches")
      .select("first_name, last_name, avg_overall, total_reviews, city")
      .eq("id", id)
      .single();

    if (!coach) return null; // fall through to SPA

    const name = `${coach.first_name} ${coach.last_name}`;
    const rating = Number(coach.avg_overall).toFixed(1);
    const reviews = coach.total_reviews || 0;
    const city = coach.city || "SoCal";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      ogHtml({
        title: `${name} – Coach Rating ${rating}/5 | Futbol Grade`,
        description: `${name} rated ${rating}/5 by the community. ${reviews} review${reviews !== 1 ? "s" : ""}. ${city} youth soccer coach.`,
        url: `${BASE}/coaches/${id}`,
        image: OG_IMAGE,
        type: "profile",
      })
    );
    return true;
  } catch {
    return null;
  }
}

async function serveClubOg(id: string, res: Response) {
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data: club } = await sb
      .from("clubs")
      .select("name, avg_overall, total_reviews, coach_count, city")
      .eq("id", id)
      .single();

    if (!club) return null;

    const rating = Number(club.avg_overall).toFixed(1);
    const coaches = club.coach_count || 0;
    const reviews = club.total_reviews || 0;
    const city = club.city || "SoCal";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      ogHtml({
        title: `${club.name} – Club Rating ${rating}/5 | Futbol Grade`,
        description: `${club.name} rated ${rating}/5. ${coaches} coach${coaches !== 1 ? "es" : ""}, ${reviews} review${reviews !== 1 ? "s" : ""}. ${city} youth soccer club.`,
        url: `${BASE}/clubs/${id}`,
        image: OG_IMAGE,
      })
    );
    return true;
  } catch {
    return null;
  }
}

export function ogCrawlerMiddleware(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] || "";

  // Only intercept known social/preview crawlers
  if (!CRAWLER_UA.test(ua)) return next();

  // Skip API routes and static assets
  if (req.path.startsWith("/api") || req.path.includes(".")) return next();

  const coachMatch = req.path.match(/^\/coaches\/([0-9a-f-]{36})$/);
  if (coachMatch) {
    serveCoachOg(coachMatch[1], res).then((ok) => {
      if (!ok) next();
    });
    return;
  }

  const clubMatch = req.path.match(/^\/clubs\/([0-9a-f-]{36})$/);
  if (clubMatch) {
    serveClubOg(clubMatch[1], res).then((ok) => {
      if (!ok) next();
    });
    return;
  }

  // All other crawler requests fall through to the SPA
  return next();
}
