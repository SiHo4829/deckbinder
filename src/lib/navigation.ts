export interface NavItem {
  href: string;
  label: string;
}

/** 헤더 데스크톱 내비와 모바일 시트가 공유하는 주 내비게이션 정의 */
export const mainNav: NavItem[] = [
  { href: "/cards", label: "카드 도감" },
  { href: "/decks", label: "덱 레시피" },
  { href: "/binder", label: "내 바인더" },
  { href: "/news", label: "뉴스" },
];
