/**
 * `jsdom`(devDependency)에는 번들 타입 선언이 없고 `@types/jsdom`도
 * 설치돼 있지 않다 — 새 의존성을 추가하지 않는다(작업 지시). `parse.ts`가
 * 실제로 쓰는 표면(`new JSDOM(html).window.document`)만 최소로 선언한다.
 *
 * `VirtualConsole`은 E-3(jsdom CSS 잡음 억제)에서 같은 방식으로 덧붙였다 —
 * 선언만 늘리고 의존성은 늘리지 않는다(plan §8 백로그 E-3 ⓐ).
 */
declare module "jsdom" {
  /** `jsdomError`로 올라오는 오류. `type`은 jsdom이 붙이는 분류 문자열이다. */
  export interface JSDOMError extends Error {
    /** 예: CSS 파싱 실패는 `"css parsing"`. 다른 신호에는 없을 수 있다. */
    readonly type?: string;
    /** CSS 파싱 실패일 때 스타일시트 전문이 들어온다. */
    readonly detail?: string;
  }

  export class VirtualConsole {
    constructor();
    on(event: "jsdomError", listener: (error: JSDOMError) => void): this;
    emit(event: "jsdomError", error: JSDOMError): boolean;
    sendTo(anyConsole: Console, options?: { omitJSDOMErrors?: boolean }): this;
  }

  export interface JSDOMOptions {
    readonly virtualConsole?: VirtualConsole;
  }

  export class JSDOM {
    constructor(html: string, options?: JSDOMOptions);
    readonly window: { readonly document: Document };
  }
}
