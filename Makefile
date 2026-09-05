.PHONY: dev api web seed test lint build check migrate

dev: ## Start db, api and web with Docker Compose
	docker compose up --build

api: ## Run the API locally (expects Postgres on localhost:5432)
	cd apps/api && uv run python manage.py runserver

web: ## Run the web app locally
	pnpm --filter web dev

seed: ## Recreate local demo data in the running Docker stack
	docker compose exec api uv run python manage.py seed_demo

migrate:
	cd apps/api && uv run python manage.py migrate

test: ## Run every test suite
	cd apps/api && uv run pytest
	pnpm turbo run test

lint: ## Lint and typecheck everything
	cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run python manage.py check && uv run python manage.py makemigrations --check --dry-run
	pnpm format:check
	pnpm turbo run lint typecheck

build: ## Build the web and mobile clients
	pnpm build

check: lint test build ## Run all validation and builds
