// `server-only`의 실제 패키지는 exports 맵의 default 조건이 `index.js`(throw 전용)를
// 가리켜, vitest(environment: jsdom)에서 import하는 즉시 터진다(plan §2.7).
// vitest.config.mts가 이 파일로 별칭 처리해 `src/lib/admin/**`을 단위 테스트할 수 있게 한다.
export {};
