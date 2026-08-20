import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '../api'
import { useI18n } from '../i18n'
import type { UUID } from '../types'
import { FamilyGraphCanvas } from './FamilyGraphCanvas'
import { LanguageSelect } from './AppHeader'
import { PersonDetails } from './PersonDetails'

export function PublicTreePage({ publicShareId }: { publicShareId: UUID }) {
  const { t } = useI18n()
  const graphQuery = useQuery({ queryKey: ['public-tree', publicShareId], queryFn: () => publicApi.graph(publicShareId) })
  const [selectedId, setSelectedId] = useState<UUID | null>(null)
  const graph = graphQuery.data
  const selected = graph?.people.find((person) => person.id === selectedId) ?? null
  if (graphQuery.isLoading) return <div className="center-message">{t('arrangingTree')}</div>
  if (!graph) return <div className="center-message error">{t('publicTreeUnavailable')}</div>
  return <div className="app-shell public-tree-shell">
    <header className="topbar"><div className="header-brand"><span className="header-app-name">{t('appName')}</span><span className="header-title-separator">|</span><span className="header-tree-name">{graph.tree.name}</span></div><span className="read-only-badge">{t('readOnly')}</span><LanguageSelect /></header>
    <main className={`canvas-area ${selected ? 'with-details' : ''}`}>
      {graph.people.length === 0 ? <div className="center-message">{t('sharedTreeEmpty')}</div> : <FamilyGraphCanvas graph={graph} readOnly selectedPersonIds={selectedId ? [selectedId] : []} edgeSelectionActive={false} focusId={null} onSelect={(personId) => setSelectedId(personId)} onToggleSelect={() => undefined} onSelectConnection={() => undefined} onClearSelection={() => setSelectedId(null)} onAddRelative={() => undefined} />}
    </main>
    {selected && <PersonDetails person={selected} graph={graph} readOnly onClose={() => setSelectedId(null)} onSelect={setSelectedId} onEdit={() => undefined} onCancelEdit={() => undefined} onSave={() => undefined} onDelete={() => undefined} onAddRelative={() => undefined} onRemoveParentChild={() => undefined} onRemovePartnership={() => undefined} onUpdatePartnership={() => undefined} onSetCurrentPartner={() => undefined} />}
  </div>
}
