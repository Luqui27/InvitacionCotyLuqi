# Invitación Lucas & Coty

## Desarrollo local

1. Copiá `.env.example` a `.env.local`.
2. Configurá `ADMIN_PASSWORD` con la contraseña privada del panel.
3. Ejecutá `npm install` y `npm run dev`.

Si no existe `DATABASE_URL`, la API local usa SQLite en `data/invitacion.sqlite`. Esa base local está excluida de Git.

## Deploy: Vercel + Render + Supabase

El frontend sigue en Vercel. Render ejecuta la API Node y Supabase conserva las confirmaciones en PostgreSQL. El `vercel.json` reescribe las rutas `/api/*` hacia Render sin cambiar el dominio visible para el navegador, así la sesión del panel sigue siendo first-party.

### 1. Supabase

En **Connect**, copiá la URI de **Session pooler** para `DATABASE_URL`. En **Database Settings → SSL Configuration**, descargá el certificado raíz para configurarlo en Render como `SUPABASE_CA_CERT`. La API crea las tablas `rsvps` y `companions` al iniciar; el esquema también está en `server/schema.sql`.

### 2. Render

Creá un **Web Service** conectado a este repositorio y la rama `main`:

- Runtime: Node
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`

Configurá estas variables en el Web Service:

- `DATABASE_URL`: URI Session pooler de Supabase.
- `SUPABASE_CA_CERT`: certificado raíz completo, incluyendo `BEGIN CERTIFICATE` y `END CERTIFICATE`, para validar la conexión TLS.
- `ADMIN_PASSWORD`: la contraseña privada del panel.
- `FRONTEND_ORIGINS`: origen exacto de Vercel, por ejemplo `https://tu-proyecto.vercel.app`. Se pueden separar varios orígenes con comas.

Render entrega una URL del estilo `https://tu-api.onrender.com`.

### 3. Vercel

Las rutas de API se envían a la URL pública del servicio Render desde `vercel.json`. Las rutas `/admin` y `/confirmar` se reescriben a `index.html` para que Vite cargue la SPA cuando se abren directamente.

### Datos y sesiones

La base Supabase comienza vacía. Los datos guardados en el SQLite local no se copian automáticamente; si hay respuestas reales que conservar, hay que migrarlas antes de abrir el formulario público.

Las sesiones del panel duran 8 horas y viven en memoria del servidor. Un reinicio de Render las cierra, por lo que habrá que iniciar sesión otra vez. La base de datos sí permanece en Supabase entre reinicios y despliegues.
