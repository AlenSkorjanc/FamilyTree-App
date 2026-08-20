import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { navigate, safeReturnTarget, useAuth } from '../auth'
import { ApiRequestError, authApi, socialLoginUrl, type AuthProviders } from '../authClient'
import { LanguageSelect } from './AppHeader'
import { useI18n } from '../i18n'

export function LoginPage() {
  const { t } = useI18n()
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => oauthErrorMessage(t))
  const providers = useProviders()
  const target = safeReturnTarget(new URLSearchParams(window.location.search).get('returnTo'))

  useEffect(() => { if (isAuthenticated) navigate(target, true) }, [isAuthenticated, target])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try { await login(email, password); navigate(target, true) }
    catch (caught) { setError(authError(caught, t('signInFailed'))) }
    finally { setBusy(false) }
  }

  return <AuthLayout>
    <h1>{t('signIn')}</h1><p>{t('signInHelp')}</p>
    <form className="auth-form" onSubmit={submit}>
      <label>{t('email')}<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>{t('password')}<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? t('signingIn') : t('signIn')}</button>
    </form>
    <SocialButtons providers={providers} />
    <p className="auth-switch">{t('noAccount')} <button className="link-button" onClick={() => navigate('/register')}>{t('signUp')}</button></p>
  </AuthLayout>
}

export function RegisterPage() {
  const { t } = useI18n()
  const { register, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', repeatPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const providers = useProviders()

  useEffect(() => { if (isAuthenticated) navigate('/', true) }, [isAuthenticated])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.password !== form.repeatPassword) { setError(t('passwordsMismatch')); return }
    setBusy(true); setError(null)
    try {
      await register({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password })
      navigate('/', true)
    } catch (caught) { setError(authError(caught, t('registrationFailed'))) }
    finally { setBusy(false) }
  }
  const update = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }))

  return <AuthLayout>
    <h1>{t('createAccount')}</h1><p>{t('registerHelp')}</p>
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-name-row">
        <label>{t('firstName')}<input autoComplete="given-name" required value={form.firstName} onChange={(event) => update('firstName', event.target.value)} /></label>
        <label>{t('lastName')}<input autoComplete="family-name" required value={form.lastName} onChange={(event) => update('lastName', event.target.value)} /></label>
      </div>
      <label>{t('email')}<input type="email" autoComplete="email" required value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
      <label>{t('password')}<input type="password" minLength={8} autoComplete="new-password" required value={form.password} onChange={(event) => update('password', event.target.value)} /></label>
      <label>{t('repeatPassword')}<input type="password" minLength={8} autoComplete="new-password" required value={form.repeatPassword} onChange={(event) => update('repeatPassword', event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? t('creatingAccount') : t('createAccount')}</button>
    </form>
    <SocialButtons providers={providers} />
    <p className="auth-switch">{t('haveAccount')} <button className="link-button" onClick={() => navigate('/login')}>{t('signIn')}</button></p>
  </AuthLayout>
}

export function OAuthCallbackPage() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, restore } = useAuth()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) { navigate('/', true); return }
    void restore().then((success) => success ? navigate('/', true) : setFailed(true))
  }, [isAuthenticated, isLoading, restore])
  return <div className="center-message">{failed ? <><p className="error">{t('oauthFailed')}</p><button className="primary" onClick={() => navigate('/login', true)}>{t('backToLogin')}</button></> : t('completingSignIn')}</div>
}

function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return <main className="auth-page"><div className="auth-language"><LanguageSelect /></div><section className="auth-card"><div className="auth-brand">{t('appName')}</div>{children}</section></main>
}

function SocialButtons({ providers }: { providers: AuthProviders | null }) {
  const { t } = useI18n()
  if (!providers?.google && !providers?.facebook) return null
  return <div className="social-login"><div className="auth-divider"><span>{t('or')}</span></div>
    {providers.google && <a className="social-button" href={socialLoginUrl('google')}><strong>G</strong>{t('continueGoogle')}</a>}
    {providers.facebook && <a className="social-button" href={socialLoginUrl('facebook')}><strong>f</strong>{t('continueFacebook')}</a>}
  </div>
}

function useProviders() {
  const [providers, setProviders] = useState<AuthProviders | null>(null)
  useEffect(() => { void authApi.providers().then(setProviders).catch(() => setProviders(null)) }, [])
  return providers
}

function authError(error: unknown, fallback: string) { return error instanceof ApiRequestError ? error.message : fallback }
function oauthErrorMessage(t: ReturnType<typeof useI18n>['t']) {
  const value = new URLSearchParams(window.location.search).get('oauthError')
  if (value === 'account_link_required') return t('accountLinkRequired')
  return value ? t('oauthFailed') : null
}
