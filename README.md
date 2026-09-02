# Midtrans Sandbox — Kirim Duit via QRIS

Demo web app buat bikin **QRIS QR code** dari nominal yang diinput, terus simulasi pembayarannya di **sandbox Midtrans**. Semua jalan lokal.

## Fitur

- Input nominal → generate QRIS QR code
- Pilih acquirer / e-wallet (GoPay, ShopeePay)
- Auto-deteksi status pembayaran (polling + webhook)
- Riwayat transaksi, tersimpan ke file JSON
- Verifikasi `signature_key` untuk webhook

## Tech stack

- **Node.js ≥ 18** + Express
- `midtrans-client` (SDK resmi Midtrans)
- `qrcode` (generate gambar QR)
- Frontend HTML/JS statis (tanpa build step)

## Prasyarat

- Node.js 18+
- Akun Midtrans + **Server Key** & **Client Key** sandbox
  - Daftar di [dashboard.sandbox.midtrans.com](https://dashboard.sandbox.midtrans.com)
  - Ambil key di **Settings → Access Keys**

## Setup

```bash
git clone <repo-url> && cd midtrans-sandbox
make setup        # npm install + bikin .env dari .env.example
```

Lalu isi `.env`:

```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
PORT=3000
```

Jalankan:

```bash
make run          # atau: npm start
```

Buka http://localhost:3000.

## Cara pakai

1. Input nominal → pilih e-wallet → klik **Buat QR Code**
2. QR muncul beserta URL buat simulator (tombol **Copy**)
3. Bayar / simulasikan pembayaran (lihat bawah)
4. Status berubah jadi **✅ Pembayaran sukses** & masuk ke riwayat

## Cara test pembayaran (sandbox)

Di sandbox, gak bisa scan pakai app e-wallet asli — pakai **simulator Midtrans**:

1. Buka [simulator.sandbox.midtrans.com/v2/qris](https://simulator.sandbox.midtrans.com/v2/qris)
2. Tempel **QR Code Image Url** dari halaman app (bukan string `000201...`-nya)
3. Klik **Scan QR** → pilih issuer → **Pay**
4. Transaksi jadi `settlement`, app auto-update

## Webhook (opsional — butuh tunnel publik)

App juga punya endpoint webhook. Biar Midtrans bisa kirim webhook ke `localhost`, expose pakai Cloudflare Tunnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

Lalu set **Payment Notification URL** di dashboard Midtrans ke:

```
https://<tunnel-mu>.trycloudflare.com/notification
```

Pas ada perubahan status, console bakal nampilin:

```
📥 webhook masuk: order_id=QRIS-... | status=settlement | type=qris | amount=10000.00
```

Webhook yang signature-nya gak cocok bakal di-ignore (`🚫 webhook DITOLAK`).

## Struktur proyek

```
.
├── server.js           # backend Express (semua endpoint)
├── store.js            # penyimpanan transaksi ke file JSON
├── public/index.html   # frontend statis
├── data/               # transaksi.json (auto, di-ignore git)
├── .env.example        # template key
├── Makefile            # shortcut: setup / run / dev / clean
└── CLAUDE.md           # panduan buat Claude Code
```

## Endpoint

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/charge` | Bikin charge QRIS (`amount`, `acquirer`) → balikin `qr_string`, `qr_code_url`, `qr_data_url` |
| `GET` | `/status/:orderId` | Cek status transaksi (polling) |
| `POST` | `/notification` | Webhook Midtrans (verifikasi signature + update status) |
| `GET` | `/transactions` | List transaksi (terbaru dulu) |

## Acquirer yang didukung

| Nilai | E-wallet |
|---|---|
| `gopay` | GoPay (default) |
| `airpay shopee` | ShopeePay |

> ⚠️ QRIS QR itu **spesifik per acquirer** — kalau QR GoPay di-scan pakai app lain, bakal ditolak ("format QR tidak sesuai").
