import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";
import { registerSeoRoutes } from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // SEO routes BEFORE express.static so /robots.txt, /sitemap.xml, and
  // pretty crawler URLs (/tuners/:id) are served with the right headers.
  registerSeoRoutes(app, distPath);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
