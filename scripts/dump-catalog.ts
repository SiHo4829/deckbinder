import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 원격 카탈로그 데이터 백업 (T1.13 · plan §9.2 ⓑ).
 *
 * Supabase 무료 플랜에는 자동 백업이 없다. 관리자 화면의 삭제는 하드 삭제라
 * (§9.10) 되돌릴 수단이 이 파일뿐이다.
 *
 * **`supabase db dump`를 쓰고 PostgREST로 직접 긁지 않는다.** 직접 긁으면
 * `Range` 페이지네이션(1000행 상한)을 스스로 처리해야 하는데, 빠뜨리면
 * **에러 없이 잘린 백업**이 만들어진다 — 백업이 있다고 착각하게 만드는
 * 가장 나쁜 실패 모드다. pg_dump는 그 문제가 없다.
 *
 * 비밀번호는 `--env-file=.env.local`이 넣어 준 `SUPABASE_DB_PASSWORD`를
 * 자식 프로세스 환경으로만 넘긴다. **명령줄 인자로 적지 않는다** — 인자는
 * 프로세스 목록에 그대로 보인다.
 *
 * 운영 규칙: 손입력 세션이 끝날 때마다 1회, 그리고 `npm run db:clean`
 * **직전에 반드시 1회** (§9.9 — `db:clean`에는 드라이런이 없다).
 *
 * ## 복원 절차 (2026-08-25 실측)
 *
 * ```
 * npm run db:reset                                   # 로컬에 스키마만 세운다
 * docker exec -i supabase_db_deckbinder \
 *   psql -U postgres -d postgres < backups/<파일>
 * ```
 *
 * **`ON_ERROR_STOP=1`을 쓰지 마라.** 데이터 전용 덤프에는 `games` 2행이 들어
 * 있는데 마이그레이션 001이 같은 행을 이미 심어 둬서 `games_code_key` 중복
 * 오류가 반드시 한 번 난다. psql 기본값은 그 문 하나만 건너뛰고 계속하므로
 * 결과가 옳지만, `ON_ERROR_STOP=1`이면 **첫 문에서 전체 복원이 중단된다.**
 *
 * 실측 결과 `card_sets` · `cards` · `keywords` · `card_keywords` · `news_posts`
 * 행 수가 원격과 일치했고, 생성 컬럼 `base_code`도 정상 계산됐다
 * (`SMPL-OP-001_p1` → `SMPL-OP-001`) — 대체 카드 판정이 복원을 견딘다.
 */

const OUT_DIR = "backups";

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error(
    "SUPABASE_DB_PASSWORD가 없습니다. .env.local을 확인하세요 " +
      "(Supabase 대시보드 → Project Settings → Database).",
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, `catalog-${stamp()}.sql`);

console.log(`덤프 중 → ${file}`);

try {
  execFileSync(
    "npx",
    ["supabase", "db", "dump", "--linked", "--data-only", "--schema", "public", "-f", file],
    { stdio: ["ignore", "inherit", "inherit"], env: process.env, shell: true },
  );
} catch {
  // CLI가 이미 stderr에 원인을 찍었다. 여기서 덧붙이면 잡음만 는다.
  console.error("\n덤프 실패. Docker가 떠 있는지 확인하세요 — CLI는 pg_dump를 컨테이너에서 돌린다.");
  process.exit(1);
}

const { size } = statSync(file);
if (size === 0) {
  console.error(`\n${file}이 0바이트다. 백업으로 쓸 수 없으므로 실패로 처리한다.`);
  process.exit(1);
}

console.log(`\n완료: ${file} (${size.toLocaleString()} bytes)`);
console.log("복원 순서는 FK를 따른다 — games → card_sets → cards → keywords → card_keywords → news_posts");
