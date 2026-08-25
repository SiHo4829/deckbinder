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

export type SetFormValues = typeof EMPTY;

/**
 * 등록·수정 겸용 (T1.15a). `setId`가 있으면 수정, 없으면 등록이다 —
 * card-form.tsx · news-form.tsx의 `isEdit` 분기와 같은 형태다.
 */
export function SetForm({
  games,
  setId,
  initial,
}: {
  games: GameOption[];
  /** 있으면 수정 모드 */
  setId?: string;
  initial?: Partial<SetFormValues>;
}) {
  const router = useRouter();
  const isEdit = setId !== undefined;
  const { values, setValue, status, pending, submit } = useAdminForm({
    empty: EMPTY,
    initial: { game_id: games[0]?.id ?? "", ...initial },
    endpoint: isEdit ? `/api/admin/sets/${setId}` : "/api/admin/sets",
    method: isEdit ? "PATCH" : "POST",
    // 수정 화면은 저장 후에도 값이 남아 있어야 한다. 등록은 다음 입력을 위해 비운다.
    resetOnSuccess: !isEdit,
    successText: (v) => (isEdit ? `세트 ${v.code} 저장 완료` : `세트 ${v.code} 등록 완료`),
    keepOnSuccess: (v) => ({ game_id: v.game_id }),
    onSuccess: () => router.refresh(),
  });

  return (
    <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
      {/*
        수정 모드에서는 게임을 잠근다. 세트의 게임을 바꾸면 이미 이 세트에 속한
        카드와 어긋나는데, 복합 FK가 막아 주긴 해도 그 에러가 원인을 설명하지
        못한다. 바꿀 일이 생기면 세트를 새로 만드는 것이 맞다 (plan T1.15a ⓐ).
      */}
      <Field label="게임" htmlFor="set-game" required hint={isEdit ? "수정할 수 없습니다." : undefined}>
        <NativeSelect
          id="set-game"
          value={values.game_id}
          disabled={isEdit}
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
        {pending ? "저장 중…" : isEdit ? "저장" : "세트 등록"}
      </Button>
    </form>
  );
}
