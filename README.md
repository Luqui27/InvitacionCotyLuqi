# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Acceso al panel de invitados

Para trabajar localmente, copiá `.env.example` como `.env.local` y configurá `ADMIN_PASSWORD` en ese archivo. `.env.local` está excluido de Git y no se debe subir al repositorio.

Al desplegar, configurá `ADMIN_PASSWORD` como variable secreta en la plataforma de hosting. No incluyas la contraseña en el código ni en las variables `VITE_*`, que se exponen al navegador. El panel usa sesiones temporales y su API requiere esa sesión para leer, crear, editar o eliminar respuestas.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
