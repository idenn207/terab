package com.nasdrive.api.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 통합 테스트 베이스 클래스.
 * Testcontainers의 PostgreSQL, MinIO를 Spring Context에 동적 주입한다.
 *
 * 사용법: 통합 테스트 클래스에서 이 클래스를 상속하면 된다.
 * <pre>
 * class MyIntegrationTest extends IntegrationTestBase {
 *     @Test void myTest() { ... }
 * }
 * </pre>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("integration")
public abstract class IntegrationTestBase {

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        // PostgreSQL
        registry.add("spring.datasource.url", TestContainersConfig.POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", TestContainersConfig.POSTGRES::getUsername);
        registry.add("spring.datasource.password", TestContainersConfig.POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");

        // MinIO
        registry.add("minio.endpoint", () ->
                "http://" + TestContainersConfig.MINIO.getHost() + ":"
                        + TestContainersConfig.MINIO.getMappedPort(9000));
        registry.add("minio.access-key", () -> "minioadmin");
        registry.add("minio.secret-key", () -> "minioadmin");
        registry.add("minio.bucket", () -> "test-bucket");
    }
}
