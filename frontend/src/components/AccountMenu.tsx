import { useEffect, useRef, useState } from 'react'
import type { AuthUser } from '../authClient'
import { navigate } from '../auth'
import { resolvePhotoUrl } from '../api'
import { useI18n } from '../i18n'
import { PencilIcon, UserIcon } from './Icons'

interface Props {
  user: AuthUser
  onLogout: () => void
}

export function AccountMenu({ user, onLogout }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const name = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <div className="user-menu" ref={menuRef}>
    <button className="user-menu-trigger" aria-expanded={open} aria-label={t('accountMenu')} onClick={() => setOpen((current) => !current)}>
      <UserAvatar user={user} />
    </button>
    {open && <div className="user-menu-popover">
      <div className="account-menu-profile">
        <UserAvatar user={user} large />
        <div className="account-menu-identity">
          <div className="account-menu-name"><strong>{name}</strong><button type="button" className="account-edit-button" aria-label={t('editProfile')} onClick={() => { setOpen(false); navigate('/profile') }}><PencilIcon /></button></div>
          <small>{user.email}</small>
        </div>
      </div>
      <button onClick={() => { setOpen(false); onLogout() }}>{t('signOut')}</button>
    </div>}
  </div>
}

function UserAvatar({ user, large = false }: { user: AuthUser; large?: boolean }) {
  return <span className={`user-avatar ${large ? 'large' : ''}`}>
    {user.photoUrl ? <img src={resolvePhotoUrl(user.photoUrl)} alt="" /> : <UserIcon />}
  </span>
}
