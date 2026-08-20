import { useEffect, useState } from 'react'
import App from './App'
import { useAuth } from './auth'
import { LoginPage, OAuthCallbackPage, RegisterPage } from './components/AuthPages'
import { useI18n } from './i18n'
import { PublicTreePage } from './components/PublicTreePage'

export function ApplicationRouter() {
  const { t } = useI18n()
  const { isLoading } = useAuth()
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  if (isLoading) return <div className="center-message">{t('restoringSession')}</div>
  if (path === '/login') return <LoginPage />
  if (path === '/register') return <RegisterPage />
  if (path === '/auth/callback') return <OAuthCallbackPage />
  const publicShareId = path.match(/^\/shared\/([0-9a-f-]+)$/i)?.[1]
  if (publicShareId) return <PublicTreePage publicShareId={publicShareId} />
  return <App />
}
