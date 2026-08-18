.PHONY: help dev build preview lint lint-fix test clean install update check

# ──────────────────────────────────────────────
# Default
# ──────────────────────────────────────────────
help: ## Show this help
	@echo "JQZZ Frontend — Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────
install: ## Install npm dependencies
	npm install

update: ## Update all dependencies
	npm update

# ──────────────────────────────────────────────
# Development
# ──────────────────────────────────────────────
dev: ## Start Vite dev server with HMR
	npm run dev

# ──────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────
build: ## Type-check and build for production
	npm run build

build-only: ## Build without type-checking
	npx vite build

preview: ## Preview production build locally
	npm run preview

# ──────────────────────────────────────────────
# Lint & Format
# ──────────────────────────────────────────────
lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npx eslint . --fix

# ──────────────────────────────────────────────
# Type Check
# ──────────────────────────────────────────────
check: ## Run TypeScript type-check only (no emit)
	npx tsc --noEmit

# ──────────────────────────────────────────────
# Test
# ──────────────────────────────────────────────
test: ## Run tests (if configured)
	npx vitest run || echo "No test runner configured yet"

test-watch: ## Run tests in watch mode
	npx vitest || echo "No test runner configured yet"

# ──────────────────────────────────────────────
# Clean
# ──────────────────────────────────────────────
clean: ## Remove build artifacts
	rm -rf dist
	rm -rf node_modules/.cache

clean-all: ## Remove all generated files
	rm -rf dist node_modules

# ──────────────────────────────────────────────
# Docker
# ──────────────────────────────────────────────
docker-build: ## Build Docker image
	docker build -t jqzz-frontend .

# ──────────────────────────────────────────────
# Analysis
# ──────────────────────────────────────────────
analyze: build ## Analyze bundle size
	@echo "Build output:"
	@ls -lh dist/assets/ 2>/dev/null || echo "No build output found"
