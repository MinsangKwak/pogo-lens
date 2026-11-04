import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      {find: /^react-native$/, replacement: 'react-native-web'},
      {find: '@pogo-lens/core', replacement: resolve(root, '../../packages/core/src/index.ts')},
      {find: '@pogo-lens/workflow', replacement: resolve(root, '../../packages/workflow/src/index.ts')},
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    dedupe: ['react', 'react-dom', 'react-native-web'],
  },
  define: {__DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')},
  build: {outDir: 'dist-web', emptyOutDir: true, sourcemap: false},
});
