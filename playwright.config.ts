import { defineConfig, devices } from "@playwright/test";

// 3000 포트는 다른 프로젝트와 충돌하기 쉬우므로 E2E 전용 포트를 사용한다.
// reuseExistingServer를 끄면 외부에서 뜬 서버에 잘못 붙는 사고를 막을 수 있고,
// 포트가 점유된 경우 조용히 통과하는 대신 명확히 실패한다.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI에서는 프로덕션 빌드를 검증하고, 로컬에서는 기동이 빠른 dev 서버를 쓴다.
    command: isCI
      ? `npm run build && npm run start -- --port ${port}`
      : `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
