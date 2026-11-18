import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// In development the client calls the same origin, as it does behind the Ingress, and Vite forwards the API to the gateway
const gateway = process.env.GOTION_GATEWAY ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/v1': gateway } },
  preview: { proxy: { '/v1': gateway } },
})
