import Link from "next/link";

import { footerNav } from "@/lib/navigation";

export function Footer() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <nav aria-label="사이트 정보" className="flex flex-wrap gap-x-4 gap-y-2">
          {footerNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          공식 포켓몬 · 원피스 TCG 유통사와 무관한 팬 메이드 서포팅 툴입니다. 표시되는
          시세는 참고값이며 실제 거래를 보증하지 않습니다.{" "}
          <Link href="/disclaimer" className="underline underline-offset-2">
            자세히
          </Link>
        </p>

        <p className="mt-3 text-xs text-muted-foreground">
          © {new Date().getFullYear()} DeckBinder
        </p>
      </div>
    </footer>
  );
}
