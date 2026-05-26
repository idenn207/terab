# Architecture Decision Records

이 디렉토리는 Terab 의 주요 아키텍처 결정을 기록한다. 각 ADR 은 결정 시점의 맥락·대안·결과를 영속화하여, 후속 결정이 동일한 trade-off 를 재학습하지 않도록 한다.

> 작성 가이드: [Michael Nygard ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record).
> 신규 ADR 은 `NNNN-kebab-title.md` 형식, 4자리 zero-padded 순번 사용.

## 작성 원칙

- **불변 기록**: 한 번 `accepted` 된 ADR 은 본문을 수정하지 않는다. 결정이 바뀌면 새 ADR 을 만들고 기존 ADR Status 를 `superseded by NNNN` 으로 갱신
- **5섹션 고정**: `Status / Context / Decision / Consequences / References`
- **Consequences 양면 기록**: Positive 만 적힌 ADR 은 trade-off 의 절반만 전달한다 — Negative·Mitigations 함께 기록
- **References 코드 경로**: 결정과 직접 연결된 구현 파일·PR·설계 문서를 링크. 코드 이동·삭제 시 ADR References 도 같은 PR 에서 갱신

## 목록

| # | 제목 | 상태 | 날짜 |
|---|---|---|---|
| 0001 | [ts-rest 제거 → Swagger + hey-api + TanStack Query](0001-ts-rest-removal-swagger-migration.md) | accepted | 2026-05-16 |
| 0002 | [2FA Strategy 패턴 (TOTP / Push / Backup Code)](0002-twofa-strategy-pattern.md) | accepted | 2026-05-20 |
| 0003 | [Storage SoT 를 NAS filesystem 으로 이전](0003-storage-sot-nas-filesystem.md) | proposed | 2026-05-27 |
| 0004 | [v1 은 iSCSI 우선 통합 · SMB 보류](0004-iscsi-priority-smb-deferred.md) | proposed | 2026-05-27 |
