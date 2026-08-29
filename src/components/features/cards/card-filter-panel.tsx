"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { KeywordFilter } from "@/components/features/cards/keyword-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { CONTROL_CLASS_SM } from "@/lib/utils/form";
import type { CardFacets } from "@/types/card";

const ALL = "__all__";

// 원피스는 opcg-kr·opcg-jp로 갈렸다(plan §4.12). opcg-jp는 아직 빈 게임 행이라
// 목록에 넣지 않는다 — 넣으면 고를 수 있고 고르면 무조건 0건이 된다. JP 데이터가
// 실제로 들어오면(§4.12 ⓘ-1, 이번 범위 밖) 그때 항목을 추가한다. 지금은 패싯
// 기반으로 바꾸지 않는다 — 게임 목록은 2행(사실상 3행 중 데이터 있는 2행)뿐이라
// 패싯 쿼리를 추가하는 비용이 하드코딩 유지보다 크다(plan §4.12 ⓗ 위임 판정).
const GAME_OPTIONS = [
  { value: ALL, label: "전체 게임" },
  { value: "ptcg", label: "포켓몬" },
  { value: "opcg-kr", label: "원피스" },
];

export interface CardFilters {
  q: string;
  game: string;
  cardType: string;
  rarity: string;
  attribute: string;
  set: string;
  keywords: string[];
}

interface Props {
  filters: CardFilters;
  facets: CardFacets | undefined;
  onChange: (patch: Partial<CardFilters>) => void;
}

/** 선택지가 없으면 셀렉트 자체를 감춘다. 빈 드롭다운은 혼란만 준다. */
function FacetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className="sm:w-40" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label} 전체</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CardFilterPanel({ filters, facets, onChange }: Props) {
  // 타이핑마다 요청하지 않도록 입력을 로컬에 두고 지연 반영한다.
  const [draft, setDraft] = useState(filters.q);

  // 외부(URL)에서 q가 바뀌면 렌더 중에 맞춘다.
  // effect에서 setState 하면 react-hooks/set-state-in-effect에 걸린다.
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setDraft(filters.q);
  }

  useEffect(() => {
    if (draft === filters.q) return;
    const timer = setTimeout(() => onChange({ q: draft }), 300);
    return () => clearTimeout(timer);
  }, [draft, filters.q, onChange]);

  const toOptions = (values: { value: string; count: number }[]) =>
    values.map((v) => ({ value: v.value, label: `${v.value} (${v.count})` }));

  function toggleKeyword(code: string) {
    onChange({
      keywords: filters.keywords.includes(code)
        ? filters.keywords.filter((c) => c !== code)
        : [...filters.keywords, code],
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="카드 이름으로 검색 (일본어·한국어)"
            aria-label="카드 이름 검색"
            className={cn(CONTROL_CLASS_SM, "py-0 pr-3 pl-9")}
          />
        </div>

        <Select
          value={filters.game || ALL}
          // 게임이 바뀌면 이전 게임의 선택지가 남지 않도록 하위 필터를 비운다.
          onValueChange={(v) =>
            onChange({
              game: v === ALL ? "" : v,
              rarity: "",
              attribute: "",
              cardType: "",
              set: "",
              keywords: [],
            })
          }
        >
          <SelectTrigger className="sm:w-36" aria-label="게임 선택">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GAME_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <FacetSelect
          label="종류"
          value={filters.cardType}
          options={toOptions(facets?.cardType ?? [])}
          onChange={(v) => onChange({ cardType: v })}
        />
        <FacetSelect
          label="레어도"
          value={filters.rarity}
          options={toOptions(facets?.rarity ?? [])}
          onChange={(v) => onChange({ rarity: v })}
        />
        <FacetSelect
          label="속성"
          value={filters.attribute}
          options={toOptions(facets?.attribute ?? [])}
          onChange={(v) => onChange({ attribute: v })}
        />
        <FacetSelect
          label="발매 팩"
          value={filters.set}
          options={(facets?.sets ?? []).map((s) => ({
            value: s.id,
            label: `${s.code} · ${s.label}`,
          }))}
          onChange={(v) => onChange({ set: v })}
        />
      </div>

      <KeywordFilter
        keywords={facets?.keywords ?? []}
        selected={filters.keywords}
        onToggle={toggleKeyword}
        onClear={() => onChange({ keywords: [] })}
      />
    </div>
  );
}
