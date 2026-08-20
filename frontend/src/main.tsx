import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from './i18n'
import { AuthProvider } from './auth'
import { ApplicationRouter } from './ApplicationRouter'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode><I18nProvider><QueryClientProvider client={queryClient}><AuthProvider><ApplicationRouter /></AuthProvider></QueryClientProvider></I18nProvider></StrictMode>,
)
