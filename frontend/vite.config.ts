import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { isSameOriginProxyRequest } from './src/devProxy.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backendProxy: ProxyOptions = {
    target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyRequest, request) => {
        if (isSameOriginProxyRequest(request.headers.origin, request.headers.host)) proxyRequest.removeHeader('origin')
      })
    },
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': backendProxy,
        '/oauth2': backendProxy,
        '/login/oauth2': backendProxy,
      },
    },
  }
})
