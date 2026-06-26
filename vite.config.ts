/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, '')
  // Deploy target. 'embed' (default) builds for serving from inside Xboard's
  // backend (`/assets/admin/`). 'standalone' builds a self-hosted SPA served at
  // root on a separate server/CDN that talks to the backend purely over the
  // cross-origin API. Set via `.env.standalone` or `VITE_DEPLOY_MODE`.
  const isStandalone = (env.VITE_DEPLOY_MODE || 'embed') === 'standalone'
  return {
  // Embedded build is served from the backend's `/assets/admin/` directory, so
  // assets must resolve under that base. Standalone build and the dev server
  // are served at root.
  base: command === 'build' && !isStandalone ? '/assets/admin/' : '/',
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    // Emit manifest.json so Xboard's admin.blade.php can discover the entry.
    // Not needed for standalone hosting (index.html is the entry).
    manifest: !isStandalone,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Dev proxy to the Xboard backend to avoid CORS. Point this at any
      // running Xboard instance; keep settings.js apiBase '' so the SPA calls
      // same-origin /api/* which Vite forwards here.
      // 开发联调目标后端。请在本地 `.env.local`(已被 .gitignore 忽略)里设
      // VITE_PROXY_TARGET=https://你的站点 ；默认仅指向本机,避免泄露真实地址。
      '/api': {
        target: env.VITE_PROXY_TARGET || 'http://127.0.0.1',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
  }
})
