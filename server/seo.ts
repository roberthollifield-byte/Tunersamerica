/**
 * SEO middleware: serves robots.txt, sitemap.xml, and rewrites the SPA
 * index.html with per-route meta + JSON-LD so Google, Bing, and social
 * previews see correct, unique tags on every URL.
 *
 * The frontend is a wouter hash router — public routes are `/`, `/tuners`,
 * `/tuners/:id`, `/drivers/:id`, `/about`, `/pricing`, `/login`. We map
 * the bare path (without the hash) to a meta config.
 */

import type { Express, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { storage } from "./storage";

const SITE_URL = "https://tunersamerica.com";
const SITE_NAME = "TunersAmerica";
const DEFAULT_DESCRIPTION =
  "TunersAmerica is the nationwide marketplace for finding certified automotive tuners. Compare verified shops near you for dyno tuning, remote ECU tuning, diesel, and drag-race builds — read reviews and book in minutes.";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonLd(data: any): string {
  return `<script type="application/ld+json">${JSON.stringify(data)
    .replace(/</g, "\\u003c")}</script>`;
}

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonLd?: any[];
  /** Extra HTML injected into <head> before </head> */
  extraHead?: string;
}

const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  sameAs: [],
  description: DEFAULT_DESCRIPTION,
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/#/tuners?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

function homeMeta(): PageMeta {
  return {
    title: "TunersAmerica — Find a Verified Tuner Near You for Dyno, Remote & ECU Tuning",
    description: DEFAULT_DESCRIPTION,
    canonical: `${SITE_URL}/`,
    jsonLd: [SITE_JSON_LD, WEBSITE_JSON_LD],
  };
}

function tunersListMeta(): PageMeta {
  return {
    title: "Find a Tuner Near You — Browse Verified Automotive Tuners | TunersAmerica",
    description:
      "Browse verified automotive tuners across the United States. Filter by distance, tuning type (dyno, street, track, remote), supported platforms, and read real reviews before booking.",
    canonical: `${SITE_URL}/#/tuners`,
  };
}

async function tunerProfileMeta(id: number): Promise<PageMeta | null> {
  try {
    const listing: any = await storage.getListingWithDetails(id);
    if (!listing || listing.isVisible === false) return null;
    const shop = listing.shopName || "Tuner";
    const location = listing.location || "United States";
    const makes = Array.isArray(listing.supportedMakes) ? listing.supportedMakes.slice(0, 4).join(", ") : "";
    const tuningTypes = (listing.capabilities || [])
      .filter((c: any) => c.groupName === "tuning_type")
      .map((c: any) => c.value)
      .join(", ");
    const reviewCount = listing.reviewCount ?? 0;
    const avgRating = listing.avgRating ?? 0;

    const title = `${shop} — Tuner in ${location} | TunersAmerica`;
    const description =
      `${shop} is a verified tuner in ${location} on TunersAmerica. ` +
      (tuningTypes ? `Offers ${tuningTypes} tuning. ` : "") +
      (makes ? `Supports ${makes}. ` : "") +
      (reviewCount > 0 ? `${reviewCount} customer review${reviewCount === 1 ? "" : "s"}. ` : "") +
      `Read reviews and book online.`;

    const ld: any = {
      "@context": "https://schema.org",
      "@type": "AutomotiveBusiness",
      name: shop,
      url: `${SITE_URL}/#/tuners/${id}`,
      image: listing.heroImageUrl || `${SITE_URL}/favicon.png`,
      description: listing.bio || description,
      areaServed: location,
    };
    if (avgRating > 0 && reviewCount > 0) {
      ld.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(avgRating).toFixed(2),
        reviewCount,
      };
    }

    return {
      title,
      description: description.slice(0, 300),
      canonical: `${SITE_URL}/#/tuners/${id}`,
      ogImage: listing.heroImageUrl,
      jsonLd: [ld],
    };
  } catch {
    return null;
  }
}

function aboutMeta(): PageMeta {
  return {
    title: "About TunersAmerica — The Nationwide Automotive Tuner Marketplace",
    description:
      "TunersAmerica connects car owners with verified automotive tuners across the United States. Built by tuners, for tuners and the enthusiasts they serve.",
    canonical: `${SITE_URL}/#/about`,
  };
}

function pricingMeta(): PageMeta {
  return {
    title: "Pricing — Join TunersAmerica as a Tuner | TunersAmerica",
    description:
      "List your shop on TunersAmerica for $99/year. Reach drivers actively searching for dyno tuning, remote ECU tuning, and performance calibration.",
    canonical: `${SITE_URL}/#/pricing`,
  };
}

async function metaForPath(p: string): Promise<PageMeta> {
  // Hash router puts the real route after #. The bare path is always `/`,
  // so we use the query string `?_seo=/tuners/123` (Twitter/FB/Google
  // unrolls these) AND inspect any path-style fallback. Most importantly,
  // we ALSO accept /tuners/:id directly (server route), letting us share
  // pretty links that work for crawlers AND humans (the SPA hash redirect
  // is handled below).
  const lower = p.toLowerCase();

  // /tuners/:id
  const tunerMatch = lower.match(/^\/tuners\/(\d+)\/?$/);
  if (tunerMatch) {
    const m = await tunerProfileMeta(Number(tunerMatch[1]));
    if (m) return m;
  }
  if (lower === "/tuners" || lower === "/tuners/") return tunersListMeta();
  if (lower === "/about" || lower === "/about/") return aboutMeta();
  if (lower === "/pricing" || lower === "/pricing/") return pricingMeta();
  return homeMeta();
}

function renderMeta(meta: PageMeta): string {
  const parts: string[] = [];
  parts.push(`<title>${esc(meta.title)}</title>`);
  parts.push(`<meta name="description" content="${esc(meta.description)}" />`);
  parts.push(`<link rel="canonical" href="${esc(meta.canonical)}" />`);
  parts.push(`<meta name="robots" content="index, follow, max-image-preview:large" />`);

  // Open Graph
  parts.push(`<meta property="og:type" content="website" />`);
  parts.push(`<meta property="og:site_name" content="${SITE_NAME}" />`);
  parts.push(`<meta property="og:title" content="${esc(meta.title)}" />`);
  parts.push(`<meta property="og:description" content="${esc(meta.description)}" />`);
  parts.push(`<meta property="og:url" content="${esc(meta.canonical)}" />`);
  const ogImage = meta.ogImage || `${SITE_URL}/favicon.png`;
  parts.push(`<meta property="og:image" content="${esc(ogImage)}" />`);

  // Twitter
  parts.push(`<meta name="twitter:card" content="summary_large_image" />`);
  parts.push(`<meta name="twitter:title" content="${esc(meta.title)}" />`);
  parts.push(`<meta name="twitter:description" content="${esc(meta.description)}" />`);
  parts.push(`<meta name="twitter:image" content="${esc(ogImage)}" />`);

  // JSON-LD
  for (const ld of meta.jsonLd || []) {
    parts.push(jsonLd(ld));
  }
  if (meta.extraHead) parts.push(meta.extraHead);
  return parts.join("\n    ");
}

/** Inject our meta into the prebuilt index.html, replacing the static defaults. */
function injectMeta(html: string, meta: PageMeta): string {
  // Strip existing <title>...</title> and any <meta name="description">.
  let out = html
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*\/?>/gi, "");
  const rendered = renderMeta(meta);
  return out.replace(/<\/head>/i, `    ${rendered}\n  </head>`);
}

export function registerSeoRoutes(app: Express, distPath: string) {
  // robots.txt
  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.type("text/plain");
    res.send(
      [
        "User-agent: *",
        "Allow: /",
        "",
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        "",
      ].join("\n")
    );
  });

  // sitemap.xml — home + static pages + every visible tuner profile
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const listings = await storage.getVisibleListings();
      const urls: { loc: string; changefreq?: string; priority?: number }[] = [
        { loc: `${SITE_URL}/`, changefreq: "daily", priority: 1.0 },
        { loc: `${SITE_URL}/#/tuners`, changefreq: "daily", priority: 0.9 },
        { loc: `${SITE_URL}/#/about`, changefreq: "monthly", priority: 0.5 },
        { loc: `${SITE_URL}/#/pricing`, changefreq: "monthly", priority: 0.6 },
      ];
      for (const l of listings) {
        urls.push({
          loc: `${SITE_URL}/tuners/${(l as any).id}`,
          changefreq: "weekly",
          priority: 0.8,
        });
      }
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map(
            (u) =>
              `  <url><loc>${esc(u.loc)}</loc>${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`
          )
          .join("\n") +
        `\n</urlset>\n`;
      res.type("application/xml");
      res.send(xml);
    } catch (e) {
      res.status(500).type("text/plain").send("sitemap error");
    }
  });

  // Pretty crawler URLs: /tuners/123 serves the SPA index.html with the
  // right meta tags, AND injects a tiny redirect script so humans landing
  // here are bounced to the hash route. Crawlers see the meta + content
  // before any JS runs; humans hit the SPA.
  app.get(/^\/(tuners|about|pricing)(\/.*)?$/, async (req: Request, res: Response, next) => {
    // Skip api requests — they're caught earlier.
    if (req.path.startsWith("/api/")) return next();
    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) return next();

    const html = fs.readFileSync(indexPath, "utf-8");
    const meta = await metaForPath(req.path);

    // Inject a tiny redirect for browsers so they land at the hash route.
    // Crawlers that don't run JS still see the meta + body content.
    const redirectScript = `<script>(function(){var h=window.location.hash;if(!h){window.location.replace(window.location.origin+"/#"+window.location.pathname+window.location.search);}})();</script>`;
    const metaWithRedirect: PageMeta = {
      ...meta,
      extraHead: (meta.extraHead || "") + redirectScript,
    };

    res.type("text/html");
    res.send(injectMeta(html, metaWithRedirect));
  });

  // Root page — inject home meta + JSON-LD so the crawler sees it on first
  // hit. Without this, the SPA shell ships with the static defaults.
  app.get("/", async (_req: Request, res: Response, next) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) return next();
    const html = fs.readFileSync(indexPath, "utf-8");
    const meta = homeMeta();
    res.type("text/html");
    res.send(injectMeta(html, meta));
  });
}
