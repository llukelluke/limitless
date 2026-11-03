# Builds the whole app into one image: the React site is served by Spring Boot.

# 1. Build the React frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
# The calculator is installed from a release file kept in the repo
COPY frontend/vendor ./vendor
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Build the Spring Boot jar with the frontend inside it (Java 25 matches pom.xml)
FROM eclipse-temurin:25-jdk AS backend
WORKDIR /app/backend
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN sh mvnw -q dependency:go-offline
COPY backend/src src
COPY --from=frontend /app/frontend/dist src/main/resources/static
RUN sh mvnw -q -DskipTests package

# 3. Run it
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=backend /app/backend/target/*.jar app.jar
ENV SPRING_PROFILES_ACTIVE=prod
# Let the JVM use most of the container's memory limit
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
