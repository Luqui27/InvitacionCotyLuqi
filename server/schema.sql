CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  guest_first_name TEXT NOT NULL,
  guest_last_name TEXT NOT NULL,
  attending BOOLEAN NOT NULL,
  dietary_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS companions (
  id TEXT PRIMARY KEY,
  rsvp_id TEXT NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position IN (1, 2)),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dietary_notes TEXT,
  UNIQUE (rsvp_id, position)
);

CREATE INDEX IF NOT EXISTS companions_rsvp_id_idx ON companions(rsvp_id);
