import Link from "next/link";

import { formatKoreanDate } from "@/lib/utils/date";
import type { NewsListItem } from "@/types/news";

export function NewsList({ posts }: { posts: NewsListItem[] }) {
  return (
    <ul className="flex flex-col divide-y border-t">
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/news/${post.slug}`} className="group block py-6">
            <time dateTime={post.published_at} className="text-xs text-muted-foreground">
              {formatKoreanDate(post.published_at)}
            </time>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-balance group-hover:underline">
              {post.title}
            </h2>
            {post.summary ? (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {post.summary}
              </p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
