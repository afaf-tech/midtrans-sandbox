.PHONY: install setup run dev clean docker-up docker-up-tunnel docker-down

## install dependencies saja
install:
	npm install

## install + siapkan .env dari .env.example (kalau belum ada)
setup: install
	@test -f .env || cp .env.example .env
	@echo "=> .env siap. Isi MIDTRANS_SERVER_KEY & MIDTRANS_CLIENT_KEY dulu ya."

## jalankan server (http://localhost:3000)
run:
	npm start

## jalankan server dengan auto-reload
dev:
	npm run dev

## hapus node_modules
clean:
	rm -rf node_modules

## jalankan pakai Docker Compose
docker-up:
	docker compose up -d --build

## jalankan Docker + Cloudflare Tunnel (butuh CLOUDFLARE_TUNNEL_TOKEN)
docker-up-tunnel:
	docker compose --profile tunnel up -d --build

## hentikan container Docker
docker-down:
	docker compose down
