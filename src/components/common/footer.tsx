export function Footer() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <p className="text-xs leading-relaxed text-muted-foreground">
          본 서비스는 공식 포켓몬 · 원피스 TCG 유통사와 연관이 없는 팬 메이드
          서포팅 툴입니다. 제공되는 중고 매물 시세 및 정보는 외부 거래
          플랫폼의 데이터를 파싱한 것으로, 실제 거래 결과 및 구매 행위에 대한
          책임을 지지 않습니다.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} DeckBinder
        </p>
      </div>
    </footer>
  );
}
