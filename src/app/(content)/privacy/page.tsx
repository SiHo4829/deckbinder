import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "덱바인더가 수집하는 정보와 이용 방법, 쿠키 및 광고 관련 사항을 안내합니다.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE_DATE = "2026년 8월 23일";
const CONTACT = "jsh040829@gmail.com";

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

export default function PrivacyPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-muted-foreground">시행일: {EFFECTIVE_DATE}</p>

      <p className="mt-6 text-sm leading-relaxed">
        덱바인더(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 중요하게 생각하며,
        「개인정보 보호법」을 준수합니다. 본 방침은 서비스가 어떤 정보를 수집하고
        어떻게 이용하는지 안내합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목과 목적">
        <p>
          서비스는 회원가입 없이 이용할 수 있으며, 현재 이름·연락처 등을 직접
          수집하지 않습니다. 다음 정보가 자동으로 처리됩니다.
        </p>
        <table className="mt-3 w-full text-xs">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">항목</th>
              <th className="py-2 pr-3 font-medium">목적</th>
              <th className="py-2 font-medium">보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-3">IP 주소의 암호화 해시</td>
              <td className="py-2 pr-3">
                중고 매물 조회 횟수 제한(과도한 자동 수집 방지)
              </td>
              <td className="py-2">30일</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-3">쿠키·로컬 저장소</td>
              <td className="py-2 pr-3">화면 테마 설정 유지, 관리자 로그인 유지</td>
              <td className="py-2">최대 12시간 / 이용자 삭제 시까지</td>
            </tr>
          </tbody>
        </table>
        <p>
          IP 주소는 원문을 저장하지 않고 복원이 불가능한 해시 형태로만 기록합니다.
        </p>
      </Section>

      <Section title="2. 개인정보의 제3자 제공 및 처리 위탁">
        <p>서비스는 개인정보를 판매하지 않으며, 아래 업체에 처리를 위탁합니다.</p>
        <table className="mt-3 w-full text-xs">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">수탁자</th>
              <th className="py-2 font-medium">위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-3">Supabase</td>
              <td className="py-2">데이터베이스 호스팅</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-3">Google LLC</td>
              <td className="py-2">광고 게재(Google AdSense)</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="3. 쿠키 및 광고 (Google AdSense)">
        <p>
          서비스는 Google을 포함한 제3자 공급업체의 광고를 게재할 수 있습니다. 이때
          다음 사항이 적용됩니다.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Google을 포함한 제3자 공급업체는 쿠키·웹 비콘·기기 식별자를 사용해 광고를
            게재합니다.
          </li>
          <li>
            Google은 광고 쿠키(DoubleClick 쿠키 등)를 사용하여 이용자의 <strong>본
            서비스 및 다른 웹사이트 방문 기록</strong>에 기반한 광고를 게재합니다.
          </li>
          <li>
            이용자는{" "}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Google 광고 설정
            </a>
            에서 맞춤 광고를 거부할 수 있습니다. 또한{" "}
            <a
              href="https://www.aboutads.info/choices"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              aboutads.info
            </a>
            에서 제3자 공급업체의 쿠키 사용을 일괄 거부할 수 있습니다.
          </li>
          <li>제3자 공급업체에는 각 업체의 개인정보처리방침이 적용됩니다.</li>
        </ul>
        <p>
          쿠키 저장을 원하지 않으시면 브라우저 설정에서 쿠키를 차단할 수 있습니다.
          다만 이 경우 테마 설정 유지 등 일부 기능이 제한될 수 있습니다.
        </p>
      </Section>

      <Section title="4. 정보주체의 권리와 행사 방법">
        <p>
          이용자는 개인정보의 열람·정정·삭제·처리정지를 요구할 수 있습니다. 아래
          연락처로 요청하시면 지체 없이 조치합니다.
        </p>
      </Section>

      <Section title="5. 개인정보의 파기">
        <p>
          보유 기간이 지나거나 처리 목적이 달성되면 지체 없이 파기합니다. 전자적
          파일은 복구할 수 없는 방법으로 영구 삭제합니다.
        </p>
      </Section>

      <Section title="6. 안전성 확보 조치">
        <p>
          접근 권한 최소화, 전송 구간 암호화(HTTPS), 데이터베이스 행 수준 접근 제어를
          적용하고 있습니다.
        </p>
      </Section>

      <Section title="7. 개인정보 보호책임자">
        <p>
          문의: <span className="font-mono">{CONTACT}</span>
        </p>
      </Section>

      <Section title="8. 권익침해 구제방법">
        <ul className="ml-5 list-disc space-y-1">
          <li>개인정보분쟁조정위원회 — 1833-6972 (kopico.go.kr)</li>
          <li>개인정보침해신고센터 — 118 (privacy.kisa.or.kr)</li>
          <li>대검찰청 사이버수사과 — 1301</li>
          <li>경찰청 사이버수사국 — 182</li>
        </ul>
      </Section>

      <Section title="9. 방침 변경">
        <p>
          본 방침이 변경되는 경우 시행일과 변경 내용을 이 페이지에 공지합니다. 향후
          소셜 로그인이 도입되면 수집 항목이 추가되며, 그 시점에 본 방침을 갱신합니다.
        </p>
      </Section>
    </div>
  );
}
