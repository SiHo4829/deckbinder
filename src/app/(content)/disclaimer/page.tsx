import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "면책 조항",
  description:
    "덱바인더는 공식 유통사와 무관한 팬 메이드 서포팅 툴입니다. 시세 정보의 성격과 책임 범위를 안내합니다.",
  alternates: { canonical: "/disclaimer" },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function DisclaimerPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">면책 조항</h1>

      <Section title="공식 서비스가 아닙니다">
        <p>
          덱바인더는 포켓몬 카드 게임 · 원피스 카드 게임의 공식 유통사(주식회사
          포켓몬코리아, 반다이남코 등)와 아무런 제휴·후원·승인 관계가 없는{" "}
          <strong>팬 메이드 서포팅 툴</strong>입니다.
        </p>
      </Section>

      <Section title="저작권">
        <p>
          카드 이름 · 이미지 · 로고 등에 대한 모든 권리는 각 권리자에게 있습니다.
          서비스는 정보 제공을 목적으로 이를 인용하며, 권리자의 요청이 있을 경우
          해당 자료를 즉시 삭제합니다.
        </p>
      </Section>

      <Section title="시세 정보의 성격">
        <p>
          표시되는 기준가는 외부 거래 플랫폼의 공개 매물 정보를 집계한{" "}
          <strong>참고값</strong>이며, 실제 거래가를 보증하지 않습니다. 표본이
          부족한 경우 기준가를 산출하지 않고 &ldquo;산출 불가&rdquo;로 표기합니다.
        </p>
        <p>
          서비스는 <strong>투자·투기 목적의 정보를 제공하지 않습니다.</strong>{" "}
          시세 변동 차트나 등락률을 제공하지 않고 단일 기준가만 표기하는 것도 같은
          이유입니다. 이용자의 구매·판매 결정과 그 결과에 대해 서비스는 어떠한
          책임도 지지 않습니다.
        </p>
      </Section>

      <Section title="되팔이 목적이 아닙니다">
        <p>
          덱바인더는 순수한 플레이어와 수집가가 합리적인 가격에 카드를 구하도록
          돕기 위한 도구입니다. 대량 매입을 위한 자동 수집을 막기 위해 매물 조회는
          1회 1장으로 제한되며, 짧은 시간에 반복 조회할 수 없습니다.
        </p>
      </Section>

      <Section title="외부 사이트 정보 수집">
        <p>
          매물 정보는 각 거래 플랫폼의 공개 페이지에서 조회합니다. 수집 대상과
          준수 사항은 저장소의 수집 정책 문서에 기록하며, 각 사이트의 이용약관과
          robots.txt를 존중합니다.
        </p>
      </Section>

      <Section title="정보의 정확성">
        <p>
          카드 정보와 시세는 오류를 포함할 수 있으며, 예고 없이 변경되거나 서비스가
          중단될 수 있습니다. 잘못된 정보를 발견하시면 개인정보처리방침에 안내된
          연락처로 알려주시기 바랍니다.
        </p>
      </Section>
    </div>
  );
}
