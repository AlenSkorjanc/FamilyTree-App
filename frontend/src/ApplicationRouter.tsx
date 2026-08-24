import { useEffect, useState } from 'react'
import App from './App'
import { useAuth } from './auth'
import { ForgotPasswordPage, LoginPage, OAuthCallbackPage, RegisterPage, ResetPasswordPage, VerificationSentPage, VerifyEmailPage } from './components/AuthPages'
import { useI18n } from './i18n'
import { ProfilePage } from './components/ProfilePage'

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
  if (path === '/verify-email-sent') return <VerificationSentPage />
  if (path === '/verify-email') return <VerifyEmailPage />
  if (path === '/forgot-password') return <ForgotPasswordPage />
  if (path === '/reset-password') return <ResetPasswordPage />
  if (path === '/auth/callback') return <OAuthCallbackPage />
  if (path === '/profile') return <ProfilePage />
  const publicShareId = path.match(/^\/shared\/([0-9a-f-]+)$/i)?.[1]
  if (publicShareId) return <App publicShareId={publicShareId} />
  return <App />
}
