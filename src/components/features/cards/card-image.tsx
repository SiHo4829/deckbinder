import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { cardDisplayName, type CardListItem } from "@/types/card";

/**
 * 카드 일러스트 한 장.
 *
 * 홈 쇼케이스 · 도감 그리드 · 대체 카드 · 상세 네 곳이 "이미지 있으면 img, 없으면
 * 격자 플레이스홀더"를 각자 적고 있었다. 자리마다 아이콘 크기와 호버만 달랐다.
 *
 * **이미지 없는 카드가 기본이다**(plan §4.4). 빈칸으로 두지 않고 코드를 얹어 정보로 만든다.
 *
 * 원격 이미지 호스팅 방침이 정해지면(§9.3) `next/image` 전환은 이 파일만 고치면 된다.
 * 바깥 테두리·radius·비율(`.aspect-card`)은 자리마다 달라 호출부에 남긴다.
 */
export function CardImage({
  card,
  showCode = false,
  iconClassName = "size-5",
  hoverClassName,
  priority = false,
}: {
  card: Pick<CardListItem, "code" | "image_url" | "name_ko" | "name_ja">;
  /** 이미지가 없을 때 카드 코드를 함께 보일지 */
  showCode?: boolean;
  /** 플레이스홀더 아이콘 크기 */
  iconClassName?: string;
  /** 호버 확대 (예: "group-hover:scale-105"). 없으면 정지한다 */
  hoverClassName?: string;
  /** 상세 페이지 대표 이미지처럼 화면에 바로 보이는 것은 lazy를 걸지 않는다 */
  priority?: boolean;
}) {
  if (card.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 원격 호스트 정책 미확정(§9.3)
      <img
        src={card.image_url}
        alt={cardDisplayName(card)}
        loading={priority ? "eager" : "lazy"}
        className={cn(
          "h-full w-full object-cover",
          hoverClassName && "transition-transform duration-500",
          hoverClassName,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "card-placeholder flex h-full w-full flex-col items-center justify-center",
        showCode && "gap-2 p-3",
      )}
    >
      <ImageOff className={cn(iconClassName, "text-muted-foreground/30")} aria-hidden />
      {showCode ? (
        <span className="text-center font-mono text-[10px] break-all text-muted-foreground/60">
          {card.code}
        </span>
      ) : null}
    </div>
  );
}
