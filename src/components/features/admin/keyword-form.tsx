"use client";

import { useRouter } from "next/navigation";

import {
  Field,
  NativeSelect,
  StatusMessage,
  TextInput,
} from "@/components/features/admin/field";
import { useAdminForm } from "@/components/features/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import type { GameOption } from "@/types/admin";

const EMPTY = { game_id: "", code: "", label_ko: "", label_ja: "" };

export function KeywordForm({ games }: { games: GameOption[] }) {
  const router = useRouter();
  const { values, setValue, status, pending, submit } = useAdminForm({
    empty: EMPTY,
    initial: { game_id: games[0]?.id ?? "" },
    endpoint: "/api/admin/keywords",
    successText: (v) => `키워드 ${v.label_ko} 등록 완료`,
    keepOnSuccess: (v) => ({ game_id: v.game_id }),
    onSuccess: () => router.refresh(),
  });

  return (
    <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
      <Field label="게임" htmlFor="kw-game" required>
        <NativeSelect
          id="kw-game"
          value={values.game_id}
          onChange={(e) => setValue("game_id", e.target.value)}
        >
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name_ko}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field
        label="키워드 코드"
        htmlFor="kw-code"
        hint="소문자·숫자·밑줄만. 필터 URL에 쓰이므로 한번 정하면 바꾸기 어렵습니다. 예: draw, discard, counter"
        required
      >
        <TextInput
          id="kw-code"
          value={values.code}
          onChange={(e) => setValue("code", e.target.value)}
          placeholder="draw"
        />
      </Field>

      <Field label="한국어 표기" htmlFor="kw-label-ko" hint="필터에 보이는 이름" required>
        <TextInput
          id="kw-label-ko"
          value={values.label_ko}
          onChange={(e) => setValue("label_ko", e.target.value)}
          placeholder="드로우"
        />
      </Field>

      <Field label="일본어 표기" htmlFor="kw-label-ja">
        <TextInput
          id="kw-label-ja"
          value={values.label_ja}
          onChange={(e) => setValue("label_ja", e.target.value)}
        />
      </Field>

      <StatusMessage status={status} />

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중…" : "키워드 등록"}
      </Button>
    </form>
  );
}
