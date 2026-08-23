import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 기사 본문 렌더링.
 *
 * `rehype-raw`를 쓰지 않으므로 **raw HTML은 렌더되지 않는다.** 이 상태를 유지한다.
 * 관리자 토큰이 유출돼도 본문으로 스크립트를 주입할 수 없다.
 *
 * `@tailwindcss/typography`(prose) 대신 요소를 직접 매핑한다.
 * 의존성을 늘리지 않고 프로젝트 디자인 토큰·다크 모드를 그대로 쓰기 위해서다.
 */
const components: Components = {
  h1: (props) => <h2 className="mt-8 text-xl font-semibold tracking-tight" {...props} />,
  h2: (props) => <h2 className="mt-8 text-lg font-semibold tracking-tight" {...props} />,
  h3: (props) => <h3 className="mt-6 text-base font-semibold" {...props} />,
  p: (props) => <p className="mt-4 text-sm leading-relaxed" {...props} />,
  ul: (props) => <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" {...props} />,
  ol: (props) => <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: ({ href, ...props }) => {
    const external = typeof href === "string" && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className="underline underline-offset-2 hover:text-foreground"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
      />
    );
  },
  blockquote: (props) => (
    <blockquote
      className="mt-4 border-l-2 pl-4 text-sm text-muted-foreground"
      {...props}
    />
  ),
  code: (props) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  pre: (props) => (
    <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs" {...props} />
  ),
  hr: () => <hr className="my-8" />,
  table: (props) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b px-3 py-2 text-left font-medium" {...props} />,
  td: (props) => <td className="border-b px-3 py-2" {...props} />,
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element -- 본문 이미지는 외부 URL이다(§9.3)
    <img className="mt-4 max-w-full rounded-lg" alt={props.alt ?? ""} {...props} />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
