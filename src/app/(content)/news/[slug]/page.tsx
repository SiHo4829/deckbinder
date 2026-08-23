import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/common/ad-slot";
import { NewsArticle } from "@/components/features/news/news-article";
import { fetchPostBySlug, fetchPublishedSlugs } from "@/lib/news/queries";

export const revalidate = 300;

/** 발행된 글은 미리 생성한다. 이후 발행분은 dynamicParams로 처리된다. */
export async function generateStaticParams() {
  const posts = await fetchPublishedSlugs();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/news/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await fetchPostBySlug(slug);
  if (!post) return { title: "기사를 찾을 수 없습니다" };

  return {
    title: post.title,
    description: post.summary ?? undefined,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary ?? undefined,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      images: post.thumbnail_url ? [post.thumbnail_url] : undefined,
    },
  };
}

export default async function NewsDetailPage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  // 초안·예약 발행은 RLS가 막으므로 여기서는 null이 된다.
  const post = await fetchPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/news" className="hover:underline">
          뉴스
        </Link>
      </nav>

      <NewsArticle post={post} />
      <AdSlot slot="news-article" />
    </div>
  );
}
