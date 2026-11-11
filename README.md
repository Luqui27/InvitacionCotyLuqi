# Invitación Lucas & Coty

## Desarrollo local

1. Copiá `.env.example` a `.env.local`.
2. Configurá `ADMIN_PASSWORD` con la contraseña privada del panel.
3. Ejecutá `npm install` y `npm run dev`.

Si no existe `DATABASE_URL`, la API local usa SQLite en `data/invitacion.sqlite`. Esa base local está excluida de Git.

## Deploy: Vercel + Render PostgreSQL

El frontend sigue en Vercel. Render ejecuta la API Node y Render PostgreSQL conserva las confirmaciones. El archivo `api/[...path].js` hace de proxy para las rutas `/api/*`; así el navegador usa el mismo dominio de Vercel y la sesión del panel no depende de cookies de terceros.

### 1. Crear PostgreSQL en Render

En el Dashboard de Render, elegí **New → PostgreSQL**. Si querés usar el plan gratuito para probar, tené en cuenta que esa base vence a los 30 días y no incluye backups; no la uses para guardar confirmaciones de producción a largo plazo. La API crea las tablas `rsvps` y `companions` al iniciar. También está el esquema en `server/schema.sql`.

### 2. Crear el backend Node en Render

Creá un **Web Service** conectado a este repositorio y la rama `main`:

- Runtime: Node
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`

Configurá estas variables en el Web Service:

- `DATABASE_URL`: **Internal Database URL** de la base de Render, que aparece en su panel. Conviene que el servicio y la base estén en la misma región.
- `ADMIN_PASSWORD`: la contraseña privada del panel.
- `FRONTEND_ORIGINS`: origen exacto de Vercel, por ejemplo `https://tu-proyecto.vercel.app`. Se pueden separar varios orígenes con comas.

Render entrega una URL del estilo `https://tu-api.onrender.com`.

### 3. Vercel

En **Project Settings → Environment Variables**, agregá `RENDER_API_URL` con la URL de Render, sin una barra al final, por ejemplo `https://tu-api.onrender.com`. No uses el prefijo `VITE_`: la llamada a Render se hace desde el proxy de Vercel.

Volvé a desplegar Vercel. Las llamadas existentes a `/api/...` se enviarán a Render automáticamente.

### Datos y sesiones

La base Render comienza vacía. Los datos guardados en el SQLite local no se copian automáticamente; si hay respuestas reales que conservar, hay que migrarlas antes de abrir el formulario público.

Las sesiones del panel duran 8 horas y viven en memoria del servidor. Un reinicio de Render las cierra, por lo que habrá que iniciar sesión otra vez. La base de datos sí permanece en Supabase entre reinicios y despliegues.
