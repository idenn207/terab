// vitest-axe v0.1 의 `Vi` namespace 확장은 vitest 4 의 새 매처 타입 시스템과 매칭되지
// 않는다 — 4 의 매처는 `@vitest/expect` 의 `Matchers<T>` 를 module augmentation 해야
// 모든 Assertion 에 자동 노출된다. (vitest-axe 가 vitest 4 호환 release 를 내기 전까지의
// 임시 ambient.)
import 'vitest';

declare module '@vitest/expect' {
  interface Matchers<T = any> {
    toHaveNoViolations(): T;
  }
}

// vitest-axe v0.1 의 matchers.d.ts 는 `toHaveNoViolations` 를 `export { ... as t }` 별칭으로만
// 노출 → verbatimModuleSyntax 가 *type-only export* 로 잘못 판정한다. 실제 .js 는 runtime 함수.
// 여기서 module declaration 을 덮어써 *value* 로 명시 재선언.
declare module 'vitest-axe/matchers' {
  export function toHaveNoViolations(results: unknown): {
    actual: unknown;
    message: () => string | undefined;
    pass: boolean;
  };
}
