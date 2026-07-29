import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The conformance suite stubs Date.now and Math.random to throw. Running files
    // in isolation keeps that from leaking between suites.
    isolate: true,
  },
})
