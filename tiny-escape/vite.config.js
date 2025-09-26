import { defineConfig } from 'vite'

export default defineConfig({
  root: '.', // Current directory
  server: {
    port: 3000,
    open: true // Optional: automatically open browser
  },
  build: {
    outDir: 'dist'
  }
})