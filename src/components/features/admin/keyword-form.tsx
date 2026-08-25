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

export type KeywordFormValues = typeof EMPTY;

/** 등록·수정 겸용 (T1.15b). `keywordId`가 있으면 수정이다 — set-form.tsx와 같은 형태. */
export function KeywordForm({
  games,
  keywordId,
  initial,
}: {
  games: GameOption[];
  /** 있으면 수정 모드 */
  keywordId?: string;
  initial?: Partial<KeywordFormValues>;
}) {
  const router = useRouter();
  const isEdit = keywordId !== undefined;
  const { values, setValue, status, pending, submit } = useAdminForm({
    empty: EMPTY,
    initial: { game_id: games[0]?.id ?? "", ...initial },
    endpoint: isEdit ? `/api/admin/keywords/${keywordId}` : "/api/admin/keywords",
    method: isEdit ? "PATCH" : "POST",
    resetOnSuccess: !isEdit,
    successText: (v) =>
      isEdit ? `키워드 ${v.label_ko} 저장 완료` : `키워드 ${v.label_ko} 등록 완료`,
    keepOnSuccess: (v) => ({ game_id: v.game_id }),
    onSuccess: () => router.refresh(),
  });

  return (
    <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
      {/*
        수정 모드에서는 게임을 잠근다 — 세트보다 여기가 더 위험하다. keywords는
        게임을 참조하는 FK가 없어서 게임을 바꿔도 **에러 없이 저장되고**, 다른
        게임 카드에 태그가 붙은 채 남아 도감 필터가 조용히 어긋난다
        (plan T1.15a ⓐ).
      */}
      <Field label="게임" htmlFor="kw-game" required hint={isEdit ? "수정할 수 없습니다." : undefined}>
        <NativeSelect
          id="kw-game"
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
        {pending ? "저장 중…" : isEdit ? "저장" : "키워드 등록"}
      </Button>
    </form>
  );
}
