up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

rebuild:
	./scripts/rebuild.sh

logs:
	docker compose logs -f

health:
	./scripts/health.sh

clean:
	./scripts/clean.sh

ps:
	docker compose ps
