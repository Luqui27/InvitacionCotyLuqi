import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { rsvpApi } from './server/rsvp-api.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const localSecrets = loadEnv(mode, process.cwd(), '')
  if (!process.env.ADMIN_PASSWORD && localSecrets.ADMIN_PASSWORD) {
    process.env.ADMIN_PASSWORD = localSecrets.ADMIN_PASSWORD
  }

  return {
    plugins: [react(), rsvpApi()],
  }
})
