# Invitación Lucas & Coty

## Desarrollo local

1. Copiá `.env.example` a `.env.local`.
2. Configurá `ADMIN_PASSWORD` con la contraseña privada del panel.
3. Ejecutá `npm install` y `npm run dev`.

Si no existe `DATABASE_URL`, la API local usa SQLite en `data/invitacion.sqlite`. Esa base local está excluida de Git.

## Deploy: Vercel + Render + Supabase

El frontend sigue en Vercel. Render ejecuta la API Node y Supabase conserva las confirmaciones en PostgreSQL. El archivo `api/[...path].js` hace de proxy para las rutas `/api/*`; así el navegador usa el mismo dominio de Vercel y la sesión del panel no depende de cookies de terceros.

### 1. Supabase

1. Creá un proyecto de base de datos en Supabase.
2. En **Connect**, copiá la cadena **Session pooler** para un backend persistente y guardala para el siguiente paso. No la pongas en el código ni en Vercel.
3. La API crea las tablas `rsvps` y `companions` al iniciar. También está el esquema equivalente en `server/schema.sql`.

### 2. Render

El archivo `render.yaml` configura el servicio Node y su health check. En Render, creá un **Blueprint** desde este repositorio y la rama `main`; Render detectará el archivo y te pedirá estos valores al crear el servicio:

- `DATABASE_URL`: cadena Session pooler de Supabase.
- `ADMIN_PASSWORD`: la contraseña privada del panel.
- `FRONTEND_ORIGINS`: origen exacto de Vercel, por ejemplo `https://tu-proyecto.vercel.app`. Se pueden separar varios orígenes con comas.

No agregues esos secretos al archivo `render.yaml`. Render solicita los valores `sync: false` desde el Dashboard durante la creación del Blueprint.

Render entrega una URL del estilo `https://tu-api.onrender.com`.

### 3. Vercel

En **Project Settings → Environment Variables**, agregá `RENDER_API_URL` con la URL de Render, sin una barra al final, por ejemplo `https://tu-api.onrender.com`. No uses el prefijo `VITE_`: la llamada a Render se hace desde el proxy de Vercel.

Volvé a desplegar Vercel. Las llamadas existentes a `/api/...` se enviarán a Render automáticamente.

### Datos y sesiones

La base Supabase comienza vacía. Los datos guardados en el SQLite local no se copian automáticamente; si hay respuestas reales que conservar, hay que migrarlas antes de abrir el formulario público.

Las sesiones del panel duran 8 horas y viven en memoria del servidor. Un reinicio de Render las cierra, por lo que habrá que iniciar sesión otra vez. La base de datos sí permanece en Supabase entre reinicios y despliegues.
