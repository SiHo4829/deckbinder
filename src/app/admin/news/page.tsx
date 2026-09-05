import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { fetchNewsPosts } from "@/lib/admin/queries";
import { formatKoreanDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const posts = await fetchNewsPosts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">뉴스</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            초안은 사이트에 보이지 않습니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/news/new">새 글</Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="작성된 기사가 없습니다"
          description="검색 유입을 받는 공개 콘텐츠입니다. 원본 글만 올립니다."
          action={
            <Link href="/admin/news/new" className="text-sm underline">
              첫 글 작성하기
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">제목</th>
                <th className="px-3 py-2">슬러그</th>
                <th className="px-3 py-2">발행일</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-t">
                  <td className="px-3 py-2">
                    <span
                      className={
                        post.published_at
                          ? "rounded bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground"
                          : "rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      }
                    >
                      {post.published_at ? "발행" : "초안"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{post.title}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {post.slug}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {post.published_at ? formatKoreanDate(post.published_at) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/news/${post.id}`} className="text-xs underline">
                      수정
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
