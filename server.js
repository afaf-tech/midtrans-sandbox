require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const midtransClient = require('midtrans-client');
const QRCode = require('qrcode');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const coreApi = new midtransClient.CoreApi({
  isProduction: false, // hardcoded sandbox — flip only together with production keys
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// POST /charge -> create a QRIS charge, return qr_string + QR image (data URL)
app.post('/charge', async (req, res) => {
  const amount = Number(req.body && req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'nominal tidak valid' });
  }

  // QRIS QR is acquirer-specific. Default to gopay; the frontend must scan
  // with the SAME e-wallet, or the app rejects the QR ("format QR tidak sesuai").
  const acquirer = req.body && req.body.acquirer ? req.body.acquirer : 'gopay';
  const supportedAcquirers = ['gopay', 'airpay shopee'];
  if (!supportedAcquirers.includes(acquirer)) {
    return res.status(400).json({ error: `acquirer tidak didukung: ${acquirer}` });
  }

  const orderId = `QRIS-${Date.now()}`;

  try {
    const chargeResponse = await coreApi.charge({
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      qris: {
        acquirer,
      },
    });

    // Newer QRIS charge responses include qr_string directly.
    // Older ones only expose a generate-qr-code action URL — fetch it as a fallback.
    let qrString = chargeResponse.qr_string;
    if (!qrString && Array.isArray(chargeResponse.actions)) {
      const action = chargeResponse.actions.find((a) => a.name === 'generate-qr-code');
      if (action && action.url) {
        const auth = `Basic ${Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64')}`;
        const qrRes = await fetch(action.url, { headers: { Authorization: auth } });
        const qrJson = await qrRes.json();
        qrString = qrJson.qr_string;
      }
    }

    if (!qrString) {
      return res
        .status(502)
        .json({ error: 'qr_string tidak ditemukan di response Midtrans', chargeResponse });
    }

    const qrDataUrl = await QRCode.toDataURL(qrString, { margin: 1, width: 320 });

    // Public URL to the QR PNG — paste this into the Midtrans QRIS simulator
    // ("QR Code Image Url" field). No auth required to fetch it.
    const qrCodeAction = Array.isArray(chargeResponse.actions)
      ? chargeResponse.actions.find((a) => a.name === 'generate-qr-code')
      : null;

    store.add({
      order_id: orderId,
      gross_amount: amount,
      acquirer,
      status: chargeResponse.transaction_status || 'pending',
      payment_type: 'qris',
      created_at: new Date().toISOString(),
    });

    res.json({
      order_id: orderId,
      qr_string: qrString,
      qr_code_url: qrCodeAction ? qrCodeAction.url : null,
      qr_data_url: qrDataUrl,
      status: chargeResponse.transaction_status,
    });
  } catch (err) {
    console.error('charge error:', err.ApiResponse || err.message);
    res.status(502).json({ error: err.ApiResponse || err.message });
  }
});

// GET /status/:orderId -> poll Midtrans transaction status
app.get('/status/:orderId', async (req, res) => {
  try {
    const status = await coreApi.transaction.status(req.params.orderId);
    store.setStatus(req.params.orderId, status.transaction_status);
    res.json(status);
  } catch (err) {
    console.error('status error:', err.ApiResponse || err.message);
    res.status(502).json({ error: err.ApiResponse || err.message });
  }
});

// POST /notification -> Midtrans payment webhook. Verify signature, then log.
app.post('/notification', (req, res) => {
  const n = req.body || {};
  const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type } = n;

  // Answer 200 immediately — Midtrans retries if it doesn't get a quick OK.
  res.status(200).json(n);

  // signature_key = SHA512(order_id + status_code + gross_amount + server_key)
  const expected = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${process.env.MIDTRANS_SERVER_KEY}`)
    .digest('hex');

  if (!signature_key || signature_key !== expected) {
    console.log(`🚫 webhook DITOLAK (signature tidak cocok): order_id=${order_id}`);
    return;
  }

  store.setStatus(order_id, transaction_status);

  console.log(
    `📥 webhook masuk: order_id=${order_id} | status=${transaction_status} | type=${payment_type} | amount=${gross_amount}`
  );
});

// GET /transactions -> list stored transactions (newest first)
app.get('/transactions', (req, res) => {
  res.json(store.list());
});

app.listen(PORT, () => {
  console.log(`QRIS sandbox running at http://localhost:${PORT}`);
});
