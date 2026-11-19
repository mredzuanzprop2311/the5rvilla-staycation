CREATE TABLE IF NOT EXISTS billplz_sandbox_payments (
  booking_id TEXT PRIMARY KEY,
  bill_id TEXT UNIQUE,
  payment_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('creating', 'pending', 'paid')),
  paid_at TEXT
);
