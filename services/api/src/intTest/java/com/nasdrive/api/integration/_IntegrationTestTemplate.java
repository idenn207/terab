package com.nasdrive.api.integration;

// ┌──────────────────────────────────────────────────────────────┐
// │ Integration Test Template                                     │
// │ 복사 후 Repository, Entity를 수정하여 사용                    │
// │ 사용 후 이 주석 블록을 삭제하세요                             │
// └──────────────────────────────────────────────────────────────┘

import com.nasdrive.api.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional  // 각 테스트 후 자동 롤백 → 테스트 격리 보장
class _IntegrationTestTemplate extends IntegrationTestBase {

    // @Autowired
    // YourRepository yourRepository;

    @Nested
    @DisplayName("save")
    class Save {

        @Test
        void should_save_and_retrieve_entity() {
            // given
            // YourEntity entity = YourEntity.builder()
            //         .name("test")
            //         .build();

            // when
            // YourEntity saved = yourRepository.save(entity);

            // then
            // assertThat(saved.getId()).isNotNull();
            // assertThat(yourRepository.findById(saved.getId())).isPresent();
        }
    }

    @Nested
    @DisplayName("findBy")
    class FindBy {

        @Test
        void should_find_by_custom_query() {
            // given - 테스트 데이터 준비

            // when - 커스텀 쿼리 실행

            // then - 결과 검증
        }
    }
}
