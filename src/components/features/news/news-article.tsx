import { Markdown } from "@/components/features/news/markdown";
import { formatKoreanDate } from "@/lib/utils/date";
import type { NewsPost } from "@/types/news";

export function NewsArticle({ post }: { post: NewsPost }) {
  return (
    <article>
      <header className="border-b pb-6">
        <time dateTime={post.published_at} className="text-xs text-muted-foreground">
          {formatKoreanDate(post.published_at)}
        </time>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          {post.title}
        </h1>
        {post.summary ? (
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {post.summary}
          </p>
        ) : null}
        {post.author_name ? (
          <p className="mt-3 text-xs text-muted-foreground">{post.author_name}</p>
        ) : null}
      </header>

      <div className="pb-8">
        <Markdown>{post.content_md}</Markdown>
      </div>
    </article>
  );
}
