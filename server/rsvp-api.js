import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(process.cwd(), "data", "invitacion.sqlite");
let database;
let insertRsvp;
let insertCompanion;
let updateRsvp;
let deleteRsvp;
let deleteCompanions;
let listRsvps;
let listCompanions;
const adminSessions = new Map();
const loginAttempts = new Map();
const adminSessionLifetimeMs = 8 * 60 * 60 * 1000;
const maxLoginFailures = 5;
const loginLockoutMs = 15 * 60 * 1000;
const adminCookieName = "rsvp_admin_session";

function initializeDatabase() {
  if (database) return;
  mkdirSync(dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS rsvps (
      id TEXT PRIMARY KEY,
      guest_first_name TEXT NOT NULL,
      guest_last_name TEXT NOT NULL,
      attending INTEGER NOT NULL CHECK (attending IN (0, 1)),
      dietary_notes TEXT,
      submitted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companions (
      id TEXT PRIMARY KEY,
      rsvp_id TEXT NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position IN (1, 2)),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dietary_notes TEXT,
      UNIQUE (rsvp_id, position)
    );

    CREATE INDEX IF NOT EXISTS companions_rsvp_id_idx ON companions(rsvp_id);
  `);

  insertRsvp = database.prepare(`
    INSERT INTO rsvps (id, guest_first_name, guest_last_name, attending, dietary_notes, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertCompanion = database.prepare(`
    INSERT INTO companions (id, rsvp_id, position, first_name, last_name, dietary_notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  updateRsvp = database.prepare(`
    UPDATE rsvps
    SET guest_first_name = ?, guest_last_name = ?, attending = ?, dietary_notes = ?, submitted_at = ?
    WHERE id = ?
  `);
  deleteRsvp = database.prepare("DELETE FROM rsvps WHERE id = ?");
  deleteCompanions = database.prepare("DELETE FROM companions WHERE rsvp_id = ?");
  listRsvps = database.prepare(`
    SELECT id, guest_first_name, guest_last_name, attending, dietary_notes, submitted_at
    FROM rsvps ORDER BY submitted_at DESC
  `);
  listCompanions = database.prepare(`
    SELECT id, rsvp_id, position, first_name, last_name, dietary_notes
    FROM companions ORDER BY position ASC
  `);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function getCookie(request, name) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  const cookie = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return "";
  }
}

function hasAdminSession(request) {
  const sessionId = getCookie(request, adminCookieName);
  const session = adminSessions.get(sessionId);
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(sessionId);
    return false;
  }
  return true;
}

function setAdminCookie(request, response, sessionId) {
  const secure = process.env.NODE_ENV === "production" || request.headers["x-forwarded-proto"] === "https";
  const cookie = [
    `${adminCookieName}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${Math.floor(adminSessionLifetimeMs / 1000)}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
  response.setHeader("Set-Cookie", cookie);
}

function clearAdminCookie(request, response) {
  const secure = process.env.NODE_ENV === "production" || request.headers["x-forwarded-proto"] === "https";
  response.setHeader("Set-Cookie", `${adminCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? "; Secure" : ""}`);
}

function hasSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin || !request.headers.host) return false;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function getClientAddress(request) {
  return request.socket.remoteAddress ?? "unknown";
}

function isLoginLocked(address) {
  const attempt = loginAttempts.get(address);
  if (!attempt) return false;
  if (attempt.lockedUntil > Date.now()) return true;
  if (attempt.lockedUntil) loginAttempts.delete(address);
  return false;
}

function recordFailedLogin(address) {
  const attempt = loginAttempts.get(address) ?? { failures: 0, lockedUntil: 0 };
  attempt.failures += 1;
  if (attempt.failures >= maxLoginFailures) attempt.lockedUntil = Date.now() + loginLockoutMs;
  loginAttempts.set(address, attempt);
}

function clearLoginFailures(address) {
  loginAttempts.delete(address);
}

function passwordMatches(input) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword || typeof input !== "string") return false;
  const inputDigest = createHash("sha256").update(input).digest();
  const configuredDigest = createHash("sha256").update(configuredPassword).digest();
  return timingSafeEqual(inputDigest, configuredDigest);
}

function cleanText(value, { required = false, maxLength = 100 } = {}) {
  if (value == null && !required) return "";
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if ((required && !cleaned) || cleaned.length > maxLength) return null;
  return cleaned;
}

function readJson(request, response) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > 16 * 1024) {
        tooLarge = true;
        sendJson(response, 413, { error: "La respuesta supera el tamaño permitido." });
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        resolveBody(null);
        return;
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        rejectBody(new Error("Invalid JSON"));
      }
    });
    request.on("error", rejectBody);
  });
}

function validatePayload(payload) {
  const guest = payload?.guest;
  if (!guest || typeof guest.attending !== "boolean") return "Indicá si vas a asistir.";

  const guestFirstName = cleanText(guest.firstName, { required: true });
  const guestLastName = cleanText(guest.lastName, { required: true });
  const dietaryNotes = cleanText(guest.dietaryNotes, { maxLength: 1500 });
  if (!guestFirstName || !guestLastName) return "Completá tu nombre y apellido (hasta 100 caracteres cada uno).";
  if (dietaryNotes === null) return "El comentario alimentario no puede superar los 1500 caracteres.";

  const companions = payload.companions ?? [];
  if (!Array.isArray(companions) || companions.length > 2) return "Se permiten hasta dos acompañantes.";
  if (!guest.attending && companions.length > 0) return "Una persona que no asiste no puede cargar acompañantes.";

  const cleanCompanions = [];
  for (const companion of companions) {
    const firstName = cleanText(companion?.firstName, { required: true });
    const lastName = cleanText(companion?.lastName, { required: true });
    const companionNotes = cleanText(companion?.dietaryNotes, { maxLength: 1500 });
    if (!firstName || !lastName) return "Completá el nombre y apellido de cada acompañante.";
    if (companionNotes === null) return "El comentario de cada acompañante no puede superar los 1500 caracteres.";
    cleanCompanions.push({ firstName, lastName, dietaryNotes: companionNotes || null });
  }

  return {
    guest: {
      firstName: guestFirstName,
      lastName: guestLastName,
      attending: guest.attending,
      dietaryNotes: dietaryNotes || null,
    },
    companions: cleanCompanions,
  };
}

export function rsvpApi() {
  return {
    name: "rsvp-api",
    configureServer: configureApi,
    configurePreviewServer: configureApi,
  };
}

function configureApi(server) {
  initializeDatabase();
  server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (!pathname.startsWith("/api/")) return next();

        if (pathname === "/api/health" && request.method === "GET") {
          return sendJson(response, 200, { status: "ok" });
        }

        if (pathname === "/api/admin/session" && request.method === "GET") {
          return sendJson(response, 200, { authenticated: hasAdminSession(request) });
        }

        if (pathname === "/api/admin/login" && request.method === "POST") {
          if (!hasSameOrigin(request)) return sendJson(response, 403, { error: "Solicitud no válida." });
          if (!process.env.ADMIN_PASSWORD) return sendJson(response, 503, { error: "El acceso al panel todavía no está configurado." });

          const address = getClientAddress(request);
          if (isLoginLocked(address)) return sendJson(response, 429, { error: "Demasiados intentos. Esperá 15 minutos y probá de nuevo." });

          let payload;
          try {
            payload = await readJson(request, response);
          } catch {
            if (!response.headersSent) sendJson(response, 400, { error: "La solicitud no es válida." });
            return;
          }
          if (response.headersSent) return;

          if (!passwordMatches(payload?.password)) {
            recordFailedLogin(address);
            return sendJson(response, 401, { error: "La contraseña no es correcta." });
          }

          clearLoginFailures(address);
          const sessionId = randomBytes(32).toString("base64url");
          const expiresAt = Date.now() + adminSessionLifetimeMs;
          for (const [existingId, session] of adminSessions) {
            if (session.expiresAt <= Date.now()) adminSessions.delete(existingId);
          }
          adminSessions.set(sessionId, { expiresAt });
          setAdminCookie(request, response, sessionId);
          return sendJson(response, 200, { authenticated: true });
        }

        if (pathname === "/api/admin/logout" && request.method === "POST") {
          if (!hasSameOrigin(request)) return sendJson(response, 403, { error: "Solicitud no válida." });
          adminSessions.delete(getCookie(request, adminCookieName));
          clearAdminCookie(request, response);
          return sendJson(response, 200, { authenticated: false });
        }

        const adminRsvpMatch = pathname.match(/^\/api\/admin\/rsvps\/([^/]+)$/);
        const isAdminRsvpCollection = pathname === "/api/admin/rsvps";
        if (isAdminRsvpCollection || adminRsvpMatch) {
          if (!hasAdminSession(request)) return sendJson(response, 401, { error: "Iniciá sesión para acceder al panel." });
          if (request.method !== "GET" && !hasSameOrigin(request)) {
            return sendJson(response, 403, { error: "Solicitud no válida." });
          }
        }

        if (isAdminRsvpCollection && request.method === "GET") {
          const companionsByRsvp = new Map();
          for (const companion of listCompanions.all()) {
            const items = companionsByRsvp.get(companion.rsvp_id) ?? [];
            items.push({
              id: companion.id,
              position: companion.position,
              firstName: companion.first_name,
              lastName: companion.last_name,
              dietaryNotes: companion.dietary_notes ?? "",
            });
            companionsByRsvp.set(companion.rsvp_id, items);
          }

          const rsvps = listRsvps.all().map((rsvp) => ({
            id: rsvp.id,
            guest: {
              firstName: rsvp.guest_first_name,
              lastName: rsvp.guest_last_name,
              attending: Boolean(rsvp.attending),
              dietaryNotes: rsvp.dietary_notes ?? "",
            },
            companions: companionsByRsvp.get(rsvp.id) ?? [],
            submittedAt: rsvp.submitted_at,
          }));
          return sendJson(response, 200, { rsvps });
        }

        if (isAdminRsvpCollection && request.method === "POST") {
          let payload;
          try {
            payload = await readJson(request, response);
          } catch {
            if (!response.headersSent) sendJson(response, 400, { error: "El formato de la respuesta no es válido." });
            return;
          }
          if (response.headersSent) return;

          const validated = validatePayload(payload);
          if (typeof validated === "string") return sendJson(response, 400, { error: validated });
          const rsvpId = randomUUID();
          try {
            database.exec("BEGIN IMMEDIATE");
            insertRsvp.run(
              rsvpId,
              validated.guest.firstName,
              validated.guest.lastName,
              Number(validated.guest.attending),
              validated.guest.dietaryNotes,
              new Date().toISOString(),
            );
            validated.companions.forEach((companion, index) => {
              insertCompanion.run(randomUUID(), rsvpId, index + 1, companion.firstName, companion.lastName, companion.dietaryNotes);
            });
            database.exec("COMMIT");
            return sendJson(response, 201, { id: rsvpId, message: "Invitado agregado." });
          } catch (error) {
            database.exec("ROLLBACK");
            console.error("No se pudo agregar el invitado:", error);
            return sendJson(response, 500, { error: "No se pudo agregar el invitado." });
          }
        }

        if (adminRsvpMatch && request.method === "DELETE") {
          const result = deleteRsvp.run(decodeURIComponent(adminRsvpMatch[1]));
          if (Number(result.changes) === 0) return sendJson(response, 404, { error: "No se encontró esa respuesta." });
          return sendJson(response, 200, { message: "Respuesta eliminada." });
        }

        if (adminRsvpMatch && request.method === "PATCH") {
          let payload;
          try {
            payload = await readJson(request, response);
          } catch {
            if (!response.headersSent) sendJson(response, 400, { error: "El formato de la respuesta no es válido." });
            return;
          }
          if (response.headersSent) return;

          const validated = validatePayload(payload);
          if (typeof validated === "string") return sendJson(response, 400, { error: validated });

          const rsvpId = decodeURIComponent(adminRsvpMatch[1]);
          try {
            database.exec("BEGIN IMMEDIATE");
            const updated = updateRsvp.run(
              validated.guest.firstName,
              validated.guest.lastName,
              Number(validated.guest.attending),
              validated.guest.dietaryNotes,
              new Date().toISOString(),
              rsvpId,
            );
            if (Number(updated.changes) === 0) {
              database.exec("ROLLBACK");
              return sendJson(response, 404, { error: "No se encontró esa respuesta." });
            }
            deleteCompanions.run(rsvpId);
            validated.companions.forEach((companion, index) => {
              insertCompanion.run(randomUUID(), rsvpId, index + 1, companion.firstName, companion.lastName, companion.dietaryNotes);
            });
            database.exec("COMMIT");
            return sendJson(response, 200, { message: "Respuesta actualizada." });
          } catch (error) {
            database.exec("ROLLBACK");
            console.error("No se pudo actualizar la respuesta:", error);
            return sendJson(response, 500, { error: "No se pudo actualizar la respuesta." });
          }
        }

        if (isAdminRsvpCollection || adminRsvpMatch) {
          response.setHeader("Allow", isAdminRsvpCollection ? "GET, POST" : "PATCH, DELETE");
          return sendJson(response, 405, { error: "Método no permitido." });
        }

        if (pathname !== "/api/rsvps") return sendJson(response, 404, { error: "Ruta no encontrada." });
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return sendJson(response, 405, { error: "Método no permitido." });
        }

        let payload;
        try {
          payload = await readJson(request, response);
        } catch (error) {
          if (!response.headersSent) sendJson(response, 400, { error: "El formato de la respuesta no es válido." });
          return;
        }
        if (response.headersSent) return;

        const validated = validatePayload(payload);
        if (typeof validated === "string") return sendJson(response, 400, { error: validated });

        const rsvpId = randomUUID();
        try {
          database.exec("BEGIN IMMEDIATE");
          insertRsvp.run(
            rsvpId,
            validated.guest.firstName,
            validated.guest.lastName,
            Number(validated.guest.attending),
            validated.guest.dietaryNotes,
            new Date().toISOString(),
          );
          validated.companions.forEach((companion, index) => {
            insertCompanion.run(randomUUID(), rsvpId, index + 1, companion.firstName, companion.lastName, companion.dietaryNotes);
          });
          database.exec("COMMIT");
          return sendJson(response, 201, { id: rsvpId, message: "Confirmación recibida." });
        } catch (error) {
          database.exec("ROLLBACK");
          console.error("No se pudo guardar la confirmación:", error);
          return sendJson(response, 500, { error: "No se pudo guardar la confirmación." });
        }
  });
}
