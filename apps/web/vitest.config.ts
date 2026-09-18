import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Vitest doesn't read tsconfig `paths`; mirror the `@/*` alias so tests can import app code.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
