import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { AdSlot } from "@/components/common/ad-slot";
import { NewsList } from "@/components/features/news/news-list";
import { fetchPublishedPosts } from "@/lib/news/queries";

export const metadata: Metadata = {
  title: "뉴스",
  description: "포켓몬 · 원피스 TCG 신제품, 대회, 메타 소식을 전합니다.",
};

// 발행 즉시 반영은 관리자 API의 revalidatePath가 담당한다.
// 이 값은 그것을 놓쳤을 때의 안전망이다.
export const revalidate = 300;

export default async function NewsPage() {
  const posts = await fetchPublishedPosts();

  return (
    <div>
      <header className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight">뉴스</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          포켓몬 · 원피스 TCG 신제품, 대회, 메타 소식을 전합니다.
        </p>
      </header>

      {posts.length === 0 ? (
        <EmptyState
          title="아직 등록된 기사가 없습니다"
          description="곧 새로운 소식을 전해드리겠습니다."
        />
      ) : (
        <>
          <NewsList posts={posts} />
          <AdSlot slot="news-list" className="mt-8" />
        </>
      )}
    </div>
  );
}
