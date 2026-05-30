<!--
  디자인 변경(컴포넌트/페이지/widget 신설·수정) PR 전용 template.
  GitHub PR 작성 시 `?template=web-component.md` query 또는
  `gh pr create --template web-component.md` 로 라우팅됩니다.
  일반 PR 은 기본 PULL_REQUEST_TEMPLATE.md 를 사용하세요.
-->

## 요약
<!-- 이 PR의 목적을 한두 문장으로 설명해 주세요 -->

## 변경 내용
<!-- 주요 변경 사항을 목록으로 작성해 주세요 -->
-

## 변경 유형
- [ ] 새 기능 (feat)
- [ ] 버그 수정 (fix)
- [ ] 리팩토링 (refactor)
- [ ] 문서 (docs)
- [ ] 설정/환경 (chore)
- [ ] 테스트 (test)

## 테스트
<!-- 테스트 방법 및 결과를 작성해 주세요 -->
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] 수동 테스트 완료 (모바일 viewport 320·768 포함)

## 디자인 self-check
<!--
  mobile-ui-guide.md (`.claude/rules/ecc/web/mobile-ui-guide.md`) 와 cross-check 한 결과를 체크.
  체크박스 옆 빈칸에는 *어떻게 충족했는지* 한 줄 메모 (Material URL, token 이름, criterion 번호 등).
-->
- [ ] **§2.2** anatomy — Material 3 의 어느 component family 인지 한 줄 명시 (Material URL 또는 §2.2 표 row 이름):
- [ ] **§6.2** token utility 만 사용 (새 token 발명 0건). 새 token 필요 시 [tokens.css](../../services/web/src/shared/styles/tokens.css) 갱신 PR 분리하고 본 PR 본문에서 cross-link:
- [ ] **§4.1** WCAG 2.2 AA criterion 점검 — contrast 4.5:1 / focus-visible / target ≥ 48dp / `aria-live` (axe-core 또는 키보드 수동):
- [ ] **§2.3** motion token 만 사용 (`transform`/`opacity`/`clip-path`/`filter` 외 layout-bound property animate 0건, prefers-reduced-motion 처리):
- [ ] **§7.3** 금지 trend 의 시각 어휘 0건 (Bootstrap-style / Glassmorphism / Neumorphism / dark mode 강제 default / 장식 motion / carousel):
- [ ] **§5.5** family 톤 유지 — route prefix (`/auth/*` · `/drive/*` · `/admin/*`) 의 default 톤 cross-check, 위반 시 사유:
- [ ] **§9** Atomic 5단계 순서 (anatomy → token → a11y → motion → anti-template). 단계별로 *어떤 결정을 했는지* 1~2줄 메모:
  - anatomy:
  - token:
  - a11y:
  - motion:
  - anti-template:

## 참고 사항
<!-- 리뷰어가 알아야 할 추가 정보가 있으면 작성해 주세요 -->
