import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fullName } from '../api'
import { useI18n } from '../i18n'
import type { FamilyTree, UUID } from '../types'
import { SearchBox } from './SearchBox'
import type { AuthUser } from '../authClient'
import { AppLogo } from './AppLogo'
import { navigate } from '../auth'
import { AccountMenu } from './AccountMenu'
import { PencilIcon, PlusIcon, ShareIcon, TrashIcon } from './Icons'

interface Props {
  treeId: UUID | null
  trees: FamilyTree[]
  treeName?: string
  onOpenTree: (id: UUID) => void
  onSelectPerson: (id: UUID) => void
  onNewTree?: () => void
  onRenameTree?: () => void
  onDeleteTree?: () => void
  onAddPerson: () => void
  user: AuthUser | null
  onLogout: () => void
  canEdit: boolean
  onShare?: () => void
  onLogin?: () => void
  searchPeople: (treeId: UUID, search: string) => Promise<import('../types').Person[]>
}

export function AppHeader({ treeId, trees, treeName, onOpenTree, onSelectPerson, onNewTree, onRenameTree, onDeleteTree, onAddPerson, user, onLogout, canEdit, onShare, onLogin, searchPeople }: Props) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
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
        <button type="button" className="app-home-link header-home-link" onClick={() => navigate('/')} aria-label={t('home')}>
          <AppLogo className="header-logo" />
          <span className="header-app-name">{t('appName')}</span>
        </button>
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
        <div className="menu-heading"><strong>{t('menu')}</strong></div>
        <div className="tree-switcher">
          <label className="menu-tree-select">
            <span className="menu-control-label">{t('treeName')}</span>
            <select value={treeId ?? ''} onChange={(event) => finishMenuAction(() => onOpenTree(event.target.value))}>
              {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
            </select>
          </label>
          <div className="tree-actions">
            {onNewTree && <button className="quiet" onClick={() => finishMenuAction(onNewTree)}><span className="menu-action-symbol"><PlusIcon /></span><span>{t('newTree').replace('+ ', '')}</span></button>}
            {treeName && onRenameTree && <button className="quiet" onClick={() => finishMenuAction(onRenameTree)}><span className="menu-action-symbol"><PencilIcon /></span><span>{t('rename')}</span></button>}
            {treeName && onShare && <button className="quiet" onClick={() => finishMenuAction(onShare)}><span className="menu-action-symbol"><ShareIcon /></span><span>{t('shareTree')}</span></button>}
            {treeName && onDeleteTree && <button className="quiet menu-delete-tree" onClick={() => finishMenuAction(onDeleteTree)}><span className="menu-action-symbol"><TrashIcon /></span><span>{t('deleteTree')}</span></button>}
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
      <div className="topbar-account-actions">
        {user && <AccountMenu user={user} onLogout={onLogout} />}
        {!user && onLogin && <button className="quiet guest-sign-in" onClick={onLogin}>{t('signIn')}</button>}
        <LanguageSelect />
      </div>
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
