import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/common/ad-slot";
import { NewsArticle } from "@/components/features/news/news-article";
import { fetchPostBySlug } from "@/lib/news/queries";

// 이 라우트는 동적이다 — 발행 취소한 글이 즉시 404가 되어야 하기 때문이다.
// ISR(revalidate = 300)이었을 때는 그 세그먼트 값이 Supabase 조회 fetch까지
// 태그 없는 Data Cache 항목으로 만들었고, 그 항목은 어떤 무효화로도 비워지지
// 않아 내린 글이 계속 200으로 열렸다(§2.7 — 실측).
//
// generateStaticParams를 함께 뺐다. force-dynamic과 공존할 수 없고, 덤으로
// 빌드가 더 이상 DB에 의존하지 않는다.
export const dynamic = "force-dynamic";

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
