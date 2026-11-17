import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import process from "node:process";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const supabaseCaCertificate = process.env.SUPABASE_CA_CERT?.replace(/\\n/g, "\n");
const sqlitePath = resolve(process.cwd(), "data", "invitacion.sqlite");
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: {
        ...(supabaseCaCertificate ? { ca: supabaseCaCertificate } : {}),
        rejectUnauthorized: true,
      },
      max: 4,
      connectionTimeoutMillis: 10_000,
    })
  : null;

let sqlite;
let initialization;

export async function initializeStorage() {
  if (!initialization) initialization = pool ? initializePostgres() : initializeSqlite();
  return initialization;
}

async function initializePostgres() {
  await pool.query(`
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
  `);
}

function initializeSqlite() {
  mkdirSync(dirname(sqlitePath), { recursive: true });
  sqlite = new DatabaseSync(sqlitePath);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS rsvps (
      id TEXT PRIMARY KEY, guest_first_name TEXT NOT NULL, guest_last_name TEXT NOT NULL,
      attending INTEGER NOT NULL CHECK (attending IN (0, 1)), ticket_chargeable INTEGER NOT NULL DEFAULT 1 CHECK (ticket_chargeable IN (0, 1)),
      dietary_notes TEXT, submitted_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companions (
      id TEXT PRIMARY KEY, rsvp_id TEXT NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position IN (1, 2)), first_name TEXT NOT NULL,
      last_name TEXT NOT NULL, ticket_chargeable INTEGER NOT NULL DEFAULT 1 CHECK (ticket_chargeable IN (0, 1)),
      dietary_notes TEXT, UNIQUE (rsvp_id, position)
    );
    CREATE INDEX IF NOT EXISTS companions_rsvp_id_idx ON companions(rsvp_id);
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, rsvp_id TEXT NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
      amount_ars INTEGER NOT NULL CHECK (amount_ars > 0), paid_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS payments_rsvp_id_idx ON payments(rsvp_id);
  `);
  const rsvpColumns = new Set(sqlite.prepare("PRAGMA table_info(rsvps)").all().map((column) => column.name));
  if (!rsvpColumns.has("ticket_chargeable")) {
    sqlite.exec("ALTER TABLE rsvps ADD COLUMN ticket_chargeable INTEGER NOT NULL DEFAULT 1 CHECK (ticket_chargeable IN (0, 1))");
  }
  const companionColumns = new Set(sqlite.prepare("PRAGMA table_info(companions)").all().map((column) => column.name));
  if (!companionColumns.has("ticket_chargeable")) {
    sqlite.exec("ALTER TABLE companions ADD COLUMN ticket_chargeable INTEGER NOT NULL DEFAULT 1 CHECK (ticket_chargeable IN (0, 1))");
  }
}

export async function listRsvps() {
  await initializeStorage();
  if (pool) {
    const [guests, companions, payments] = await Promise.all([
      pool.query("SELECT * FROM rsvps ORDER BY submitted_at DESC"),
      pool.query("SELECT * FROM companions ORDER BY position ASC"),
      pool.query("SELECT * FROM payments ORDER BY paid_at ASC, id ASC"),
    ]);
    const companionsByRsvp = new Map();
    for (const companion of companions.rows) {
      const items = companionsByRsvp.get(companion.rsvp_id) ?? [];
      items.push({ id: companion.id, position: companion.position, firstName: companion.first_name, lastName: companion.last_name, ticketChargeable: Boolean(companion.ticket_chargeable), dietaryNotes: companion.dietary_notes ?? "" });
      companionsByRsvp.set(companion.rsvp_id, items);
    }
    const paymentsByRsvp = new Map();
    for (const payment of payments.rows) {
      const items = paymentsByRsvp.get(payment.rsvp_id) ?? [];
      const paidAt = payment.paid_at instanceof Date ? payment.paid_at.toISOString().slice(0, 10) : String(payment.paid_at).slice(0, 10);
      items.push({ id: payment.id, amountArs: Number(payment.amount_ars), paidAt, note: payment.note ?? "" });
      paymentsByRsvp.set(payment.rsvp_id, items);
    }
    return guests.rows.map((rsvp) => ({
      id: rsvp.id,
      guest: { firstName: rsvp.guest_first_name, lastName: rsvp.guest_last_name, attending: Boolean(rsvp.attending), ticketChargeable: Boolean(rsvp.ticket_chargeable), dietaryNotes: rsvp.dietary_notes ?? "" },
      companions: companionsByRsvp.get(rsvp.id) ?? [],
      payments: paymentsByRsvp.get(rsvp.id) ?? [],
      submittedAt: new Date(rsvp.submitted_at).toISOString(),
    }));
  }

  const companionsByRsvp = new Map();
  for (const companion of sqlite.prepare("SELECT * FROM companions ORDER BY position ASC").all()) {
    const items = companionsByRsvp.get(companion.rsvp_id) ?? [];
    items.push({ id: companion.id, position: companion.position, firstName: companion.first_name, lastName: companion.last_name, ticketChargeable: Boolean(companion.ticket_chargeable), dietaryNotes: companion.dietary_notes ?? "" });
    companionsByRsvp.set(companion.rsvp_id, items);
  }
  const paymentsByRsvp = new Map();
  for (const payment of sqlite.prepare("SELECT * FROM payments ORDER BY paid_at ASC, id ASC").all()) {
    const items = paymentsByRsvp.get(payment.rsvp_id) ?? [];
    items.push({ id: payment.id, amountArs: payment.amount_ars, paidAt: payment.paid_at, note: payment.note ?? "" });
    paymentsByRsvp.set(payment.rsvp_id, items);
  }
  return sqlite.prepare("SELECT * FROM rsvps ORDER BY submitted_at DESC").all().map((rsvp) => ({
    id: rsvp.id,
    guest: { firstName: rsvp.guest_first_name, lastName: rsvp.guest_last_name, attending: Boolean(rsvp.attending), ticketChargeable: Boolean(rsvp.ticket_chargeable), dietaryNotes: rsvp.dietary_notes ?? "" },
    companions: companionsByRsvp.get(rsvp.id) ?? [],
    payments: paymentsByRsvp.get(rsvp.id) ?? [],
    submittedAt: rsvp.submitted_at,
  }));
}

export async function createRsvp(id, validated, companionIds) {
  await initializeStorage();
  const submittedAt = new Date().toISOString();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO rsvps (id, guest_first_name, guest_last_name, attending, ticket_chargeable, dietary_notes, submitted_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, validated.guest.firstName, validated.guest.lastName, validated.guest.attending, validated.guest.ticketChargeable, validated.guest.dietaryNotes, submittedAt],
      );
      await insertPostgresCompanions(client, id, validated.companions, companionIds);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.prepare("INSERT INTO rsvps (id, guest_first_name, guest_last_name, attending, ticket_chargeable, dietary_notes, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, validated.guest.firstName, validated.guest.lastName, Number(validated.guest.attending), Number(validated.guest.ticketChargeable), validated.guest.dietaryNotes, submittedAt);
    const insert = sqlite.prepare("INSERT INTO companions (id, rsvp_id, position, first_name, last_name, ticket_chargeable, dietary_notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
    validated.companions.forEach((companion, index) => insert.run(companionIds[index], id, index + 1, companion.firstName, companion.lastName, Number(companion.ticketChargeable), companion.dietaryNotes));
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

export async function updateRsvp(id, validated, companionIds) {
  await initializeStorage();
  const submittedAt = new Date().toISOString();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        "UPDATE rsvps SET guest_first_name=$1, guest_last_name=$2, attending=$3, ticket_chargeable=$4, dietary_notes=$5, submitted_at=$6 WHERE id=$7 RETURNING id",
        [validated.guest.firstName, validated.guest.lastName, validated.guest.attending, validated.guest.ticketChargeable, validated.guest.dietaryNotes, submittedAt, id],
      );
      if (updated.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query("DELETE FROM companions WHERE rsvp_id=$1", [id]);
      await insertPostgresCompanions(client, id, validated.companions, companionIds);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const updated = sqlite.prepare("UPDATE rsvps SET guest_first_name=?, guest_last_name=?, attending=?, ticket_chargeable=?, dietary_notes=?, submitted_at=? WHERE id=?")
      .run(validated.guest.firstName, validated.guest.lastName, Number(validated.guest.attending), Number(validated.guest.ticketChargeable), validated.guest.dietaryNotes, submittedAt, id);
    if (Number(updated.changes) === 0) {
      sqlite.exec("ROLLBACK");
      return false;
    }
    sqlite.prepare("DELETE FROM companions WHERE rsvp_id=?").run(id);
    const insert = sqlite.prepare("INSERT INTO companions (id, rsvp_id, position, first_name, last_name, ticket_chargeable, dietary_notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
    validated.companions.forEach((companion, index) => insert.run(companionIds[index], id, index + 1, companion.firstName, companion.lastName, Number(companion.ticketChargeable), companion.dietaryNotes));
    sqlite.exec("COMMIT");
    return true;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

async function insertPostgresCompanions(client, rsvpId, companions, companionIds) {
  for (const [index, companion] of companions.entries()) {
    await client.query(
      "INSERT INTO companions (id, rsvp_id, position, first_name, last_name, ticket_chargeable, dietary_notes) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [companionIds[index], rsvpId, index + 1, companion.firstName, companion.lastName, companion.ticketChargeable, companion.dietaryNotes],
    );
  }
}

export async function deleteRsvp(id) {
  await initializeStorage();
  if (pool) return (await pool.query("DELETE FROM rsvps WHERE id=$1", [id])).rowCount > 0;
  return Number(sqlite.prepare("DELETE FROM rsvps WHERE id=?").run(id).changes) > 0;
}

export async function createPayment(id, rsvpId, amountArs, paidAt, note) {
  await initializeStorage();
  if (pool) {
    const result = await pool.query(
      "INSERT INTO payments (id, rsvp_id, amount_ars, paid_at, note) SELECT $1, id, $3, $4, $5 FROM rsvps WHERE id=$2 RETURNING id",
      [id, rsvpId, amountArs, paidAt, note],
    );
    return result.rowCount > 0;
  }
  const guest = sqlite.prepare("SELECT id FROM rsvps WHERE id=?").get(rsvpId);
  if (!guest) return false;
  sqlite.prepare("INSERT INTO payments (id, rsvp_id, amount_ars, paid_at, note) VALUES (?, ?, ?, ?, ?)")
    .run(id, rsvpId, amountArs, paidAt, note);
  return true;
}

export async function deletePayment(rsvpId, paymentId) {
  await initializeStorage();
  if (pool) {
    return (await pool.query("DELETE FROM payments WHERE rsvp_id=$1 AND id=$2", [rsvpId, paymentId])).rowCount > 0;
  }
  return Number(sqlite.prepare("DELETE FROM payments WHERE rsvp_id=? AND id=?").run(rsvpId, paymentId).changes) > 0;
}
