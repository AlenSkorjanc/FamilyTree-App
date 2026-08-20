import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { isSameOriginProxyRequest } from './src/devProxy.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest, request) => {
              if (isSameOriginProxyRequest(request.headers.origin, request.headers.host)) {
                // The browser called Vite same-origin. Removing Origin prevents the
                // backend from mistaking the development proxy for a cross-site call.
                proxyRequest.removeHeader('origin')
              }
            })
          },
        },
      },
    },
  }
})
