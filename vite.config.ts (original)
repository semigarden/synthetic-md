import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isLibrary = mode === 'library'
  
  if (isLibrary) {
    // Library build configuration
    return {
      plugins: [react()],
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
      build: {
        lib: {
          entry: resolve(__dirname, 'src/lib.ts'),
          name: 'SyntheticMD',
          fileName: 'lib',
          formats: ['es']
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'react/jsx-runtime'
            }
          }
        },
        sourcemap: true,
        emptyOutDir: true,
      },
    }
  }
  
  // Development/standalone app configuration
  return {
    server: {
      port: 4444,
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  }
})
