import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    // The default `forks` pool spawns a child Node process per worker and, on
    // some Windows setups, those workers never answer the ready handshake
    // ("Timeout waiting for worker to respond" / "Failed to start forks
    // worker"), which makes `npm test` fail before a single test runs. The
    // `threads` pool uses worker_threads within one process and starts
    // reliably everywhere, including Windows. Tests use jsdom (no native
    // addons), so thread isolation is sufficient.
    pool: 'threads',
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    restoreMocks: true,
  },
})
