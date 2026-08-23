import Link from "next/link";

import { formatKoreanDate } from "@/lib/utils/date";
import type { NewsListItem } from "@/types/news";

export function NewsList({ posts }: { posts: NewsListItem[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/news/${post.slug}`} className="block py-5 transition-colors hover:opacity-80">
            <time dateTime={post.published_at} className="text-xs text-muted-foreground">
              {formatKoreanDate(post.published_at)}
            </time>
            <h2 className="mt-1 text-base font-semibold tracking-tight">{post.title}</h2>
            {post.summary ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.summary}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
