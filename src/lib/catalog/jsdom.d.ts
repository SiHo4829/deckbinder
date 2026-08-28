/**
 * `jsdom`(devDependency)에는 번들 타입 선언이 없고 `@types/jsdom`도
 * 설치돼 있지 않다 — 새 의존성을 추가하지 않는다(작업 지시). `parse.ts`가
 * 실제로 쓰는 표면(`new JSDOM(html).window.document`)만 최소로 선언한다.
 */
declare module "jsdom" {
  export class JSDOM {
    constructor(html: string, options?: Record<string, unknown>);
    readonly window: { readonly document: Document };
  }
}
