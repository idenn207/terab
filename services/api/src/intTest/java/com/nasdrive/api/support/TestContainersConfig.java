package com.nasdrive.api.support;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 싱글톤 컨테이너 설정.
 * JVM 당 1회만 시작되며 모든 통합 테스트 클래스에서 재사용된다.
 */
public final class TestContainersConfig {

    public static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
                    .withDatabaseName("nas_test")
                    .withUsername("test")
                    .withPassword("test");

    @SuppressWarnings("resource")
    public static final GenericContainer<?> MINIO =
            new GenericContainer<>(DockerImageName.parse("minio/minio:latest"))
                    .withExposedPorts(9000)
                    .withEnv("MINIO_ROOT_USER", "minioadmin")
                    .withEnv("MINIO_ROOT_PASSWORD", "minioadmin")
                    .withCommand("server /data");

    static {
        POSTGRES.start();
        MINIO.start();
    }

    private TestContainersConfig() {
    }
}
