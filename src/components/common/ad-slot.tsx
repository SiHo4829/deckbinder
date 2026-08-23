import Script from "next/script";

import { clientEnv } from "@/lib/env";
import { cn } from "@/lib/utils/cn";

/**
 * 애드센스 광고 자리.
 *
 * 퍼블리셔 ID가 없으면 **아무것도 렌더하지 않는다.** 승인 전에는 빈 자리도 남기지 않는다.
 * 승인 후 `NEXT_PUBLIC_ADSENSE_CLIENT`만 채우면 동작한다.
 */
export function AdSlot({ slot, className }: { slot: string; className?: string }) {
  const client = clientEnv.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;

  return (
    <div className={cn("min-h-[100px]", className)}>
      <Script
        id="adsense"
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      />
      <ins
        className="adsbygoogle block"
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
