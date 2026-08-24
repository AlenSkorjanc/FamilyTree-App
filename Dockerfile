FROM node:22-alpine AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM eclipse-temurin:21-jdk-alpine AS backend-build
WORKDIR /workspace/backend
COPY backend/gradlew backend/gradlew.bat backend/settings.gradle.kts backend/build.gradle.kts ./
COPY backend/gradle/ ./gradle/
RUN chmod +x gradlew && ./gradlew dependencies --configuration runtimeClasspath --quiet --no-daemon >/dev/null
COPY backend/src/ ./src/
COPY --from=frontend-build /workspace/frontend/dist/ ./src/main/resources/static/
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine AS runtime
RUN addgroup -S familytree && adduser -S familytree -G familytree
WORKDIR /app
COPY --from=backend-build --chown=familytree:familytree /workspace/backend/build/libs/*.jar /app/application.jar
USER familytree
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70.0", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/application.jar"]
