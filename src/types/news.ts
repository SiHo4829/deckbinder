export interface NewsListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnail_url: string | null;
  published_at: string;
}

export interface NewsPost extends NewsListItem {
  content_md: string;
  author_name: string | null;
  updated_at: string;
}

/** 관리자 목록. 초안이 섞여 있으므로 published_at이 nullable이다. */
export interface AdminNewsRow {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
  updated_at: string;
}
