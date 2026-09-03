import { cn } from "@/lib/utils/cn";
import type { RarityReason, RarityScore } from "@/lib/domain/achievement/rarity-score";

/**
 * 자체 희귀도 점수 배지 — 카드 상세 왼쪽 컬럼, 이미지 프레임 바로 아래.
 *
 * plan §4.13 ⓖ · T2.15의 화면 조각. **props는 도메인의 `RarityScore` 그대로다** —
 * 이 컴포넌트는 계산도 조회도 하지 않고 값을 받아 그리기만 한다. `"use client"`가
 * 없다 — 상호작용이 없다.
 *
 * ⚠️ 폐기된 시세 축이 있던 바로 그 자리다(`base-price-badge.tsx`, 걷어냄).
 * 화폐 단위 · 시계열 그래프 · 정렬 옵션을 만들지 않는다 — plan §1 P6 · §4.13 ⓖ.
 *
 * 호출부(developer 몫):
 * ```tsx
 * <RarityScoreBadge {...rarityScore(printingFacts, populationFacts)} />
 * ```
 */
export function RarityScoreBadge({ score, band, reasons, undecidable }: RarityScore) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-surface-raised p-4",
        score === null && "border-dashed",
      )}
    >
      <p className="eyebrow">덱바인더 자체 산정값</p>

      {score === null ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">산출 불가</p>
          <p className="text-xs text-muted-foreground">
            {undecidable ? UNDECIDABLE_MESSAGE[undecidable] : null}
          </p>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
          {band ? (
            <span className="text-xs text-muted-foreground">· {BAND_LABEL[band]}</span>
          ) : null}
        </div>
      )}

      {reasons.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-[--hairline] pt-3">
          {reasons.map((reason, i) => (
            <li key={`${reason.kind}-${i}`} className="text-[11px] leading-relaxed text-muted-foreground">
              {reasonText(reason)}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        덱바인더가 우리 카드 DB의 정보만으로 자체 계산한 참고용 값입니다. 어떤 기관의 공식
        등급이 아니며 금전적 가치를 뜻하지 않습니다.
      </p>
    </div>
  );
}

/**
 * 밴드 표기어. plan §4.13 ⓓ-6·확인#3 — 원천 라벨(C·UC·R·SR·L·SEC·SP·P)과 헷갈리면
 * 안 된다. "등급"·"감정"·"인증"처럼 공식 기관을 연상시키는 낱말을 피하고, 짧은
 * 명사가 아니라 서술형 어구를 골랐다 — 단어 하나짜리 명사는 그 자체로 "이름표"처럼
 * 읽히기 쉽지만 어구는 "우리가 설명을 붙인 것"으로 읽힌다.
 */
const BAND_LABEL: Record<NonNullable<RarityScore["band"]>, string> = {
  common: "흔한 편",
  uncommon: "덜 흔한 편",
  rare: "드문 편",
  scarce: "꽤 드묾",
  trophy: "손에 넣기 어려움",
};

const UNDECIDABLE_MESSAGE: Record<NonNullable<RarityScore["undecidable"]>, string> = {
  rarity_unknown: "레어도 라벨을 확인할 수 없어 점수를 낼 수 없습니다.",
  set_unknown: "세트 안에서의 위치를 확인할 수 없어 점수를 낼 수 없습니다.",
};

/**
 * `reasons` 값을 문장으로 바꾼다. `kind`별 표현만 고르고, 값에 없는 근거를
 * 덧붙이지 않는다(plan §4.13 ⓖ-2·6).
 */
function reasonText(reason: RarityReason): string {
  switch (reason.kind) {
    case "rarity_label":
      return `원천 레어도 라벨 "${reason.label}" 반영 (${reason.weight}점)`;
    case "scarce_in_set":
      return `같은 세트 카드 ${reason.setSize}장 가운데 같은 레어도 라벨을 가진 카드는 ${reason.peerCount}장`;
    case "alternate_printing":
      return `기본 인쇄본이 아님 — 같은 카드의 인쇄본 ${reason.printingsInGroup}종 가운데 하나`;
    case "illustration":
      return `일러스트 구분: ${reason.label}`;
    case "population":
      return `감정 등록 ${reason.graded}건`;
  }
}
