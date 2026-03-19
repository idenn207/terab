// ┌──────────────────────────────────────────────────────────────┐
// │ Unit Test Template                                           │
// │ 유틸 함수, 커스텀 훅 테스트용                                │
// │ 복사 후 파일명을 [대상].test.ts 로 변경하여 사용             │
// └──────────────────────────────────────────────────────────────┘

// import { yourFunction } from '../utils/yourFunction'

describe('yourFunction', () => {
  it('should return expected result for valid input', () => {
    // Arrange
    // const input = 'test'
    // Act
    // const result = yourFunction(input)
    // Assert
    // expect(result).toBe('expected')
  });

  it('should handle edge case', () => {
    // Arrange
    // Act
    // Assert
  });

  it('should throw for invalid input', () => {
    // expect(() => yourFunction(null)).toThrow()
  });
});

// ──────────────────────────────────────────────────────────────
// 커스텀 훅 테스트 예시 (renderHook 사용)
// ──────────────────────────────────────────────────────────────

// import { renderHook, act } from '@testing-library/react'
// import { useCounter } from '../hooks/useCounter'
//
// describe('useCounter', () => {
//   it('should increment counter', () => {
//     const { result } = renderHook(() => useCounter())
//
//     act(() => {
//       result.current.increment()
//     })
//
//     expect(result.current.count).toBe(1)
//   })
// })
