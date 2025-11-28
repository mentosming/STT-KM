import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages deployment base path
  // Repo: https://github.com/mentosming/STT-KM
  base: '/STT-KM/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});