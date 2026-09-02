# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Midtrans **sandbox** web app: user enters an amount, the backend creates a QRIS charge, and the frontend renders the returned `qr_string` as a QR code. A payer scans it with an e-wallet (GoPay/OVO/DANA); the frontend polls transaction status until settlement. Everything runs locally.

Stack: Node.js + Express backend, static HTML/JS frontend (no build step), `midtrans-client` and `qrcode` npm packages. Requires Node >= 18.

## Commands

- `npm install` — install dependencies
- `npm start` — run the server (`node server.js`)
- `npm run dev` — run with auto-reload (`node --watch server.js`)
- Server listens on `http://localhost:3000` (override with `PORT`).

## Configuration

Copy `.env.example` to `.env` and fill sandbox keys from the Midtrans dashboard (Dashboard → Settings → Access Keys), choosing the `SB-` prefixed ones:

```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
PORT=3000
```

## Architecture

- `server.js` — the entire backend. Four endpoints:
  - `POST /charge` — validates `amount` + `acquirer` (`gopay` | `airpay shopee`), creates a QRIS charge via `midtrans-client` `CoreApi.charge()`, extracts `qr_string` (direct `chargeResponse.qr_string`, falling back to the `generate-qr-code` action URL when absent), and returns `{ order_id, qr_string, qr_code_url, qr_data_url, status }`. `qr_code_url` is the `generate-qr-code` action URL (a public PNG of the QR); `qr_data_url` is a locally generated QR image. Each charge is persisted via `store.add()`.
  - `GET /status/:orderId` — proxies `CoreApi.transaction.status()` and syncs the stored status via `store.setStatus()`.
  - `POST /notification` — Midtrans webhook. Responds `200` immediately, verifies `signature_key` (SHA512 of `order_id + status_code + gross_amount + server_key`), then logs `📥 webhook masuk` and updates the stored status via `store.setStatus()`. Needs a public tunnel to receive real notifications.
  - `GET /transactions` — returns stored transactions (newest first).
- `store.js` — tiny JSON-file store (`data/transactions.json`). `add()` on charge, `setStatus()` on webhook/status-poll, `list()` for the history page.
- `public/index.html` — single-page frontend. Submits the amount → shows the QR → polls `/status/:orderId` every 3s until `settlement`/`capture` (success) or a terminal failure status.

## Key constraints (Midtrans)

- **Backend is required** — the **Server Key** is secret and must never reach the frontend. Only the **Client Key** is public.
- **Sandbox endpoint** is hardcoded via `isProduction: false` in the `CoreApi` config; only flip it together with production keys.
- **QRIS response shape** varies by Midtrans version — prefer `chargeResponse.qr_string`, but keep the `generate-qr-code` action fallback (already implemented in `server.js`).
- **Simulating payment (sandbox):** the Midtrans QRIS simulator at `simulator.sandbox.midtrans.com/v2/qris` wants the **`qr_code_url`** (the `generate-qr-code` action URL) in its "QR Code Image Url" field — NOT the raw `qr_string`. Pasting `qr_string` there fails with "QR inputted unparsable". After "Scan QR" → "Pay", the transaction flips to `settlement`, which the frontend's polling detects.
- **Webhooks:** the app polls `/status` for local-only runs, but `POST /notification` also exists. To receive real webhooks locally, expose the server with `cloudflared tunnel --url http://localhost:3000` and set Midtrans dashboard's **Payment Notification URL** to `https://<tunnel>.trycloudflare.com/notification`. The webhook is signed; `server.js` verifies `signature_key` before logging.
