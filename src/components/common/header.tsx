import Link from "next/link";

import { MainNav } from "@/components/common/main-nav";
import { MobileNav } from "@/components/common/mobile-nav";
import { ThemeToggle } from "@/components/common/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
        <MobileNav />
        <Link href="/" className="mr-2 flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight">
            🎴 덱바인더
          </span>
        </Link>
        <MainNav />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
