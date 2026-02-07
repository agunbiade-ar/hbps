import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // This ensures Sass can find Carbon files inside node_modules
        loadPaths: ['node_modules'],
        // Optional: If you want to use Carbon variables/mixins globally 
        // without importing them in every single .scss file:
        // additionalData: `@use "@carbon/react/scss/config" as *;`
      },
    },
  },
});