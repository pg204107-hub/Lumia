
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Only inject the specific key needed, stringified for the browser
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
