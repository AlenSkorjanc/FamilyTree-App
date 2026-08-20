import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fullName } from '../api'
import { useI18n } from '../i18n'
import type { FamilyTree, UUID } from '../types'
import { SearchBox } from './SearchBox'
import type { AuthUser } from '../authClient'

interface Props {
  treeId: UUID | null
  trees: FamilyTree[]
  treeName?: string
  onOpenTree: (id: UUID) => void
  onSelectPerson: (id: UUID) => void
  onNewTree: () => void
  onRenameTree: () => void
  onAddPerson: () => void
  user: AuthUser | null
  onLogout: () => void
  canEdit: boolean
  onShare?: () => void
  onLogin?: () => void
  searchPeople: (treeId: UUID, search: string) => Promise<import('../types').Person[]>
}

export function AppHeader({ treeId, trees, treeName, onOpenTree, onSelectPerson, onNewTree, onRenameTree, onAddPerson, user, onLogout, canEdit, onShare, onLogin, searchPeople }: Props) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const searchQuery = useQuery({
    queryKey: ['people-search', treeId, search],
    queryFn: () => searchPeople(treeId!, search),
    enabled: Boolean(treeId && search.trim()),
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!menuOpen) return
    window.requestAnimationFrame(() => menuRef.current?.scrollTo({ top: 0 }))
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  useMobileKeyboardReset(menuRef)

  const finishMenuAction = (action: () => void) => {
    restoreMobileViewport()
    setMenuOpen(false)
    setSearch('')
    action()
  }

  return (
    <header className="topbar">
      <div className="header-brand" title={treeName ? `${t('appName')} — ${treeName}` : t('appName')}>
        <span className="header-app-name">{t('appName')}</span>
        {treeName && <><span className="header-title-separator" aria-hidden="true">|</span><span className="header-tree-name">{treeName}</span></>}
      </div>
      {menuOpen && <button className="menu-backdrop" aria-label={t('closeMenu')} onClick={() => setMenuOpen(false)} />}
      <div
        id="main-menu"
        ref={menuRef}
        className={`topbar-menu ${menuOpen ? 'open' : ''}`}
        onClickCapture={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('.global-search')) return
          const focusedElement = document.activeElement
          if (focusedElement instanceof HTMLElement && focusedElement.closest('.global-search')) restoreMobileViewport()
        }}
      >
        <div className="menu-heading"><strong>{t('menu')}</strong><small>{treeName}</small></div>
        <div className="tree-switcher">
          <label className="menu-tree-select">
            <span className="menu-control-label">{t('treeName')}</span>
            <select value={treeId ?? ''} onChange={(event) => finishMenuAction(() => onOpenTree(event.target.value))}>
              {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
            </select>
          </label>
          <div className="tree-actions">
            <button className="quiet" onClick={() => finishMenuAction(onNewTree)}><span className="menu-action-symbol" aria-hidden="true">＋</span><span>{t('newTree').replace('+ ', '')}</span></button>
            {treeName && canEdit && <button className="quiet" onClick={() => finishMenuAction(onRenameTree)}><span className="menu-action-symbol" aria-hidden="true">✎</span><span>{t('rename')}</span></button>}
            {treeName && onShare && <button className="quiet" onClick={() => finishMenuAction(onShare)}><span className="menu-action-symbol" aria-hidden="true">↗</span><span>{t('shareTree')}</span></button>}
          </div>
        </div>
        <div className="global-search">
          <SearchBox
            value={search}
            onChange={setSearch}
            onDone={() => {
              restoreMobileViewport()
              window.requestAnimationFrame(() => menuRef.current?.scrollTo({ top: 0 }))
            }}
            placeholder={t('searchPeople')}
            label={t('searchPeopleLabel')}
          />
          {search && <div className="search-results">
            {searchQuery.data?.map((person) => <button key={person.id} onClick={() => finishMenuAction(() => onSelectPerson(person.id))}><strong>{fullName(person)}</strong><small>{person.birthDate?.slice(0, 4) ?? t('birthYearUnknown')}</small></button>)}
            {!searchQuery.isFetching && searchQuery.data?.length === 0 && <p>{t('noPeopleFound')}</p>}
          </div>}
        </div>
        {canEdit && <button className="primary add-person menu-add-person" aria-label={t('addPerson').replace('+ ', '')} onClick={() => finishMenuAction(onAddPerson)}><span>{t('addPerson')}</span></button>}
      </div>
      {user && <div className="user-menu">
        <button className="user-menu-trigger" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((open) => !open)}>
          <span className="user-avatar">{userInitials(user)}</span><span className="user-name">{user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}</span><span aria-hidden="true">⌄</span>
        </button>
        {userMenuOpen && <div className="user-menu-popover"><small>{user.email}</small><button onClick={() => { setUserMenuOpen(false); onLogout() }}>{t('signOut')}</button></div>}
      </div>}
      {!user && onLogin && <button className="quiet guest-sign-in" onClick={onLogin}>{t('signIn')}</button>}
      <LanguageSelect />
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-menu"
        aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
        onClick={() => setMenuOpen((open) => !open)}
      ><span /><span /><span /></button>
    </header>
  )
}

function userInitials(user: AuthUser) {
  const names = [user.firstName, user.lastName].filter((value): value is string => Boolean(value))
  return names.length ? names.map((value) => value[0]).join('').slice(0, 2).toUpperCase() : user.email[0].toUpperCase()
}

function useMobileKeyboardReset(menuRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let largestHeight = viewport.height
    let previousWidth = viewport.width
    let keyboardWasOpen = false
    const handleViewportResize = () => {
      if (Math.abs(viewport.width - previousWidth) > 40) {
        largestHeight = viewport.height
        previousWidth = viewport.width
      }
      largestHeight = Math.max(largestHeight, viewport.height)
      const keyboardIsOpen = largestHeight - viewport.height > 120 || window.innerHeight - viewport.height > 120
      if (keyboardWasOpen && !keyboardIsOpen) {
        const focusedElement = document.activeElement
        if (focusedElement instanceof HTMLElement && focusedElement.closest('.global-search')) focusedElement.blur()
        restoreMobileViewport()
        window.requestAnimationFrame(() => menuRef.current?.scrollTo({ top: 0 }))
      }
      keyboardWasOpen = keyboardIsOpen
    }
    viewport.addEventListener('resize', handleViewportResize)
    return () => viewport.removeEventListener('resize', handleViewportResize)
  }, [menuRef])
}

function restoreMobileViewport() {
  if (!window.matchMedia('(max-width: 1080px), (pointer: coarse)').matches) return
  const focusedElement = document.activeElement
  if (focusedElement instanceof HTMLElement) focusedElement.blur()
  const resetScroll = () => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
  window.requestAnimationFrame(resetScroll)
  window.setTimeout(resetScroll, 350)
}

export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n()
  return (
    <label className="language-select">
      <span>{t('language')}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'sl')} aria-label={t('language')}>
        <option value="en">EN</option>
        <option value="sl">SL</option>
      </select>
    </label>
  )
}
