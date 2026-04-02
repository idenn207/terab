# NAS 도메인 연결 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DSM Application Portal을 진입점으로 사용해 `drive.skypark207.com`을 NAS의 terab 컨테이너와 연결한다.

**Architecture:** iptime 포트포워딩(80/443 → 192.168.0.10)은 유지하고, DSM 내장 nginx가 서브도메인별로 내부 컨테이너 포트로 프록시한다. terab-nginx 컨테이너를 호스트 8080 포트로 노출해 DSM이 접근할 수 있게 한다.

**Tech Stack:** Docker Compose, DSM 7.x Application Portal, Let's Encrypt (HTTP-01), Synology DDNS, Whois DNS

---

## 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `docker-compose.yml` | 수정 | `terab-nginx`에 `ports: - "8080:80"` 추가 |
| `.gitignore` | 수정 | `.superpowers/` 추가 |

DSM GUI 설정(인증서, Application Portal)은 NAS에서 직접 수행하며 코드베이스에 반영되지 않는다.

---

### Task 1: .gitignore에 .superpowers/ 추가

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore에 항목 추가**

`.gitignore` 파일을 열어 아래 줄을 추가한다:

```
# Superpowers brainstorming artifacts
.superpowers/
```

- [ ] **Step 2: 커밋**

```bash
git add .gitignore
git commit -m "chore: .superpowers/ gitignore 추가"
```

---

### Task 2: terab-nginx 포트 바인딩 추가

현재 `terab-nginx`에 `ports` 설정이 없어 DSM이 `localhost:8080`으로 접근해도 연결이 거부된다. 이것이 현재 `closed` 상태의 직접 원인이다.

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: docker-compose.yml 수정**

`nginx` 서비스에 `ports` 섹션을 추가한다:

```yaml
  # ─── Nginx (리버스 프록시) ───────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: terab-nginx
    restart: unless-stopped
    ports:
      - "8080:80"          # DSM Application Portal이 이 포트로 프록시
    volumes:
      - ${NGINX_CONF_PATH:-./services/nginx/nginx.conf}:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
      - web
    networks:
      - terab-net
```

- [ ] **Step 2: 변경 검증 (로컬에서 NAS 접속 가능한 경우)**

NAS SSH 또는 Container Manager에서 컨테이너를 재시작한다:

```bash
# NAS SSH 접속 후
cd /path/to/terab
docker compose down nginx
docker compose up -d nginx

# 포트 바인딩 확인
docker ps | grep terab-nginx
# 출력 예시: terab-nginx   nginx:alpine   ...   0.0.0.0:8080->80/tcp
```

NAS 내부에서 응답 확인:

```bash
curl -s -o /dev/null -w "%{http_code}" http://192.168.0.10:8080/
# 200 또는 301 이면 정상
```

- [ ] **Step 3: 커밋**

```bash
git add docker-compose.yml
git commit -m "feat: terab-nginx 호스트 포트 8080 바인딩 추가"
```

---

### Task 3: DSM Let's Encrypt 인증서 발급

**전제 조건 확인:**
- iptime 포트포워딩: 80 → 192.168.0.10:80 (이미 설정됨)
- Whois DNS: `drive.skypark207.com` CNAME → `skypark207.synology.me` (이미 설정됨)
- DSM DDNS가 현재 공인 IP를 가리키고 있을 것

- [ ] **Step 1: DSM 제어판 → 보안 → 인증서 접속**

```
DSM 메뉴 → 제어판 → 보안 → 인증서 탭
```

- [ ] **Step 2: 인증서 추가**

```
[추가] 버튼 클릭
→ "새 인증서 추가" 선택
→ [다음]
→ "Let's Encrypt에서 인증서 가져오기" 선택
→ [다음]
```

- [ ] **Step 3: 도메인 정보 입력**

```
도메인 이름: drive.skypark207.com
이메일: (본인 이메일)
주제 대체 이름: (비워둠 — 개별 발급이므로 불필요)
```

[적용] 클릭 → DSM이 HTTP-01 챌린지를 수행하고 인증서를 발급받는다.

발급에 약 30초~2분 소요된다. 성공 시 인증서 목록에 `drive.skypark207.com`이 나타난다.

**실패 시 체크리스트:**
1. iptime에서 외부 80 포트 → 192.168.0.10:80 포트포워딩 활성화 여부 확인
2. `drive.skypark207.com`이 실제로 현재 공인 IP를 가리키는지 확인:
   ```bash
   nslookup drive.skypark207.com
   # skypark207.synology.me를 거쳐 공인 IP가 나와야 함
   ```
3. DSM 방화벽에서 외부 80 포트 허용 여부 확인 (제어판 → 보안 → 방화벽)

---

### Task 4: DSM Application Portal 역방향 프록시 규칙 추가

- [ ] **Step 1: Application Portal 접속**

```
DSM 메뉴 → 제어판 → 응용 프로그램 포털 → 역방향 프록시 탭
```

- [ ] **Step 2: 규칙 생성**

[만들기] 버튼 클릭 후 아래와 같이 입력한다:

**소스 (외부에서 들어오는 요청):**
```
프로토콜: HTTPS
호스트 이름: drive.skypark207.com
포트: 443
```

**대상 (내부 컨테이너로 전달):**
```
프로토콜: HTTP
호스트 이름: localhost
포트: 8080
```

[저장] 클릭

- [ ] **Step 3: 커스텀 헤더 추가**

생성된 규칙 선택 → [편집] → [커스텀 헤더] 탭:

```
[만들기] → "WebSocket" 선택 → 자동으로 아래 헤더가 추가됨:
  Upgrade: $http_upgrade
  Connection: $connection_upgrade
```

추가로 수동 헤더 추가:

```
이름: X-Forwarded-Proto    값: $scheme
이름: X-Real-IP            값: $remote_addr
```

[저장]

- [ ] **Step 4: 인증서 할당 확인**

```
DSM → 제어판 → 보안 → 인증서
→ [설정] 버튼 클릭
→ 서비스 목록에서 역방향 프록시(drive.skypark207.com)를 찾아
  "drive.skypark207.com" 인증서가 선택되어 있는지 확인
→ 다르면 선택 후 [확인]
```

---

### Task 5: 종단 검증

- [ ] **Step 1: HTTP → HTTPS 리다이렉트 확인**

```bash
curl -v http://drive.skypark207.com/
# Location: https://drive.skypark207.com/ 헤더가 있어야 함
```

- [ ] **Step 2: HTTPS 응답 확인**

```bash
curl -s -o /dev/null -w "%{http_code}" https://drive.skypark207.com/
# 200 이면 정상
```

인증서 정보 확인:

```bash
curl -v https://drive.skypark207.com/ 2>&1 | grep -E "subject|issuer|expire"
# issuer: Let's Encrypt 이어야 함
```

- [ ] **Step 3: API 엔드포인트 확인**

```bash
curl -s -o /dev/null -w "%{http_code}" https://drive.skypark207.com/api/actuator/health
# 200 이면 Spring Boot API 정상 연결
```

- [ ] **Step 4: 브라우저 확인**

브라우저에서 `https://drive.skypark207.com` 접속:
- 자물쇠 아이콘 (HTTPS) 확인
- React 앱 정상 로딩 확인

- [ ] **Step 5: 최종 커밋 (변경사항 없으면 생략)**

```bash
git status
# 변경사항 있을 경우에만 커밋
```

---

## 향후 서비스 추가 체크리스트

새 서비스(예: `media.skypark207.com`) 추가 시:

1. **Whois**: `media.skypark207.com` CNAME → `skypark207.synology.me` 추가
2. **docker-compose**: 해당 서비스 nginx에 `ports: - "8081:80"` 추가 (포트 번호 증가)
3. **DSM 인증서**: `media.skypark207.com` Let's Encrypt 개별 발급
4. **DSM Application Portal**: `media.skypark207.com:443 → localhost:8081` 규칙 추가
5. **인증서 할당**: 새 규칙에 새 인증서 할당 확인
