import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from 'vite-plugin-dts'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      outDir: 'dist',
    }),
  ],
  root: '.',
  server: {
    port: 4444,
  },

  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
        react: path.resolve(__dirname, 'src/react/index.ts'),
      },
      name: 'SyntheticMD',
      fileName: 'synthetic-text.js',
      formats: ['es']
    },
    rollupOptions: {
      external: [],
    },
  },
})
