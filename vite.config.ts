import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
// This middleware exists ONLY in the loopback development server. No RFP fixture is bundled.
export default defineConfig({ plugins: [react(), {
  name: 'private-local-fixtures',
  configureServer(server) {
    server.middlewares.use('/__dev/seed', async (_req, res) => {
      try { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify({...JSON.parse(await readFile(new URL('./private/seed.json', import.meta.url), 'utf8')),members:JSON.parse(await readFile(new URL('./private/members.preview.json',import.meta.url),'utf8')),reviewContext:JSON.parse(await readFile(new URL('./private/review-context.json',import.meta.url),'utf8'))})); }
      catch { res.statusCode = 500; res.end('{"error":"Local fixture is unavailable"}'); }
    });
  },
}], build: { sourcemap: false }, server: { host: '127.0.0.1', port: 5173, strictPort: true } });
