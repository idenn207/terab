# ─── Stage 1: Build ─────────────────────────────────────────────
FROM eclipse-temurin:25-jdk-alpine AS builder

WORKDIR /app

# Gradle 9은 JAVA_HOME을 toolchain으로 자동 인식하지 않아 명시적으로 경로를 등록
RUN mkdir -p /root/.gradle && \
    echo "org.gradle.java.installations.paths=${JAVA_HOME}" > /root/.gradle/gradle.properties

# Gradle wrapper & 의존성 캐시 (소스 변경 시 재다운로드 방지)
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew && ./gradlew dependencies --no-daemon

# 소스 복사 및 빌드
COPY src src
RUN ./gradlew bootJar --no-daemon -x test

# ─── Stage 2: Runtime ────────────────────────────────────────────
FROM eclipse-temurin:25-jre-alpine

WORKDIR /app

# wait-for-it.sh: bash 필요 (Alpine 기본 미포함)
RUN apk add --no-cache bash

# root 권한으로 스크립트 설치 (USER 전환 전)
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh && chmod +x /usr/local/bin/wait-for-it.sh

# Docker Secrets entrypoint wrapper
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

# 보안: non-root 사용자로 실행
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
