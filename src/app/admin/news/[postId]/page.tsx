import { notFound } from "next/navigation";

import { AdminDeleteButton } from "@/components/features/admin/admin-delete-button";
import { NewsForm } from "@/components/features/admin/news-form";
import { fetchNewsPost } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminEditNewsPage(
  props: PageProps<"/admin/news/[postId]">,
) {
  const { postId } = await props.params;
  const post = await fetchNewsPost(postId);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">뉴스 수정</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{post.slug}</p>
      </div>

      <NewsForm
        postId={post.id}
        initial={{
          slug: post.slug,
          title: post.title,
          summary: post.summary ?? "",
          content_md: post.content_md,
          thumbnail_url: post.thumbnail_url ?? "",
          author_name: post.author_name ?? "",
          published: post.published_at ? "true" : "false",
        }}
      />

      {/* <form> 바깥의 형제 컴포넌트로 둔다 — AdminDeleteButton 참고 */}
      <AdminDeleteButton
        endpoint={`/api/admin/news/${post.id}`}
        redirectTo="/admin/news"
        label={post.title}
      />
    </div>
  );
}
