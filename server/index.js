import { createServer } from "node:http";
import process from "node:process";
import { handleApi } from "./rsvp-api.js";
import { initializeStorage } from "./storage.js";

if (!process.env.ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD no está configurada.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurada; el backend de producción requiere Supabase PostgreSQL.");
}
if (!process.env.FRONTEND_ORIGINS?.trim()) {
  throw new Error("FRONTEND_ORIGINS debe incluir el dominio público de Vercel.");
}

await initializeStorage();

const server = createServer(async (request, response) => {
  try {
    const handled = await handleApi(request, response);
    if (!handled && !response.headersSent) {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Ruta no encontrada." }));
    }
  } catch (error) {
    console.error("Error inesperado del servidor:", error);
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Ocurrió un error interno." }));
    }
  }
});

const port = Number(process.env.PORT || 10000);
server.listen(port, "0.0.0.0", () => {
  console.info(`API lista en el puerto ${port} usando Supabase PostgreSQL.`);
});
