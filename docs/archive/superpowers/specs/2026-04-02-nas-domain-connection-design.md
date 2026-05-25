# NAS 도메인 연결 시스템 설계

**날짜:** 2026-04-02  
**상태:** 승인됨

---

## 개요

Synology NAS(DSM 7.x)에 배포된 Docker 컨테이너를 커스텀 도메인(skypark207.com)과 연결하는 네트워크 구조를 정의한다. DSM Application Portal을 진입점으로 사용해 서브도메인별 트래픽을 각 컨테이너로 라우팅한다.

---

## 시스템 정보

| 항목 | 값 |
|------|-----|
| NAS OS | DSM 7.x |
| NAS 내부 IP | 192.168.0.10 |
| 공유기 | iptime A2004SE |
| DDNS 공급자 | Synology |
| DDNS 도메인 | skypark207.synology.me |
| DNS 공급자 | Whois |
| 커스텀 도메인 | skypark207.com |

---

## 트래픽 흐름

```
클라이언트
  ↓ drive.skypark207.com (HTTPS:443)
Whois DNS — CNAME → skypark207.synology.me
  ↓
Synology DDNS — 공인 IP 자동 추적
  ↓ 80 / 443
iptime A2004SE — 포트포워딩 → 192.168.0.10
  ↓
DSM nginx (192.168.0.10:80/443) — Application Portal 역방향 프록시
  ├─ drive.skypark207.com → localhost:8080 (terab-nginx 컨테이너)
  └─ media.skypark207.com → localhost:8081 (nas-media 컨테이너, 향후)
          ↓
  terab-nginx (:8080)
    ├─ /api/* → terab-api:8080 (Spring Boot)
    └─ /*     → terab-web:80  (React SPA)
```

---

## 컴포넌트별 설계

### 1. DNS / DDNS 레이어

- **Whois**: `drive.skypark207.com` CNAME → `skypark207.synology.me`
- **Synology DDNS**: DSM 내장 DDNS 클라이언트가 공인 IP 변경 시 자동 업데이트
- **iptime**: 포트포워딩 80/443 → 192.168.0.10 (이미 설정됨, 변경 불필요)

새 서브도메인 추가 시 Whois에서 동일 패턴의 CNAME 레코드를 추가한다.

### 2. SSL 인증서

- **방식**: Let's Encrypt HTTP-01 (서브도메인별 개별 발급)
- **관리**: DSM 제어판 → 보안 → 인증서 → Let's Encrypt
- **갱신**: DSM이 만료 30일 전 자동 갱신
- **적용**: Application Portal 역방향 프록시 규칙에 인증서 자동 연결

HTTP-01 검증 경로(`/.well-known/acme-challenge/`)는 포트 80이 외부에서 NAS까지 연결되어 있어야 하므로 iptime 포트포워딩(80 → 192.168.0.10)이 필수 전제 조건이다.

### 3. DSM Application Portal (역방향 프록시)

**설정 위치**: DSM 제어판 → 응용 프로그램 포털 → 역방향 프록시

| 규칙 | 소스 | 대상 |
|------|------|------|
| terab (drive) | `https://drive.skypark207.com:443` | `http://localhost:8080` |
| nas-media (향후) | `https://media.skypark207.com:443` | `http://localhost:8081` |

**추가 설정**:
- WebSocket 지원: 활성화 (향후 실시간 기능 대비)
- 커스텀 헤더: `X-Forwarded-For`, `X-Real-IP` 전달 (Spring Boot에서 실제 클라이언트 IP 인식)

### 4. docker-compose.yml 변경

현재 `terab-nginx` 컨테이너에 포트 바인딩이 없어 DSM이 `localhost:8080`으로 접근할 수 없는 상태다.

**변경 전:**
```yaml
nginx:
  image: nginx:alpine
  container_name: terab-nginx
  # ports 없음
```

**변경 후:**
```yaml
nginx:
  image: nginx:alpine
  container_name: terab-nginx
  ports:
    - "8080:80"
```

이 변경 하나로 현재 `closed` 상태 문제가 해결된다.

### 5. 서비스별 포트 규칙

각 서비스는 고유한 호스트 포트를 사용한다. DSM Application Portal이 해당 포트로 프록시한다.

| 서비스 | 호스트 포트 | 컨테이너 포트 | 서브도메인 |
|--------|------------|--------------|----------|
| terab-nginx | 8080 | 80 | drive.skypark207.com |
| nas-media (향후) | 8081 | 80 | media.skypark207.com |

내부 서비스(DB, MinIO 등)는 호스트 포트를 노출하지 않고 Docker 내부 네트워크(`terab-net`)로만 통신한다.

---

## 향후 확장: VPN

외부에서 NAS 내부망에 직접 접근할 경우 VPN을 사용한다.

- **도구**: Synology VPN Server 패키지 (WireGuard 또는 OpenVPN) 또는 Tailscale
- **구조**: VPN 접속 후 `192.168.0.10`으로 DSM 및 컨테이너에 직접 접근 (포트포워딩 불필요)
- **보안 효과**: 공개 인터넷 노출 최소화, 민감 서비스는 VPN 전용으로 제한 가능

VPN 구성은 본 설계 범위 밖이며 별도 스펙으로 다룬다.

---

## 구현 순서

1. `docker-compose.yml` — `terab-nginx`에 `ports: - "8080:80"` 추가 후 재배포
2. DSM — Let's Encrypt 인증서 발급 (`drive.skypark207.com`)
3. DSM — Application Portal 역방향 프록시 규칙 추가
4. 검증 — `https://drive.skypark207.com` 접근 확인

---

## 제외 범위

- DSM 포트 변경 방식 (불필요)
- macvlan 네트워크 구성 (불필요)
- Cloudflare DNS 이전 (Whois 유지)
- 와일드카드 인증서 (서브도메인별 개별 발급으로 대체)
