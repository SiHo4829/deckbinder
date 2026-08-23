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

const EMPTY = { game_id: "", code: "", name_ja: "", name_ko: "", released_at: "" };

export function SetForm({ games }: { games: GameOption[] }) {
  const router = useRouter();
  const { values, setValue, status, pending, submit } = useAdminForm({
    empty: EMPTY,
    initial: { game_id: games[0]?.id ?? "" },
    endpoint: "/api/admin/sets",
    successText: (v) => `세트 ${v.code} 등록 완료`,
    keepOnSuccess: (v) => ({ game_id: v.game_id }),
    onSuccess: () => router.refresh(),
  });

  return (
    <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
      <Field label="게임" htmlFor="set-game" required>
        <NativeSelect
          id="set-game"
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

      <Field label="세트 코드" htmlFor="set-code" hint="예: OP01, SV5M" required>
        <TextInput
          id="set-code"
          value={values.code}
          onChange={(e) => setValue("code", e.target.value)}
        />
      </Field>

      <Field label="일본어 세트명" htmlFor="set-name-ja" required>
        <TextInput
          id="set-name-ja"
          value={values.name_ja}
          onChange={(e) => setValue("name_ja", e.target.value)}
        />
      </Field>

      <Field label="한국어 세트명" htmlFor="set-name-ko" hint="없으면 비워 둡니다.">
        <TextInput
          id="set-name-ko"
          value={values.name_ko}
          onChange={(e) => setValue("name_ko", e.target.value)}
        />
      </Field>

      <Field label="발매일" htmlFor="set-released" hint="YYYY-MM-DD">
        <TextInput
          id="set-released"
          value={values.released_at}
          onChange={(e) => setValue("released_at", e.target.value)}
          placeholder="2022-07-22"
        />
      </Field>

      <StatusMessage status={status} />

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중…" : "세트 등록"}
      </Button>
    </form>
  );
}
