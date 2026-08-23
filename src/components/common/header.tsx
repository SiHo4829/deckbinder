import Link from "next/link";

import { MainNav } from "@/components/common/main-nav";
import { MobileNav } from "@/components/common/mobile-nav";
import { ThemeToggle } from "@/components/common/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <MobileNav />

        <Link href="/" className="mr-4 flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-tight">덱바인더</span>
          <span className="hidden text-[10px] font-medium tracking-widest text-muted-foreground uppercase sm:inline">
            DeckBinder
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
