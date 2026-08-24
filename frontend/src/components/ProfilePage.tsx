import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { navigate, useAuth } from '../auth'
import type { PersonInput } from '../types'
import { useI18n } from '../i18n'
import { AccountMenu } from './AccountMenu'
import { AppLogo } from './AppLogo'
import { LanguageSelect } from './AppHeader'
import { Modal } from './Modal'
import { PersonForm } from './PersonForm'
import { ChevronIcon } from './Icons'

export function ProfilePage() {
  const { t } = useI18n()
  const { user, updateProfile, requestPasswordChange, deleteProfile, logout, logoutAll } = useAuth()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState(user?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'logoutAll' | null>(null)

  useEffect(() => {
    if (!user) navigate('/login?returnTo=/profile', true)
  }, [user])

  if (!user) return <div className="center-message">{t('redirectingToLogin')}</div>

  const profileValues: PersonInput = {
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    maidenName: user.maidenName,
    gender: user.gender,
    birthDate: user.birthDate,
    deathDate: user.deathDate,
    birthPlace: user.birthPlace,
    deathPlace: user.deathPlace,
    notes: user.notes,
    photoUrl: user.photoUrl,
  }
  const leaveAccount = () => { queryClient.clear(); navigate('/login', true) }
  const save = async (input: PersonInput, photoFile?: File) => {
    setBusy(true); setError(null); setSaved(false)
    try { await updateProfile({ ...input, email }, photoFile); setSaved(true) }
    catch (caught) { setError(caught instanceof Error ? caught.message : t('unexpectedError')) }
    finally { setBusy(false) }
  }
  const runAccountAction = async () => {
    if (!confirmAction) return
    setBusy(true); setError(null)
    try {
      if (confirmAction === 'delete') await deleteProfile()
      else await logoutAll()
      leaveAccount()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('unexpectedError'))
      setConfirmAction(null)
    } finally { setBusy(false) }
  }
  const submitPassword = async (event: FormEvent) => {
    event.preventDefault(); setPasswordError(null); setPasswordSaved(false)
    setPasswordBusy(true)
    try {
      await requestPasswordChange(user.hasPassword ? currentPassword : undefined)
      setCurrentPassword(''); setPasswordSaved(true)
    } catch (caught) { setPasswordError(caught instanceof Error ? caught.message : t('unexpectedError')) }
    finally { setPasswordBusy(false) }
  }

  return <main className="profile-page">
    <header className="auth-header"><button type="button" className="brand app-brand-lockup app-home-link" onClick={() => navigate('/')} aria-label={t('home')}><AppLogo className="header-logo" /><span>{t('appName')}</span></button></header>
    <div className="auth-navigation"><AccountMenu user={user} onLogout={() => { void logout().finally(leaveAccount) }} /><LanguageSelect /></div>
    <section className="profile-card">
      <header><h1>{t('editProfile')}</h1><p>{t('editProfileHelp')}</p></header>
      <PersonForm initialValues={profileValues} currentPhotoUrl={user.photoUrl} emailField={{ value: email, onChange: setEmail }} submitLabel={t('saveProfile')} busy={busy} error={error} autoFocusFirstField={false} onSubmit={save} />
      {saved && <p className="profile-success" role="status">{t('profileSaved')}</p>}
      <section className="profile-security" aria-labelledby="account-security-title">
        <button type="button" className="profile-security-toggle" aria-expanded={securityOpen} aria-controls="account-security-content" onClick={() => setSecurityOpen((current) => !current)}>
          <span><strong id="account-security-title">{t('accountSecurity')}</strong><small>{t('accountSecurityHelp')}</small></span>
          <ChevronIcon />
        </button>
        {securityOpen && <div id="account-security-content" className="profile-security-content">
          <form className="change-password-form" onSubmit={submitPassword}>
            <header><strong>{user.hasPassword ? t('changePassword') : t('setPassword')}</strong><small>{user.hasPassword ? t('changePasswordEmailHelp') : t('setPasswordEmailHelp')}</small></header>
            {user.hasPassword && <label>{t('currentPassword')}<input type="password" autoComplete="current-password" maxLength={1024} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>}
            {passwordError && <p className="form-error">{passwordError}</p>}
            {passwordSaved && <p className="password-success" role="status">{t('passwordEmailSent')}</p>}
            <footer><button type="submit" className="primary" disabled={passwordBusy}>{passwordBusy ? t('sending') : t('sendVerificationEmail')}</button></footer>
          </form>
          <div className="profile-security-actions"><button type="button" className="quiet" onClick={() => setConfirmAction('logoutAll')}>{t('logoutAllDevices')}</button><button type="button" className="danger-outline-button" onClick={() => setConfirmAction('delete')}>{t('deleteProfile')}</button></div>
        </div>}
      </section>
    </section>
    {confirmAction && <Modal title={confirmAction === 'delete' ? t('deleteProfile') : t('logoutAllDevices')} onClose={() => { if (!busy) setConfirmAction(null) }}><div className="confirmation-dialog"><p>{confirmAction === 'delete' ? t('deleteProfileConfirm') : t('logoutAllConfirm')}</p><footer><button type="button" className="quiet" disabled={busy} onClick={() => setConfirmAction(null)}>{t('cancel')}</button><button type="button" className={confirmAction === 'delete' ? 'danger-button' : 'primary'} disabled={busy} onClick={() => { void runAccountAction() }}>{confirmAction === 'delete' ? t('deleteProfile') : t('logoutAllDevices')}</button></footer></div></Modal>}
  </main>
}
