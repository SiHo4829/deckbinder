"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

const GAME_OPTIONS = [
  { value: ALL, label: "전체 게임" },
  { value: "ptcg", label: "포켓몬" },
  { value: "opcg", label: "원피스" },
];

const CARD_TYPE_OPTIONS = [
  { value: ALL, label: "전체 종류" },
  { value: "Pokemon", label: "포켓몬" },
  { value: "Trainer", label: "트레이너" },
  { value: "Energy", label: "에너지" },
];

interface CardFilterPanelProps {
  q: string;
  game: string;
  cardType: string;
  onChange: (patch: { q?: string; game?: string; cardType?: string }) => void;
}

export function CardFilterPanel({ q, game, cardType, onChange }: CardFilterPanelProps) {
  // 타이핑마다 요청하지 않도록 입력을 로컬에 두고 지연 반영한다.
  const [draft, setDraft] = useState(q);

  // 외부(URL)에서 q가 바뀌면 렌더 중에 맞춘다.
  // effect에서 setState 하면 react-hooks/set-state-in-effect에 걸린다.
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }

  useEffect(() => {
    if (draft === q) return;
    const timer = setTimeout(() => onChange({ q: draft }), 300);
    return () => clearTimeout(timer);
  }, [draft, q, onChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="카드 이름으로 검색 (일본어·한국어)"
          aria-label="카드 이름 검색"
          className="h-9 w-full rounded-md border bg-transparent pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <Select
        value={game || ALL}
        onValueChange={(v) => onChange({ game: v === ALL ? "" : v })}
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

      <Select
        value={cardType || ALL}
        onValueChange={(v) => onChange({ cardType: v === ALL ? "" : v })}
      >
        <SelectTrigger className="sm:w-36" aria-label="카드 종류 선택">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CARD_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
