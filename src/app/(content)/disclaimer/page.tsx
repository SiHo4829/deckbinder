import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "면책 조항",
  description:
    "덱바인더는 포켓몬 · 원피스 카드 게임의 권리자 및 공식 유통사와 무관한 팬 메이드 서포팅 툴입니다. 고지 대상과 수집 점수의 성격, 책임 범위를 안내합니다.",
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
          덱바인더는 <strong>팬 메이드 서포팅 툴</strong>입니다. 아래 권리자 및
          공식 유통사 어느 쪽과도 제휴 · 후원 · 승인 관계가 없으며, 어느 쪽의
          검수도 받지 않았습니다.
        </p>
        <p>
          <strong>포켓몬 카드 게임</strong> — 주식회사 포켓몬 · 닌텐도 ·
          크리처스 · 게임프리크(저작권 표기 주체) · 주식회사 포켓몬코리아(국내
          유통).
        </p>
        <p>
          <strong>원피스 카드 게임</strong> — 오다 에이이치로 · 집영사 · 후지TV ·
          토에이 애니메이션(카드 일러스트의 저작권 표기 주체) · 주식회사
          반다이(발행 · 유통).
        </p>
        <p>
          이 목록은 카드와 각 공식 사이트에 <strong>실제로 표기된 이름</strong>을
          옮긴 것이고, 괄호는 각 이름의 역할입니다. 저작권 표기 주체와 발행 ·
          유통은 서로 다른 자격입니다. 여기에 적히지 않은 권리자가 있더라도 그
          권리를 부정하지 않습니다.
        </p>
      </Section>

      <Section title="저작권">
        <p>
          카드 이름 · 이미지 · 로고 등에 대한 모든 권리는 각 권리자에게 있습니다.
          서비스는 정보 제공을 목적으로 이를 인용하며, 권리자의 요청이 있을 경우
          해당 자료를 즉시 삭제합니다.
        </p>
      </Section>

      <Section title="수집 점수의 성격">
        <p>
          카드 상세에 표시되는 수집 점수는 <strong>덱바인더가 자체 계산한
          값</strong>이며, 어떤 기관의 공식 등급이 아닙니다. 금전적 가치를
          뜻하지 않으며, 산출에 필요한 정보가 부족한 경우 값을 지어내지 않고
          &ldquo;산출 불가&rdquo;로 표기합니다.
        </p>
        <p>
          서비스는 <strong>투자·투기 목적의 정보를 제공하지 않습니다.</strong>{" "}
          가격 표기·변동 차트·등락률을 제공하지 않는 것도 같은 이유입니다.
        </p>
      </Section>

      <Section title="되팔이 목적이 아닙니다">
        <p>
          덱바인더는 순수한 플레이어와 수집가를 위한 도구입니다. 가격 정보를
          다루지 않으므로 대량 매입을 위한 가격 스캔 자체가 성립하지
          않습니다.
        </p>
      </Section>

      <Section title="외부 사이트 정보 수집">
        <p>
          카드 정보는 각 게임의 공식 사이트 등 공개된 페이지에서 수집합니다.
          수집한 사이트와 각 사이트에서 확인한 이용 조건, 수집 요청에 적용하는
          규칙은 저장소의 수집 정책 문서에 기록합니다.
        </p>
        <p>
          수집 요청은 한 번에 한 건씩 순차로 보내고, 요청 사이에 간격을 두며,
          실행마다 총 요청 수에 상한을 둡니다. 사이트가 요청을 거부하거나
          실패가 연속되면 그 자리에서 중단합니다. 사이트 운영자 또는 권리자가
          수집 중지를 요청하면 해당 사이트에 대한 수집을 중지합니다.
        </p>
      </Section>

      <Section title="운영과 수익">
        <p>
          덱바인더는 <strong>광고 · 제휴 링크 · 후원 · 유료 기능을 두지
          않습니다.</strong> 운영 비용은 만든 사람이 부담합니다.
        </p>
      </Section>

      <Section title="정보의 정확성">
        <p>
          카드 정보와 수집 점수는 오류를 포함할 수 있으며, 예고 없이 변경되거나
          서비스가 중단될 수 있습니다. 잘못된 정보를 발견하시면
          개인정보처리방침에 안내된 연락처로 알려주시기 바랍니다.
        </p>
      </Section>
    </div>
  );
}
