import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { publicApi } from '../api'
import { useI18n } from '../i18n'
import type { UUID } from '../types'
import { FamilyGraphCanvas } from './FamilyGraphCanvas'
import { LanguageSelect } from './AppHeader'
import { PersonDetails } from './PersonDetails'
import { AppLogo } from './AppLogo'
import { navigate, useAuth } from '../auth'
import { AccountMenu } from './AccountMenu'

export function PublicTreePage({ publicShareId }: { publicShareId: UUID }) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const graphQuery = useQuery({ queryKey: ['public-tree', publicShareId], queryFn: () => publicApi.graph(publicShareId) })
  const [selectedId, setSelectedId] = useState<UUID | null>(null)
  const graph = graphQuery.data
  const selected = graph?.people.find((person) => person.id === selectedId) ?? null
  if (graphQuery.isLoading) return <div className="center-message">{t('arrangingTree')}</div>
  if (!graph) return <div className="center-message error">{t('publicTreeUnavailable')}</div>
  return <div className="app-shell public-tree-shell">
    <header className="topbar"><div className="header-brand"><button type="button" className="app-home-link header-home-link" onClick={() => navigate('/')} aria-label={t('home')}><AppLogo className="header-logo" /><span className="header-app-name">{t('appName')}</span></button><span className="header-title-separator">|</span><span className="header-tree-name">{graph.tree.name}</span></div><span className="read-only-badge">{t('readOnly')}</span><div className="topbar-account-actions">{user && <AccountMenu user={user} onLogout={() => { void logout().finally(() => { queryClient.clear(); navigate('/login', true) }) }} />}<LanguageSelect /></div></header>
    <main className={`canvas-area ${selected ? 'with-details' : ''}`}>
      {graph.people.length === 0 ? <div className="center-message">{t('sharedTreeEmpty')}</div> : <FamilyGraphCanvas graph={graph} readOnly selectedPersonIds={selectedId ? [selectedId] : []} edgeSelectionActive={false} focusId={null} onSelect={(personId) => setSelectedId(personId)} onToggleSelect={() => undefined} onSelectConnection={() => undefined} onClearSelection={() => setSelectedId(null)} onAddRelative={() => undefined} />}
    </main>
    {selected && <PersonDetails person={selected} graph={graph} readOnly onClose={() => setSelectedId(null)} onSelect={setSelectedId} onEdit={() => undefined} onCancelEdit={() => undefined} onSave={() => undefined} onDelete={() => undefined} onAddRelative={() => undefined} onRemoveParentChild={() => undefined} onRemovePartnership={() => undefined} onUpdatePartnership={() => undefined} onSetCurrentPartner={() => undefined} />}
  </div>
}
