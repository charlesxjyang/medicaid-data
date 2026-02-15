import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // SPA fallback: serve index.html for /provider/* and /procedure/* routes
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /^\/(provider|procedure)\//.test(req.url.split('?')[0])) {
            req.url = '/';
          }
          next();
        });
      },
    },
  ],
})
