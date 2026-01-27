import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr'
import path from 'path'

export default defineConfig({
    base: '/synthetic-md/',
    plugins: [
        react(),
        svgr({
            svgrOptions: {
                icon: true,
                titleProp: true,
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
})
