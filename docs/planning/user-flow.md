# NAS Drive 유저 플로우

## 플로우 1: 회원가입 (앱 우선 가입)

> ID 기반 가입, 이메일은 선택(알림용). 초대 링크 → 딥링크 → 모바일 앱에서 가입. 가입 시 디바이스 자동 등록 + 백업 코드 발급.

```mermaid
flowchart TD
    Start([관리자가 초대 링크 생성]) --> Link[초대 링크 전달]
    Link --> Click[수신자: 초대 링크 클릭]
    Click --> AppCheck{앱 설치 여부}
    AppCheck -->|설치됨| DeepLink[딥링크로 앱 실행]
    AppCheck -->|미설치| Store[앱스토어 이동<br/>스마트 배너]
    Store --> Install[앱 설치 후 링크 재클릭]
    Install --> DeepLink
    DeepLink --> Form[회원가입 폼<br/>아이디 · 닉네임 · 이메일 선택 · 비밀번호]
    Form --> Validate{입력값 검증}
    Validate -->|실패| Error[오류 메시지 표시]
    Error --> Form
    Validate -->|성공| Create["계정 생성 (USER 역할 기본 부여)"]
    Create --> Device[디바이스 자동 등록<br/>Push 토큰 서버 전송]
    Device --> Backup[백업 코드 8개 표시<br/>안전 보관 안내]
    Backup --> Login[자동 로그인]
    Login --> Dashboard([드라이브 메인])
```

## 플로우 2: 로그인 (Push 2FA)

> ID + PW 1차 인증 → Push 2FA 숫자 매칭(비신뢰기기) → JWT 발급. 신뢰기기는 2FA 스킵. 앱은 생체인증으로 간편 로그인.

```mermaid
flowchart TD
    Start([drive.skypark207.com 접속]) --> Check{토큰 존재?}
    Check -->|유효한 토큰| Dashboard([드라이브 메인])
    Check -->|없음/만료| Platform{플랫폼}

    Platform -->|PC Web| LoginPage[로그인 페이지]
    Platform -->|모바일 앱| BioCheck{생체인증<br/>활성화?}

    BioCheck -->|활성화| Bio[지문/Face ID 검증]
    Bio -->|성공| RefreshAuth[Refresh Token 검증]
    RefreshAuth -->|유효| Dashboard
    RefreshAuth -->|만료| LoginPage
    BioCheck -->|비활성화| LoginPage

    LoginPage --> Input[ID + PW 입력]
    Input --> Auth{1차 인증 검증}
    Auth -->|실패| Error[오류 메시지]
    Error --> Input
    Auth -->|성공| TrustCheck{신뢰기기?}

    TrustCheck -->|신뢰기기 30일 이내| Token[JWT 토큰 발급<br/>Access + Refresh]
    TrustCheck -->|비신뢰기기| Push2FA[Push 2FA 요청<br/>PC에 2자리 숫자 표시]

    Push2FA --> MobileVerify{모바일에서<br/>숫자 매칭 승인}
    MobileVerify -->|승인| Token
    MobileVerify -->|거부| Denied[로그인 거부]
    MobileVerify -->|타임아웃 60초| Retry{재시도?}
    Retry -->|다시 보내기| Push2FA
    Retry -->|백업 코드| BackupCode[백업 코드 입력<br/>1회용 코드 검증]
    BackupCode -->|성공| Token
    BackupCode -->|실패| Error2[코드 오류 메시지]
    Error2 --> BackupCode

    Token --> Dashboard
```

## 플로우 2a: 모바일 2FA 승인

> PC 로그인 시 모바일 앱에서 Push 알림을 받아 숫자 매칭으로 승인/거부하는 플로우.

```mermaid
flowchart TD
    Start([PC에서 로그인 시도]) --> PushCheck{Push 알림<br/>활성화?}

    PushCheck -->|활성화| Push[Push 알림 수신<br/>로그인 요청 알림]
    PushCheck -->|비활성화| AppOpen[앱 직접 실행]
    AppOpen --> Poll[대기 챌린지 자동 감지<br/>GET /auth/2fa/pending]

    Push --> OpenApp[알림 탭 → 앱 실행]
    OpenApp --> AuthScreen[2FA 승인 화면]
    Poll -->|챌린지 존재| AuthScreen

    AuthScreen --> Info[요청 정보 확인<br/>접속 IP · 시간]
    Info --> NumberInput[PC에 표시된 숫자 입력]
    NumberInput --> Action{사용자 선택}

    Action -->|승인 + 숫자 일치| Approve["승인 전송<br/>POST /auth/2fa/verify<br/>{action: approve}"]
    Action -->|승인 + 숫자 불일치| Mismatch[숫자 불일치 오류]
    Mismatch --> NumberInput
    Action -->|거부| Deny["거부 전송<br/>POST /auth/2fa/verify<br/>{action: deny}"]

    Approve --> PCLogin([PC에서 로그인 완료<br/>WebSocket → JWT 전달])
    Deny --> PCDenied([PC에서 로그인 거부 표시])
```

## 플로우 3: 파일 업로드

```mermaid
flowchart TD
    Start([드라이브 메인]) --> Action{업로드 방식}
    Action -->|드래그 & 드롭| Drop[파일 드롭 영역에 놓기]
    Action -->|버튼 클릭| Select[파일 선택 다이얼로그]
    Drop --> FileCheck{파일 검증<br/>용량 · 쿼터}
    Select --> FileCheck
    FileCheck -->|쿼터 초과| QuotaError[용량 초과 안내]
    FileCheck -->|통과| Upload[업로드 시작<br/>진행률 표시]
    Upload --> Result{업로드 결과}
    Result -->|성공| Refresh[파일 목록 갱신]
    Result -->|실패| Retry[재시도 안내]
    Refresh --> End([현재 폴더 목록])
```

## 플로우 4: 파일/폴더 관리

```mermaid
flowchart TD
    Start([드라이브 메인]) --> Browse[폴더 탐색<br/>파일 목록 조회]
    Browse --> Select[파일/폴더 선택]
    Select --> Action{액션 선택}

    Action -->|새 폴더| NewFolder[폴더 이름 입력 → 생성]
    Action -->|이름 변경| Rename[인라인 편집 → 저장]
    Action -->|이동| Move[이동 대상 폴더 선택 → 이동]
    Action -->|복사| Copy[복사 대상 폴더 선택 → 복사]
    Action -->|삭제| Delete[삭제 확인 → 휴지통 이동]
    Action -->|다운로드| Download{선택 수}

    Download -->|단일| SingleDL[파일 다운로드]
    Download -->|다중| ZipDL[ZIP 묶음 다운로드]

    NewFolder --> Browse
    Rename --> Browse
    Move --> Browse
    Copy --> Browse
    Delete --> Browse
    SingleDL --> Browse
    ZipDL --> Browse
```

## 플로우 5: 공유 링크 생성 및 접근

```mermaid
flowchart TD
    subgraph Owner["공유 생성 - 로그인 사용자"]
        Start([파일/폴더 선택]) --> ShareBtn[공유 버튼 클릭]
        ShareBtn --> Options[공유 설정<br/>만료일 · 비밀번호 선택]
        Options --> Generate[공유 링크 생성]
        Generate --> CopyLink[링크 복사]
        CopyLink --> Send([링크 전달])
    end

    subgraph Visitor["링크 접근 - 비로그인"]
        Access([공유 링크 클릭]) --> CheckLink{링크 검증}
        CheckLink -->|만료됨| Expired[만료 안내 페이지]
        CheckLink -->|유효| PwCheck{비밀번호 설정?}
        PwCheck -->|없음| Preview[파일/폴더 목록 표시]
        PwCheck -->|있음| PwInput[비밀번호 입력]
        PwInput --> PwAuth{비밀번호 검증}
        PwAuth -->|실패| PwError[오류 메시지]
        PwError --> PwInput
        PwAuth -->|성공| Preview
        Preview --> Download[파일 다운로드]
    end
```

## 플로우 6: 관리자 — 사용자 및 권한 관리

```mermaid
flowchart TD
    Start([admin.drive.skypark207.com 접속]) --> Auth{관리 권한 확인}
    Auth -->|권한 없음| Denied[접근 거부]
    Auth -->|권한 있음| Dashboard[관리자 대시보드]

    Dashboard --> Action{관리 메뉴}

    Action -->|사용자 관리| UserList[사용자 목록 조회<br/>이름 · 이메일 · 상태 · 역할 · 사용량]
    Action -->|사용자 초대| Invite[초대 링크/코드 생성 → 전달]
    Action -->|스토리지| Storage[전체 사용량 대시보드<br/>사용자별 점유율]
    Action -->|공유 관리| Shares[활성 공유 링크 목록]
    Action -->|시스템| System[CPU · 메모리 · 디스크 모니터링]
    Action -->|설정| Settings[회원가입 정책 · 기본값 변경]
    Action -->|감사 로그| Audit[사용자 활동 로그 조회]
    Action -->|권한 관리| RoleMgmt[역할/권한 관리]

    UserList --> UserAction{사용자 액션}
    UserAction -->|역할 부여| AssignRole[역할 선택 → 부여<br/>복수 역할 가능]
    UserAction -->|비활성화| Deactivate[계정 비활성화]
    UserAction -->|쿼터 설정| Quota[용량 제한 설정]
    UserAction -->|삭제| DeleteUser[계정 영구 삭제]

    RoleMgmt --> RoleAction{역할 액션}
    RoleAction -->|역할 목록| RoleList[OWNER · ADMIN · USER · 커스텀]
    RoleAction -->|역할 생성| CreateRole[역할 이름 입력<br/>권한 체크박스 선택 → 저장]
    RoleAction -->|역할 수정| EditRole[권한 추가/제거 → 저장]
    RoleAction -->|역할 삭제| DeleteRole{해당 역할 사용자 존재?}
    DeleteRole -->|있음| Warn[경고: N명 영향<br/>대체 역할 선택 필요]
    DeleteRole -->|없음| Confirm[삭제 확인 → 삭제]

    Shares --> ShareAction{공유 링크 액션}
    ShareAction -->|강제 만료| Expire[링크 즉시 비활성화]
```
