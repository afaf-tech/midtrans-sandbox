const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'transactions.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function write(txs) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(txs, null, 2));
}

function add(tx) {
  const all = read();
  all.push(tx);
  write(all);
  return tx;
}

function setStatus(orderId, status) {
  const all = read();
  const found = all.find((t) => t.order_id === orderId);
  if (!found) return null;
  found.status = status;
  found.updated_at = new Date().toISOString();
  write(all);
  return found;
}

// newest first
function list() {
  return read().slice().reverse();
}

module.exports = { add, setStatus, list };
