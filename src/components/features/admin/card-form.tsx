"use client";

import { useMemo, useState } from "react";

import {
  Field,
  NativeSelect,
  StatusMessage,
  TextArea,
  TextInput,
} from "@/components/features/admin/field";
import { useAdminForm } from "@/components/features/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { setDisplayName, type GameOption, type KeywordOption, type SetOption } from "@/types/admin";

const EMPTY = {
  game_id: "",
  set_id: "",
  code: "",
  name_ja: "",
  name_ko: "",
  name_en: "",
  rarity: "",
  attribute: "",
  card_type: "",
  sub_type: "",
  image_url: "",
  effect_text: "",
};

/** news-form.tsx의 NewsFormValues와 같은 역할 — 수정 폼 initial prop 타이핑에 쓴다. */
export type CardFormValues = typeof EMPTY;

/** 자유 입력이지만 오타가 잦은 항목은 예시를 붙여 둔다. */
const TEXT_FIELDS = [
  { key: "code", label: "카드 코드", hint: "예: OP01-001", required: true },
  {
    key: "name_ja",
    label: "일본어 카드명",
    hint: "일본 중고 매물 검색에 쓰이는 키입니다.",
    required: true,
  },
  { key: "name_ko", label: "한국어 카드명", hint: "없으면 일본어명으로 표시됩니다." },
  { key: "name_en", label: "영문 카드명" },
  { key: "rarity", label: "레어도", hint: "예: C, R, SR, SEC" },
  { key: "attribute", label: "속성", hint: "예: Fire, 적색" },
  { key: "card_type", label: "카드 종류", hint: "예: Pokemon, LEADER, CHARACTER" },
  {
    key: "sub_type",
    label: "세부 종류",
    hint: "기본 에너지는 basic_energy로 넣으면 덱 매수 제한에서 면제됩니다.",
  },
] as const satisfies readonly {
  key: keyof typeof EMPTY;
  label: string;
  hint?: string;
  required?: boolean;
}[];

/**
 * 등록·수정 겸용 (T1.12-2). `cardId`가 있으면 수정, 없으면 등록이다 —
 * `news-form.tsx`의 `postId?` 분기와 같은 규칙이다.
 *
 * 삭제 영역(`AdminDeleteButton`)은 이 컴포넌트가 아니라 **호출부(수정 페이지)가
 * `<form>` 바깥에 형제로 렌더한다.** `admin-delete-button.tsx`의 문서 참고.
 */
export function CardForm({
  games,
  sets,
  keywords,
  cardId,
  initial,
  initialKeywordIds,
}: {
  games: GameOption[];
  sets: SetOption[];
  keywords: KeywordOption[];
  /** 있으면 수정, 없으면 등록 */
  cardId?: string;
  initial?: Partial<CardFormValues>;
  /** 수정 대상 카드에 이미 걸린 키워드. 없으면(등록) 빈 배열로 시작한다. */
  initialKeywordIds?: string[];
}) {
  const isEdit = cardId !== undefined;
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    initialKeywordIds ?? [],
  );

  const { values, setValue, patch, status, pending, submit } = useAdminForm({
    empty: EMPTY,
    initial: { game_id: games[0]?.id ?? "", ...initial },
    // news-form.tsx의 isEdit 분기(엔드포인트 삼항 · method: PATCH · resetOnSuccess: !isEdit)와
    // 동일 패턴. PATCH가 keyword_ids를 받아들이는 것은 T1.12-3에서 처리했다.
    endpoint: isEdit ? `/api/admin/cards/${cardId}` : "/api/admin/cards",
    method: isEdit ? "PATCH" : "POST",
    // 수정 폼을 비우면 방금 고친 내용이 사라진다.
    resetOnSuccess: !isEdit,
    extra: () => ({ keyword_ids: selectedKeywords }),
    successText: (v) => (isEdit ? `카드 ${v.code} 저장 완료` : `카드 ${v.code} 등록 완료`),
    // 한 세트를 연속 입력하는 흐름이 잦다 (등록 전용 — resetOnSuccess를 developer가
    // false로 두는 수정 흐름에서는 쓰이지 않는다).
    keepOnSuccess: (v) => ({ game_id: v.game_id, set_id: v.set_id }),
  });

  // 세트는 카드와 같은 게임이어야 한다(DB 복합 FK). 선택지를 미리 좁힌다.
  const availableSets = useMemo(
    () => sets.filter((s) => s.game_id === values.game_id),
    [sets, values.game_id],
  );
  const availableKeywords = useMemo(
    () => keywords.filter((k) => k.game_id === values.game_id),
    [keywords, values.game_id],
  );

  function toggleKeyword(id: string) {
    setSelectedKeywords((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="게임" htmlFor="card-game" required>
          <NativeSelect
            id="card-game"
            value={values.game_id}
            // 게임이 바뀌면 이전 게임의 세트가 남지 않도록 함께 비운다.
            onChange={(e) => {
              patch({ game_id: e.target.value, set_id: "" });
              setSelectedKeywords([]);
            }}
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name_ko}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field
          label="세트"
          htmlFor="card-set"
          hint={availableSets.length === 0 ? "이 게임에 등록된 세트가 없습니다." : undefined}
        >
          <NativeSelect
            id="card-set"
            value={values.set_id}
            onChange={(e) => setValue("set_id", e.target.value)}
          >
            <option value="">(세트 없음)</option>
            {availableSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {setDisplayName(s)}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {TEXT_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            htmlFor={`card-${f.key}`}
            hint={"hint" in f ? f.hint : undefined}
            required={"required" in f ? f.required : undefined}
          >
            <TextInput
              id={`card-${f.key}`}
              value={values[f.key]}
              onChange={(e) => setValue(f.key, e.target.value)}
            />
          </Field>
        ))}
      </div>

      <Field label="이미지 URL" htmlFor="card-image_url">
        <TextInput
          id="card-image_url"
          value={values.image_url}
          onChange={(e) => setValue("image_url", e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">효과 키워드</span>
        {availableKeywords.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            이 게임에 등록된 키워드가 없습니다. 키워드 등록에서 먼저 만드세요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {availableKeywords.map((k) => {
              const active = selectedKeywords.includes(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleKeyword(k.id)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {k.label_ko}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Field label="효과 텍스트" htmlFor="card-effect_text" hint="검색 대상에 포함됩니다.">
        <TextArea
          id="card-effect_text"
          value={values.effect_text}
          onChange={(e) => setValue("effect_text", e.target.value)}
        />
      </Field>

      <StatusMessage status={status} />

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중…" : isEdit ? "저장" : "카드 등록"}
      </Button>
    </form>
  );
}
