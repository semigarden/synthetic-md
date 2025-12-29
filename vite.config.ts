import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    port: 4444,
  },

  build: {
    lib: {
      entry: 'core/index.ts',
      name: 'SyntheticMD',
      fileName: 'synthetic-text.js',
      formats: ['es']
    },
    rollupOptions: {
      external: [],
    },
  },
})
