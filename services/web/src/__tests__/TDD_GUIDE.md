# Frontend TDD 가이드라인

## 테스트 유형

### 1. Unit Test (단위 테스트)

- **대상**: 유틸 함수, 커스텀 훅, 상태 로직
- **도구**: Vitest
- **DOM 필요**: 없음 (순수 로직)
- **속도**: 밀리초 단위

**언제 사용하나?**
- `formatFileSize()`, `parseDate()` 같은 유틸 함수
- `useAuth()`, `useFileUpload()` 같은 커스텀 훅
- 복잡한 상태 변환 로직

### 2. Component Test (컴포넌트 테스트)

- **대상**: React 컴포넌트의 렌더링과 사용자 인터랙션
- **도구**: Vitest + React Testing Library + @testing-library/user-event
- **DOM 필요**: jsdom
- **속도**: 밀리초~초 단위

**언제 사용하나?**
- 컴포넌트가 올바르게 렌더링되는지
- 버튼 클릭, 입력 등 사용자 인터랙션 후 기대 동작
- props에 따른 조건부 렌더링

**React Testing Library 철학**
> "테스트가 소프트웨어 사용 방식과 유사할수록 더 많은 신뢰를 줄 수 있다."

- 구현 디테일(state, ref, 내부 메서드)이 아닌 **사용자가 보는 것**을 테스트
- `getByRole`, `getByText`, `getByLabelText` 등 접근성 기반 쿼리 우선 사용
- `getByTestId`는 최후의 수단

### 3. API Mocking Test (API 연동 테스트)

- **대상**: API 호출을 포함하는 컴포넌트/훅
- **도구**: Vitest + React Testing Library + MSW
- **DOM 필요**: jsdom
- **속도**: 초 단위

**언제 사용하나?**
- 데이터 fetch 후 화면 렌더링
- 로딩/에러 상태 처리
- 폼 제출 후 API 응답 처리

**MSW 사용법**
```tsx
import { http, HttpResponse } from 'msw'
import { server } from '../test/mocks/server'

// 테스트별 핸들러 추가 (글로벌 핸들러보다 권장)
server.use(
  http.get('/api/files', () => {
    return HttpResponse.json([
      { id: 1, name: 'document.pdf', type: 'FILE' }
    ])
  })
)
```

## 테스트 작성 원칙

### Arrange-Act-Assert 패턴

```tsx
test('displays file name after upload', async () => {
  // Arrange - 준비
  render(<FileUploader />)

  // Act - 실행
  const input = screen.getByLabelText('파일 선택')
  await userEvent.upload(input, mockFile)

  // Assert - 검증
  expect(screen.getByText('document.pdf')).toBeInTheDocument()
})
```

### 네이밍 규칙

- `describe`: 테스트 대상 (컴포넌트명 또는 함수명)
- `it`/`test`: 기대 동작을 서술형으로
- 예: `renders file list when data is loaded`
- 예: `calls onDelete when delete button is clicked`

### 핵심 규칙

1. **사용자 관점 테스트**: DOM 구조가 아닌 사용자가 보고 하는 것을 기준으로
2. **비동기 대기**: `waitFor`, `findBy*` 사용 (setTimeout 사용 금지)
3. **테스트 격리**: 각 테스트는 독립적으로 실행 가능해야 함
4. **MSW 핸들러는 테스트별로**: `server.use()`로 테스트마다 필요한 API만 모킹

## 실행 명령어

```bash
# 전체 테스트 1회 실행
npm test

# Watch 모드 (개발 중 자동 재실행)
npm run test:watch

# 커버리지 리포트
npm run test:coverage

# 특정 파일만 실행
npx vitest run src/components/FileList.test.tsx

# 특정 패턴 매칭
npx vitest run --grep "FileList"
```

## 쿼리 우선순위 (React Testing Library)

1. `getByRole` — 접근성 역할 (button, heading, textbox 등)
2. `getByLabelText` — 폼 요소
3. `getByPlaceholderText` — 폼 요소 (label 없을 때)
4. `getByText` — 텍스트 콘텐츠
5. `getByDisplayValue` — 입력 값
6. `getByAltText` — 이미지
7. `getByTitle` — title 속성
8. `getByTestId` — 최후의 수단 (data-testid)

## 유틸리티

- `server` (`src/test/mocks/server.ts`): MSW 서버 인스턴스
- `handlers` (`src/test/mocks/handlers.ts`): 글로벌 API 핸들러
- `setup.ts` (`src/test/setup.ts`): jest-dom matchers + MSW lifecycle
