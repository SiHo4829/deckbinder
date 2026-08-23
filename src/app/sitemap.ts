import type { MetadataRoute } from "next";

import { clientEnv } from "@/lib/env";
import { fetchPublishedSlugs } from "@/lib/news/queries";
import { fetchAllCardUrls } from "@/lib/seo/queries";
import { buildSitemapEntries } from "@/lib/seo/sitemap";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, cards] = await Promise.all([fetchPublishedSlugs(), fetchAllCardUrls()]);

  return buildSitemapEntries({
    base: clientEnv.NEXT_PUBLIC_SITE_URL,
    posts,
    cards,
  });
}
