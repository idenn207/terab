# ─── Stage 1: Build ─────────────────────────────────────────────
FROM eclipse-temurin:25-jdk-alpine AS builder

WORKDIR /app

# Gradle 9은 JAVA_HOME을 toolchain으로 자동 인식하지 않아 명시적으로 경로를 등록
RUN mkdir -p /root/.gradle && \
    echo "org.gradle.java.installations.paths=${JAVA_HOME}" > /root/.gradle/gradle.properties

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

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]