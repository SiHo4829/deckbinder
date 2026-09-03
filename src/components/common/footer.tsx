import Link from "next/link";

import { footerNav, mainNav } from "@/lib/navigation";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-[15px] font-semibold tracking-tight">덱바인더</p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
              포켓몬 · 원피스 TCG 플레이어와 컬렉터를 위한 서포팅 플랫폼. 카드 정보와
              자체 수집 점수를 한곳에서 확인하세요.
            </p>
          </div>

          <div>
            <p className="eyebrow">서비스</p>
            <ul className="mt-3 space-y-2">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow">정보</p>
            <nav aria-label="사이트 정보" className="mt-3 flex flex-col gap-2">
              {footerNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-10 border-t pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            공식 포켓몬 · 원피스 TCG 유통사와 무관한 팬 메이드 서포팅 툴입니다. 표시되는
            수집 점수는 자체 산출값이며 금전적 가치를 뜻하지 않습니다.{" "}
            <Link href="/disclaimer" className="underline underline-offset-2">
              자세히
            </Link>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            © {new Date().getFullYear()} DeckBinder
          </p>
        </div>
      </div>
    </footer>
  );
}
