# services/admin/CLAUDE.md

> 본 서비스는 [services/web/CLAUDE.md](../web/CLAUDE.md) 의 FSD 컨벤션을 그대로 상속한다. 본 파일은 차이점만 기재한다.

## services/web 과의 차이

| 항목 | services/web | services/admin |
|---|---|---|
| 도메인 | `drive.skypark207.com` | `admin.drive.skypark207.com` |
| 대상 사용자 | 모든 사용자 (다수) | NAS 운영자 (1~2명) |
| Swarm replicas | 2 | 1 |
| 모바일 (Capacitor) | ✅ Android WebView | ❌ 데스크탑 전용 |
| catalyst UI | ✅ (임시) | ❌ (M1) — M2 에서 도입 검토 |
| hey-api codegen | ✅ | ❌ (M1) — M2 에서 도입 |
| axios + react-query | ✅ | ❌ (M1) — M2 에서 도입 |
| react-router-dom | ✅ | ❌ (M1) — M2 에서 도입 |
| zustand store | ✅ | ❌ (M1) — M2 에서 도입 |

## M1 시점 FSD 레이어 상태

```
src/
  App.tsx       # 단일 placeholder 컴포넌트 (router 없음)
  main.tsx
  index.css     # TailwindCSS 4 import 1줄
  app/.gitkeep
  pages/.gitkeep
  widgets/.gitkeep
  features/.gitkeep
  entities/.gitkeep
  shared/.gitkeep
```

M2 (로그인) 진입 시 `app/providers/`, `app/router/`, `entities/user/`, `features/login-by-2fa/`, `pages/login/`, `shared/api/`, `shared/lib/utils/cn.ts` 가 채워진다.

## 의존성 정책

services/web 의 dependency 중 **본 서비스에 없는 항목**:

- `@capacitor/*` — 데스크탑 전용
- `@hey-api/client-axios`, `@hey-api/openapi-ts` — M2 에서 추가
- `axios`, `@tanstack/react-query` — M2 에서 추가
- `react-hook-form` — M2 에서 추가
- `react-router-dom` — M2 에서 라우트 도입 시 추가
- `zustand` — M2 에서 세션 store 도입 시 추가
- `motion`, `@headlessui/react`, `@heroicons/react`, `cva` — UI 패턴이 잡힐 때 검토
- `cross-env`, `msw` — Capacitor / MSW 기반 테스트 인프라 부재

services/web 의 dependency 중 **그대로 유지하는 항목**:

- React 19 본체 + Vite + TS + Vitest + ESLint + Prettier + TailwindCSS 4
- `clsx`, `tailwind-merge`, `prettier-plugin-tailwindcss` — utility 조합 패턴 일관성

## Claude 행동 지침 — admin 전용

- 새 기능을 추가하기 전에 services/web 에 동일한 패턴이 있는지 먼저 확인. 있다면 그 구조를 미러한다 (특히 FSD 레이어 배치, axios interceptor, hey-api wrapper 패턴).
- Capacitor / mobile 관련 코드는 본 서비스에 추가 금지.
- 운영자 1~2명 대상 UI 이므로 PWA / 모바일 반응형 / 다국어는 후순위. 데스크탑 1280px 우선.
- M2 진입 시 `services/web/src/app/providers/`, `services/web/src/shared/api/` 를 그대로 참조하여 axios interceptor + hey-api codegen 환경을 동일하게 구성한다.
