// server/routes/misc.ts
import type { Express } from "express";
import { getSupabaseClient } from "../lib/supabase";

export function registerMiscRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const base = "https://futbolgrade.com";
      const supabase = getSupabaseClient();
      const [coaches, clubs] = await Promise.all([
        supabase.from("coaches").select("id, updated_at").eq("status", "approved"),
        supabase.from("clubs").select("id, updated_at").eq("status", "approved"),
      ]);

      const staticPages = [
        { loc: "/", priority: "1.0", changefreq: "daily" },
        { loc: "/coaches", priority: "0.9", changefreq: "daily" },
        { loc: "/clubs", priority: "0.9", changefreq: "daily" },
        { loc: "/marketplace", priority: "0.7", changefreq: "weekly" },
      ];

      const urls = staticPages.map(
        (p) =>
          `  <url><loc>${base}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
      );

      for (const c of coaches.data || []) {
        const lastmod = c.updated_at
          ? `<lastmod>${c.updated_at.split("T")[0]}</lastmod>`
          : "";
        urls.push(
          `  <url><loc>${base}/coaches/${c.id}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`
        );
      }
      for (const c of clubs.data || []) {
        const lastmod = c.updated_at
          ? `<lastmod>${c.updated_at.split("T")[0]}</lastmod>`
          : "";
        urls.push(
          `  <url><loc>${base}/clubs/${c.id}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`
        );
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch {
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(
      `User-agent: *\nAllow: /\n\nSitemap: https://futbolgrade.com/sitemap.xml\n`
    );
  });
}
