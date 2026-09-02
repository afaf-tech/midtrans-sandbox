.PHONY: install setup run dev clean

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
