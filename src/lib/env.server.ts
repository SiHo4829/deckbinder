import "server-only";

import { z } from "zod";

import { parseEnv } from "@/lib/env";

// 서버 전용 시크릿. 클라이언트 번들에 유입되면 안 되므로 env.ts와 분리하고
// 'server-only'로 브라우저 import를 빌드 단계에서 차단한다.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const serverEnv = parseEnv(
  serverSchema,
  {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  "서버 환경변수",
);
