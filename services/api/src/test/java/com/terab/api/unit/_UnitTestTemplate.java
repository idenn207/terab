package com.terab.api.unit;

// ┌──────────────────────────────────────────────────────────────┐
// │ Unit Test Template                                           │
// │ 복사 후 클래스명, 대상 서비스, 테스트 메서드를 수정하여 사용  │
// │ 사용 후 이 주석 블록을 삭제하세요                            │
// └──────────────────────────────────────────────────────────────┘

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
// import org.mockito.InjectMocks;
// import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

// import static org.assertj.core.api.Assertions.assertThat;
// import static org.assertj.core.api.Assertions.assertThatThrownBy;
// import static org.mockito.BDDMockito.given;
// import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class _UnitTestTemplate {

    // @Mock
    // YourRepository yourRepository;

    // @InjectMocks
    // YourService yourService;

    @Nested
    @DisplayName("메서드명")
    class DescribeMethodName {

        @Test
        void should_do_something_when_condition() {
            // given

            // when

            // then
        }

        @Test
        void should_throw_when_invalid_input() {
            // given

            // when & then
            // assertThatThrownBy(() -> yourService.method(invalidInput))
            //         .isInstanceOf(IllegalArgumentException.class)
            //         .hasMessageContaining("expected message");
        }
    }
}
