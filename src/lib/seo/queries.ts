import "server-only";

import { createSupabaseAnonClient } from "@/lib/supabase/public";

// supabase/config.toml의 max_rows와 같다. 넘기면 **에러 없이** 잘린다.
const PAGE = 1000;
// sitemap 1개당 Google 상한은 50,000. 그 전에 분할해야 한다.
const HARD_CAP = 45_000;

/**
 * 카드 URL 전량.
 *
 * `.range()`로 나눠 읽지 않으면 PostgREST가 1000행에서 조용히 잘라낸다.
 * 실패가 드러나지 않는 종류라 카드 수가 적어도 처음부터 페이지네이션한다.
 */
export async function fetchAllCardUrls(): Promise<{ id: string; updated_at: string }[]> {
  const supabase = createSupabaseAnonClient();
  const rows: { id: string; updated_at: string }[] = [];

  for (let from = 0; from < HARD_CAP; from += PAGE) {
    const { data, error } = await supabase
      .from("cards")
      .select("id,updated_at")
      .order("code")
      .range(from, from + PAGE - 1);

    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }

  // 여기까지 왔다면 상한에 걸린 것이다.
  // 카드가 40,000장을 넘으면 generateSitemaps로 분할한다.
  console.warn(`[sitemap] 카드 URL이 상한(${HARD_CAP})에 도달했습니다. 분할이 필요합니다.`);
  return rows;
}
