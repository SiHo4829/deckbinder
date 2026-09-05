// T4.0 로컬 스파이크용 최소 설정 — 캐시 오버라이드(R2/KV/DO)는 다루지 않는다.
// 배포 여부가 정해지지 않았고(§9.12 ⓔ), 이 태스크는 로컬 build+preview만 판정한다.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
