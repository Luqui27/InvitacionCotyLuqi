import process from "node:process";

const blockedHeaders = [
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

export default {
  async fetch(request) {
    const backendUrl = process.env.RENDER_API_URL?.replace(/\/$/, "");
    if (!backendUrl) {
      return Response.json({ error: "La API todavía no está configurada." }, { status: 503 });
    }

    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendUrl);
    const headers = new Headers(request.headers);
    for (const header of blockedHeaders) headers.delete(header);

    try {
      return await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
        ...(request.method === "GET" || request.method === "HEAD" ? {} : { duplex: "half" }),
      });
    } catch (error) {
      console.error("No se pudo conectar con la API de Render:", error);
      return Response.json({ error: "No se pudo conectar con el servidor. Intentá de nuevo en unos minutos." }, { status: 502 });
    }
  },
};
