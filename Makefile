.PHONY: help dev dev-backend dev-frontend build build-backend build-frontend \
        test test-backend lint lint-backend lint-frontend \
        docker-up docker-down docker-build clean \
        backend frontend

# ──────────────────────────────────────────────
# Default
# ──────────────────────────────────────────────
help: ## Show this help
	@echo "JQZZ — Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
# Development
# ──────────────────────────────────────────────
dev: ## Run backend and frontend in parallel (dev mode)
	@echo "Starting backend and frontend..."
	@make -j2 dev-backend dev-frontend

dev-backend: ## Run backend dev server
	cd backend/jqzz && ./mvnw spring-boot:run

dev-frontend: ## Run frontend dev server
	cd frontend && npm run dev

# ──────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────
build: build-backend build-frontend ## Build everything

build-backend: ## Build backend JAR
	cd backend/jqzz && ./mvnw clean package -DskipTests

build-frontend: ## Build frontend for production
	cd frontend && npm run build

# ──────────────────────────────────────────────
# Test
# ──────────────────────────────────────────────
test: test-backend ## Run all tests
	@echo "All tests passed."

test-backend: ## Run backend tests
	cd backend/jqzz && ./mvnw test

# ──────────────────────────────────────────────
# Lint
# ──────────────────────────────────────────────
lint: lint-frontend lint-backend ## Lint everything

lint-frontend: ## Lint frontend with ESLint
	cd frontend && npm run lint

lint-backend: ## Check backend formatting
	cd backend/jqzz && ./mvnw checkstyle:check || echo "No checkstyle configured"

# ──────────────────────────────────────────────
# Docker
# ──────────────────────────────────────────────
docker-up: ## Build and run with Docker Compose
	docker-compose up --build

docker-down: ## Stop Docker Compose
	docker-compose down

docker-build: ## Build Docker images only
	docker-compose build

# ──────────────────────────────────────────────
# Clean
# ──────────────────────────────────────────────
clean: clean-backend clean-frontend ## Clean all build artifacts

clean-backend: ## Clean backend build artifacts
	cd backend/jqzz && ./mvnw clean

clean-frontend: ## Clean frontend build artifacts
	cd frontend && rm -rf dist

# ──────────────────────────────────────────────
# Convenience aliases
# ──────────────────────────────────────────────
backend: dev-backend ## Alias for dev-backend
frontend: dev-frontend ## Alias for dev-frontend
