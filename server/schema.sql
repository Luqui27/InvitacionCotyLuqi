CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  guest_first_name TEXT NOT NULL,
  guest_last_name TEXT NOT NULL,
  attending BOOLEAN NOT NULL,
  ticket_chargeable BOOLEAN NOT NULL DEFAULT TRUE,
  dietary_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS companions (
  id TEXT PRIMARY KEY,
  rsvp_id TEXT NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position IN (1, 2)),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  ticket_chargeable BOOLEAN NOT NULL DEFAULT TRUE,
  dietary_notes TEXT,
  UNIQUE (rsvp_id, position)
);

CREATE INDEX IF NOT EXISTS companions_rsvp_id_idx ON companions(rsvp_id);

ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS ticket_chargeable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE companions ADD COLUMN IF NOT EXISTS ticket_chargeable BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  rsvp_id TEXT NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
  amount_ars BIGINT NOT NULL CHECK (amount_ars > 0),
  paid_at DATE NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS payments_rsvp_id_idx ON payments(rsvp_id);

ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
