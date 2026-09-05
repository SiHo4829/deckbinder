import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { NewsList } from "@/components/features/news/news-list";
import { fetchPublishedPosts } from "@/lib/news/queries";

export const metadata: Metadata = {
  title: "뉴스",
  description: "포켓몬 · 원피스 TCG 신제품, 대회, 메타 소식을 전합니다.",
};

// 이 라우트는 동적이다 — 발행 직후 첫 방문에 새 글이 보여야 하기 때문이다.
// ISR(revalidate = 300)이었을 때는 그 세그먼트 값이 Supabase 조회 fetch까지
// 태그 없는 Data Cache 항목으로 만들었고, 그 항목은 revalidatePath로도
// revalidateTag로도 비워지지 않아 발행한 글이 목록에 나타나지 않았다
// (§2.7 — 실측). 잃는 것은 캐시 히트와 DB 왕복뿐이고, SSR이라 색인은 그대로다.
export const dynamic = "force-dynamic";

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
        <NewsList posts={posts} />
      )}
    </div>
  );
}
