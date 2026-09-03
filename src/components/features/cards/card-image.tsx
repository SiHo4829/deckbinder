"use client";

import { useState } from "react";

import { cn } from "@/lib/utils/cn";
import { cardDisplayName, type CardListItem } from "@/types/card";

/**
 * 카드 일러스트 한 장.
 *
 * 홈 쇼케이스 · 도감 그리드 · 대체 카드 · 상세 네 곳이 "이미지 있으면 img, 없으면
 * 격자 플레이스홀더"를 각자 적고 있었다. 자리마다 아이콘 크기와 호버만 달랐다.
 *
 * **이미지 없는 카드가 기본이다**(plan §4.4). 빈칸으로 두지 않고 카드 정보를 얹어
 * 카드로 만든다.
 *
 * ---
 *
 * **왜 이 파일만 `"use client"`인가** — `CLAUDE.md`의 "RSC 기본" 예외다.
 * 핫링크 실패를 감지하는 `onError`는 클라이언트에서만 붙는다. 호출부 넷 중 셋이
 * RSC라 여기에 클라이언트 경계가 새로 생기지만, **props가 전부 직렬화 가능한
 * 원시값이라 계약은 그대로다.** 대안(서버에서 URL을 미리 검증)은 매 렌더마다
 * 외부 요청을 내는 것이라 plan §1 P2에 정면으로 걸린다.
 *
 * **`next/image`로 바꾸지 않는다** (plan §9.4 ⓓ). 이미지는 이제 `workers/image-proxy`
 * 리버스 프록시(T1.30 · T1.31)를 거쳐 우리 워커 도메인에서 나간다 — 원본을 대신
 * 받아오는 주체는 Next 서버가 아니라 그 워커다. "이미지 바이트를 저장하지 않는다"는
 * 경계(§9.4 ⓐ)는 여전히 유효하지만(워커는 캐시만 하고 저장하지 않는다), 그 경계를
 * 지키는 주어가 바뀌었다. **이미지 경로의 프록시는 워커 하나이고, Next의 최적화
 * 프록시를 그 위에 겹치지 않는다.**
 *
 * ⚠️ **`iconClassName` prop이 없어졌다.** 옛 플레이스홀더의 `ImageOff` 아이콘 크기를
 * 받던 것인데, §2.8-6이 "「이미지 없음」이라는 회색 자리표시로 보이면 안 된다"고
 * 정해 그 아이콘 자체가 사라졌다. **B-6 사양은 "호출부 무변경"이었으나 소비자가
 * 없는 prop을 남기면 다음 사람이 그것을 살아 있는 API로 읽는다** — 호출부 2곳
 * (`/cards/[cardId]` · `similar-cards`)에서 함께 뗐다.
 */
export function CardImage({
  card,
  showCode = false,
  hoverClassName,
  priority = false,
}: {
  card: Pick<CardListItem, "code" | "image_url" | "name_ko" | "name_ja" | "attribute">;
  /** 폴백 프레임에 카드 코드를 함께 보일지 */
  showCode?: boolean;
  /** 호버 확대 (예: "group-hover:scale-105"). 없으면 정지한다 */
  hoverClassName?: string;
  /** 상세 페이지 대표 이미지처럼 화면에 바로 보이는 것은 lazy를 걸지 않는다 */
  priority?: boolean;
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  // **URL 부재와 로드 실패는 같은 화면으로 간다** (plan §9.4 ⓑ). 분기를 나누면
  // 실패 경로가 드물게만 실행돼 깨져도 모르는 코드가 된다.
  if (!card.image_url || loadFailed) {
    return <CardFallbackFrame card={card} showCode={showCode} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image를 쓰지 않는다 (plan §9.4 ⓓ)
    <img
      src={card.image_url}
      alt={cardDisplayName(card)}
      loading={priority ? "eager" : "lazy"}
      // referrerPolicy를 싣지 않는다 — 브라우저는 이제 원천이 아니라 우리 워커
      // 도메인에 요청하므로 원천에 보내던 Referer를 감출 이유가 없다. 원천에 닿는
      // 것은 워커이고, 워커는 Referer를 위조하지 않는다 — 아예 보내지 않는다 (§3.5 ⓕ).
      onError={() => setLoadFailed(true)}
      // SSR로 내려간 <img>는 하이드레이션 전에 실패하면 onError를 놓친다 —
      // 리스너가 붙기 전에 error 이벤트가 끝나기 때문이다. 마운트 시 한 번 확인한다.
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setLoadFailed(true);
      }}
      className={cn(
        "h-full w-full object-cover",
        hoverClassName && "transition-transform duration-500",
        hoverClassName,
      )}
    />
  );
}

/**
 * 텍스트 기반 카드 프레임 — **방어 코드다** (plan §9.4 ⓑ · §2.8-6).
 *
 * 보증하는 것은 "한 장이 깨져도 흉하지 않다"가 아니라 **"전부 깨져도 서비스가
 * 성립한다"**이다. 핫링크가 막히는 날 이 화면이 도감·상세·대체 카드를 전부 받는다.
 *
 * ⚠️ **원본 일러스트를 흉내 내는 요소를 넣지 않는다.** 틀과 색은 우리 토큰으로만
 * 만든다 — 폴백이 원본처럼 보이면 §9.4 ⓐ가 그은 선을 화면에서 되돌리는 셈이 된다.
 */
function CardFallbackFrame({
  card,
  showCode,
}: {
  card: Pick<CardListItem, "code" | "name_ko" | "name_ja" | "attribute">;
  showCode: boolean;
}) {
  return (
    <div
      data-testid="card-fallback-frame"
      className="card-placeholder flex h-full w-full flex-col justify-between gap-2 p-3"
    >
      {/*
        카드명이 프레임의 유일한 필수 항목이다 — cardDisplayName이
        name_ko·name_ja 중 하나를 고른다(plan §9.4 ⓑ). T1.17 이후로는
        `name_ja` 단독의 not null 보장이 아니라 cards_name_present_ck(둘 중
        하나)가 그 자리를 대신한다(plan §4.8 ⓗ). 속성이 null이고 showCode가
        false여도 빈 상자가 되지 않는다.
      */}
      <p className="line-clamp-3 text-[11px] leading-snug font-medium text-balance text-foreground/80">
        {cardDisplayName(card)}
      </p>

      <div className="flex flex-col gap-1">
        {/*
          자유 텍스트라 번역하지 않고 원문을 그대로 낸다(plan §2.8-6). 매핑에 없는
          값에 물음표 아이콘을 만들지 않고, 값이 없으면 이 줄을 비운다.
        */}
        {card.attribute ? (
          <span className="w-fit rounded-sm border border-[--hairline] px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {card.attribute}
          </span>
        ) : null}
        {showCode ? (
          <span className="font-mono text-[10px] break-all text-muted-foreground/60">
            {card.code}
          </span>
        ) : null}
      </div>
    </div>
  );
}
