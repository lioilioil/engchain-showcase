import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import fs from 'node:fs';

// 把上层 ../js/*.js 等旧静态资源通过 /_legacy/ 暴露给 dev server，
// 用于在新工程里桥接旧 DataBus。生产构建时由部署方负责同路径挂载。
function legacyStatic() {
  const root = path.resolve(__dirname, '..');
  return {
    name: 'legacy-static',
    configureServer(server: any) {
      server.middlewares.use('/admin-v2/_legacy', (req: any, res: any, next: any) => {
        const url = (req.url || '').split('?')[0];
        const file = path.join(root, url);
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          return next();
        }
        res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), legacyStatic()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5174,
    host: '127.0.0.1',
  },
  base: '/admin-v2/',
});
