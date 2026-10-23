import type { MetadataRoute } from "next";
import { site } from "../lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = "2026-10-23";
  return ["/", "/support", "/privacy", "/terms"].map((path) => ({
    url: path === "/" ? `${site.url}/` : `${site.url}${path}`,
    lastModified,
  }));
}
