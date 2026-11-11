import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import process from "node:process";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const sqlitePath = resolve(process.cwd(), "data", "invitacion.sqlite");
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: true },
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
  `);
}

function initializeSqlite() {
  mkdirSync(dirname(sqlitePath), { recursive: true });
  sqlite = new DatabaseSync(sqlitePath);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS rsvps (
      id TEXT PRIMARY KEY, guest_first_name TEXT NOT NULL, guest_last_name TEXT NOT NULL,
      attending INTEGER NOT NULL CHECK (attending IN (0, 1)), dietary_notes TEXT, submitted_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companions (
      id TEXT PRIMARY KEY, rsvp_id TEXT NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position IN (1, 2)), first_name TEXT NOT NULL,
      last_name TEXT NOT NULL, dietary_notes TEXT, UNIQUE (rsvp_id, position)
    );
    CREATE INDEX IF NOT EXISTS companions_rsvp_id_idx ON companions(rsvp_id);
  `);
}

export async function listRsvps() {
  await initializeStorage();
  if (pool) {
    const [guests, companions] = await Promise.all([
      pool.query("SELECT * FROM rsvps ORDER BY submitted_at DESC"),
      pool.query("SELECT * FROM companions ORDER BY position ASC"),
    ]);
    const companionsByRsvp = new Map();
    for (const companion of companions.rows) {
      const items = companionsByRsvp.get(companion.rsvp_id) ?? [];
      items.push({ id: companion.id, position: companion.position, firstName: companion.first_name, lastName: companion.last_name, dietaryNotes: companion.dietary_notes ?? "" });
      companionsByRsvp.set(companion.rsvp_id, items);
    }
    return guests.rows.map((rsvp) => ({
      id: rsvp.id,
      guest: { firstName: rsvp.guest_first_name, lastName: rsvp.guest_last_name, attending: Boolean(rsvp.attending), dietaryNotes: rsvp.dietary_notes ?? "" },
      companions: companionsByRsvp.get(rsvp.id) ?? [],
      submittedAt: new Date(rsvp.submitted_at).toISOString(),
    }));
  }

  const companionsByRsvp = new Map();
  for (const companion of sqlite.prepare("SELECT * FROM companions ORDER BY position ASC").all()) {
    const items = companionsByRsvp.get(companion.rsvp_id) ?? [];
    items.push({ id: companion.id, position: companion.position, firstName: companion.first_name, lastName: companion.last_name, dietaryNotes: companion.dietary_notes ?? "" });
    companionsByRsvp.set(companion.rsvp_id, items);
  }
  return sqlite.prepare("SELECT * FROM rsvps ORDER BY submitted_at DESC").all().map((rsvp) => ({
    id: rsvp.id,
    guest: { firstName: rsvp.guest_first_name, lastName: rsvp.guest_last_name, attending: Boolean(rsvp.attending), dietaryNotes: rsvp.dietary_notes ?? "" },
    companions: companionsByRsvp.get(rsvp.id) ?? [],
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
        "INSERT INTO rsvps (id, guest_first_name, guest_last_name, attending, dietary_notes, submitted_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, validated.guest.firstName, validated.guest.lastName, validated.guest.attending, validated.guest.dietaryNotes, submittedAt],
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
    sqlite.prepare("INSERT INTO rsvps (id, guest_first_name, guest_last_name, attending, dietary_notes, submitted_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, validated.guest.firstName, validated.guest.lastName, Number(validated.guest.attending), validated.guest.dietaryNotes, submittedAt);
    const insert = sqlite.prepare("INSERT INTO companions (id, rsvp_id, position, first_name, last_name, dietary_notes) VALUES (?, ?, ?, ?, ?, ?)");
    validated.companions.forEach((companion, index) => insert.run(companionIds[index], id, index + 1, companion.firstName, companion.lastName, companion.dietaryNotes));
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
        "UPDATE rsvps SET guest_first_name=$1, guest_last_name=$2, attending=$3, dietary_notes=$4, submitted_at=$5 WHERE id=$6 RETURNING id",
        [validated.guest.firstName, validated.guest.lastName, validated.guest.attending, validated.guest.dietaryNotes, submittedAt, id],
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
    const updated = sqlite.prepare("UPDATE rsvps SET guest_first_name=?, guest_last_name=?, attending=?, dietary_notes=?, submitted_at=? WHERE id=?")
      .run(validated.guest.firstName, validated.guest.lastName, Number(validated.guest.attending), validated.guest.dietaryNotes, submittedAt, id);
    if (Number(updated.changes) === 0) {
      sqlite.exec("ROLLBACK");
      return false;
    }
    sqlite.prepare("DELETE FROM companions WHERE rsvp_id=?").run(id);
    const insert = sqlite.prepare("INSERT INTO companions (id, rsvp_id, position, first_name, last_name, dietary_notes) VALUES (?, ?, ?, ?, ?, ?)");
    validated.companions.forEach((companion, index) => insert.run(companionIds[index], id, index + 1, companion.firstName, companion.lastName, companion.dietaryNotes));
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
      "INSERT INTO companions (id, rsvp_id, position, first_name, last_name, dietary_notes) VALUES ($1, $2, $3, $4, $5, $6)",
      [companionIds[index], rsvpId, index + 1, companion.firstName, companion.lastName, companion.dietaryNotes],
    );
  }
}

export async function deleteRsvp(id) {
  await initializeStorage();
  if (pool) return (await pool.query("DELETE FROM rsvps WHERE id=$1", [id])).rowCount > 0;
  return Number(sqlite.prepare("DELETE FROM rsvps WHERE id=?").run(id).changes) > 0;
}
