import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createRsvp, deleteRsvp, initializeStorage, listRsvps, updateRsvp } from "./storage.js";
const adminSessions = new Map();
const loginAttempts = new Map();
const adminSessionLifetimeMs = 8 * 60 * 60 * 1000;
const maxLoginFailures = 5;
const loginLockoutMs = 15 * 60 * 1000;
const adminCookieName = "rsvp_admin_session";

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

const localOrigins = ["http://localhost:5173", "http://localhost:5174"];
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || localOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
);

function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  return typeof origin === "string" && allowedOrigins.has(origin.replace(/\/$/, ""));
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (typeof origin !== "string" || !allowedOrigins.has(origin.replace(/\/$/, ""))) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");
  return true;
}

export function rsvpApi() {
  return {
    name: "rsvp-api",
    configureServer: configureApi,
    configurePreviewServer: configureApi,
  };
}

function configureApi(server) {
  server.middlewares.use((request, response, next) => {
    handleApi(request, response).then((handled) => {
      if (!handled) next();
    }).catch((error) => {
      console.error("No se pudo procesar la solicitud:", error);
      if (!response.headersSent) sendJson(response, 500, { error: "Ocurrió un error interno." });
    });
  });
}

export async function handleApi(request, response) {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (!pathname.startsWith("/api/")) return false;

  const originAllowed = applyCors(request, response);
  if (request.method === "OPTIONS") {
    if (!originAllowed) sendJson(response, 403, { error: "Origen no permitido." });
    else response.writeHead(204, { "Cache-Control": "no-store" }).end();
    return true;
  }

  try {
    await initializeStorage();
    if (pathname === "/api/health" && request.method === "GET") {
      return sendJson(response, 200, { status: "ok" });
    }

    if (pathname === "/api/admin/session" && request.method === "GET") {
      return sendJson(response, 200, { authenticated: hasAdminSession(request) });
    }

    if (pathname === "/api/admin/login" && request.method === "POST") {
      if (!isAllowedOrigin(request)) return sendJson(response, 403, { error: "Solicitud no válida." });
      if (!process.env.ADMIN_PASSWORD) return sendJson(response, 503, { error: "El acceso al panel todavía no está configurado." });
      const address = getClientAddress(request);
      if (isLoginLocked(address)) return sendJson(response, 429, { error: "Demasiados intentos. Esperá 15 minutos y probá de nuevo." });

      let payload;
      try {
        payload = await readJson(request, response);
      } catch {
        if (!response.headersSent) sendJson(response, 400, { error: "La solicitud no es válida." });
        return true;
      }
      if (response.headersSent) return true;
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
      if (!isAllowedOrigin(request)) return sendJson(response, 403, { error: "Solicitud no válida." });
      adminSessions.delete(getCookie(request, adminCookieName));
      clearAdminCookie(request, response);
      return sendJson(response, 200, { authenticated: false });
    }

    const adminRsvpMatch = pathname.match(/^\/api\/admin\/rsvps\/([^/]+)$/);
    const isAdminRsvpCollection = pathname === "/api/admin/rsvps";
    if (isAdminRsvpCollection || adminRsvpMatch) {
      if (!hasAdminSession(request)) return sendJson(response, 401, { error: "Iniciá sesión para acceder al panel." });
      if (request.method !== "GET" && !isAllowedOrigin(request)) {
        return sendJson(response, 403, { error: "Solicitud no válida." });
      }
    }

    if (isAdminRsvpCollection && request.method === "GET") {
      return sendJson(response, 200, { rsvps: await listRsvps() });
    }

    if ((isAdminRsvpCollection && request.method === "POST") || pathname === "/api/rsvps") {
      if (isAdminRsvpCollection && request.method !== "POST") {
        response.setHeader("Allow", "GET, POST");
        return sendJson(response, 405, { error: "Método no permitido." });
      }
      if (pathname === "/api/rsvps" && request.method !== "POST") {
        response.setHeader("Allow", "POST");
        return sendJson(response, 405, { error: "Método no permitido." });
      }
      if (pathname === "/api/rsvps" && !isAllowedOrigin(request)) {
        return sendJson(response, 403, { error: "Origen no permitido." });
      }
      let payload;
      try {
        payload = await readJson(request, response);
      } catch {
        if (!response.headersSent) sendJson(response, 400, { error: "El formato de la respuesta no es válido." });
        return true;
      }
      if (response.headersSent) return true;
      const validated = validatePayload(payload);
      if (typeof validated === "string") return sendJson(response, 400, { error: validated });

      const rsvpId = randomUUID();
      const companionIds = validated.companions.map(() => randomUUID());
      try {
        await createRsvp(rsvpId, validated, companionIds);
        return sendJson(response, 201, {
          id: rsvpId,
          message: isAdminRsvpCollection ? "Invitado agregado." : "Confirmación recibida.",
        });
      } catch (error) {
        console.error("No se pudo guardar la respuesta:", error);
        return sendJson(response, 500, { error: "No se pudo guardar la respuesta." });
      }
    }

    if (adminRsvpMatch && request.method === "DELETE") {
      const id = decodeURIComponent(adminRsvpMatch[1]);
      if (!await deleteRsvp(id)) return sendJson(response, 404, { error: "No se encontró esa respuesta." });
      return sendJson(response, 200, { message: "Respuesta eliminada." });
    }

    if (adminRsvpMatch && request.method === "PATCH") {
      let payload;
      try {
        payload = await readJson(request, response);
      } catch {
        if (!response.headersSent) sendJson(response, 400, { error: "El formato de la respuesta no es válido." });
        return true;
      }
      if (response.headersSent) return true;
      const validated = validatePayload(payload);
      if (typeof validated === "string") return sendJson(response, 400, { error: validated });
      const id = decodeURIComponent(adminRsvpMatch[1]);
      const companionIds = validated.companions.map(() => randomUUID());
      try {
        if (!await updateRsvp(id, validated, companionIds)) {
          return sendJson(response, 404, { error: "No se encontró esa respuesta." });
        }
        return sendJson(response, 200, { message: "Respuesta actualizada." });
      } catch (error) {
        console.error("No se pudo actualizar la respuesta:", error);
        return sendJson(response, 500, { error: "No se pudo actualizar la respuesta." });
      }
    }

    if (isAdminRsvpCollection || adminRsvpMatch) {
      response.setHeader("Allow", isAdminRsvpCollection ? "GET, POST" : "PATCH, DELETE");
      return sendJson(response, 405, { error: "Método no permitido." });
    }
    return sendJson(response, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    console.error("Error de la API:", error);
    return sendJson(response, 500, { error: "Ocurrió un error interno." });
  }
}

function getClientAddress(request) {
  const forwardedAddress = request.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  return forwardedAddress || request.socket.remoteAddress || "unknown";
}
