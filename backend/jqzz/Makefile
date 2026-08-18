.PHONY: help run build test clean install dev package jar watch

# ──────────────────────────────────────────────
# Default
# ──────────────────────────────────────────────
help: ## Show this help
	@echo "JQZZ Backend — Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────
run: ## Run the Spring Boot app
	./mvnw spring-boot:run

dev: ## Run with dev profile
	./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# ──────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────
build: ## Full build (compile + package + tests)
	./mvnw clean package

package: ## Build JAR without tests
	./mvnw clean package -DskipTests

install: ## Install to local Maven repo
	./mvnw clean install -DskipTests

jar: ## Build executable JAR
	./mvnw clean package -DskipTests
	@echo "JAR: target/$$(ls target/*.jar | head -1 | xargs basename)"

# ──────────────────────────────────────────────
# Test
# ──────────────────────────────────────────────
test: ## Run all tests
	./mvnw test

test-verbose: ## Run tests with verbose output
	./mvnw test -Dmaven.test.outputVerbosity=verbose

test-class: ## Run a specific test class (TEST_CLASS=FooTest)
	./mvnw test -Dtest=$(TEST_CLASS)

# ──────────────────────────────────────────────
# Code Quality
# ──────────────────────────────────────────────
checkstyle: ## Run checkstyle (if configured)
	./mvnw checkstyle:check || true

# ──────────────────────────────────────────────
# Database
# ──────────────────────────────────────────────
db-init: ## Initialize H2 in-memory DB
	@echo "Starting with H2 in-memory database..."
	./mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:h2:mem:testdb --spring.datasource.driverClassName=org.h2.Driver --spring.jpa.database-platform=org.hibernate.dialect.H2Dialect"

# ──────────────────────────────────────────────
# Clean
# ──────────────────────────────────────────────
clean: ## Clean build artifacts
	./mvnw clean

# ──────────────────────────────────────────────
# Dependencies
# ──────────────────────────────────────────────
deps: ## List dependency tree
	./mvnw dependency:tree

deps-updates: ## Check for dependency updates
	./mvnw versions:display-dependency-updates || true

# ──────────────────────────────────────────────
# Swagger
# ──────────────────────────────────────────────
docs: run ## Start server and open Swagger docs
	@echo "Swagger UI will be at http://localhost:8080/swagger-ui.html"
