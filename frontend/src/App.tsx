import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fullName } from './api'
import { FamilyGraphCanvas, haveDirectRelationship, toggleConnectionPerson } from './components/FamilyGraphCanvas'
import { Modal } from './components/Modal'
import { PersonDetails } from './components/PersonDetails'
import { PersonForm } from './components/PersonForm'
import { RelativeDialog, type RelativeKind } from './components/RelativeDialog'
import { ConnectPeopleDialog, type PeopleConnection } from './components/ConnectPeopleDialog'
import type { PartnershipType, PersonInput, RelationshipType, UUID } from './types'
import { useI18n } from './i18n'

export default function App() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const treesQuery = useQuery({ queryKey: ['trees'], queryFn: api.listTrees })
  const [treeId, setTreeId] = useState<UUID | null>(null)
  const [selectedId, setSelectedId] = useState<UUID | null>(null)
  const [selectedPersonIds, setSelectedPersonIds] = useState<UUID[]>([])
  const [manualConnectionSelection, setManualConnectionSelection] = useState(false)
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
  const [focusId, setFocusId] = useState<UUID | null>(null)
  const [personModal, setPersonModal] = useState<'create' | 'edit' | null>(null)
  const [relativeKind, setRelativeKind] = useState<RelativeKind | null>(null)
  const [search, setSearch] = useState('')
  const [newTreeName, setNewTreeName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!treeId && treesQuery.data?.length) setTreeId(treesQuery.data[0].id)
  }, [treeId, treesQuery.data])

  const graphQuery = useQuery({ queryKey: ['graph', treeId], queryFn: () => api.graph(treeId!), enabled: Boolean(treeId) })
  const searchQuery = useQuery({ queryKey: ['people-search', treeId, search], queryFn: () => api.searchPeople(treeId!, search), enabled: Boolean(treeId && search.trim()), staleTime: 10_000 })
  const graph = graphQuery.data
  const selected = graph?.people.find((person) => person.id === selectedId) ?? null
  const selectedPeopleAreConnected = Boolean(
    graph && selectedPersonIds.length === 2 && haveDirectRelationship(selectedPersonIds[0], selectedPersonIds[1], graph),
  )
  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['graph', treeId] }), queryClient.invalidateQueries({ queryKey: ['trees'] })])
  }
  const run = async (operation: () => Promise<unknown>, after?: () => void) => {
    setError(null)
    try { await operation(); await refresh(); after?.() } catch (caught) { setError(caught instanceof Error ? caught.message : t('unexpectedError')) }
  }
  const focusPerson = (id: UUID) => {
    setSelectedId(id)
    setSelectedPersonIds([id])
    setManualConnectionSelection(false)
    setFocusId(null)
    window.setTimeout(() => setFocusId(id), 0)
    setSearch('')
  }
  const focusPersonOccurrence = (personId: UUID, nodeId: string) => {
    setSelectedId(personId)
    setSelectedPersonIds([personId])
    setManualConnectionSelection(false)
    setFocusId(null)
    window.setTimeout(() => setFocusId(nodeId), 0)
  }
  const selectConnection = (personIds: UUID[]) => {
    setSelectedId(null)
    setSelectedPersonIds(personIds)
    setManualConnectionSelection(false)
    setFocusId(null)
  }
  const togglePersonForConnection = (personId: UUID) => {
    setSelectedId(null)
    setFocusId(null)
    setManualConnectionSelection(true)
    setSelectedPersonIds((current) => toggleConnectionPerson(current, personId))
  }
  const clearSelection = () => {
    setSelectedId(null)
    setSelectedPersonIds([])
    setManualConnectionSelection(false)
    setConnectionDialogOpen(false)
    setFocusId(null)
  }

  const createTree = useMutation({ mutationFn: api.createTree, onSuccess: async (tree) => {
    await queryClient.invalidateQueries({ queryKey: ['trees'] }); setTreeId(tree.id); setNewTreeName('')
  } })

  const savePerson = (input: PersonInput, photoFile?: File) => {
    if (!treeId) return
    void run(async () => {
      const personInput = photoFile ? { ...input, photoUrl: (await api.uploadPhoto(treeId, photoFile)).photoUrl } : input
      const operation = personModal === 'edit' && selected ? api.updatePerson(treeId, selected.id, personInput) : api.createPerson(treeId, personInput)
      const saved = await operation
      setSelectedId(saved.id)
      setSelectedPersonIds([saved.id])
    }, () => setPersonModal(null))
  }

  const connectRelative = async (relativeId: UUID, type: RelationshipType | PartnershipType, sharedChildIds?: UUID[], sharedChildrenSourceId?: UUID) => {
    if (!treeId || !selectedId || !relativeKind) return
    if (relativeKind === 'partner') await api.createPartnership(treeId, selectedId, relativeId, type as PartnershipType, sharedChildIds?.length ? sharedChildrenSourceId ?? selectedId : undefined, sharedChildIds?.length ? sharedChildIds : undefined)
    else await api.createParentChild(treeId, relativeKind === 'parent' ? relativeId : selectedId, relativeKind === 'child' ? relativeId : selectedId, type as RelationshipType)
  }

  const addRelative = (inputOrId: PersonInput | UUID, type: RelationshipType | PartnershipType, photoFile?: File, secondParentId?: UUID, sharedChildIds?: UUID[], sharedChildrenSourceId?: UUID) => {
    if (!treeId) return
    void run(async () => {
      const personInput = typeof inputOrId === 'string' || !photoFile ? inputOrId : { ...inputOrId, photoUrl: (await api.uploadPhoto(treeId, photoFile)).photoUrl }
      const relativeId = typeof personInput === 'string' ? personInput : (await api.createPerson(treeId, personInput)).id
      await connectRelative(relativeId, type, sharedChildIds, sharedChildrenSourceId)
      if (relativeKind === 'child' && secondParentId && secondParentId !== selectedId) {
        const alreadyLinked = graph?.parentChildRelationships.some((relationship) => relationship.parentId === secondParentId && relationship.childId === relativeId)
        if (!alreadyLinked) await api.createParentChild(treeId, secondParentId, relativeId, type as RelationshipType)
      }
    }, () => setRelativeKind(null))
  }

  const connectSelectedPeople = (connection: PeopleConnection) => {
    if (!treeId) return
    void run(
      () => connection.kind === 'partner'
        ? api.createPartnership(treeId, connection.person1Id, connection.person2Id, connection.partnershipType, connection.copyChildrenFromPersonId, connection.sharedChildIds)
        : api.createParentChild(treeId, connection.parentId, connection.childId, connection.relationshipType),
      clearSelection,
    )
  }

  if (treesQuery.isLoading) return <div className="center-message">{t('loadingTrees')}</div>
  if (treesQuery.isError) return <div className="center-message error">{t('apiUnavailable')}</div>

  if (!treesQuery.data?.length) return (
    <main className="welcome">
      <div className="welcome-header"><div className="brand">{t('appName')}</div><LanguageSelect /></div>
      <section><span className="sprout">⌘</span><h1>{t('startStory')}</h1><p>{t('startStoryHelp')}</p>
        <form onSubmit={(event) => { event.preventDefault(); if (newTreeName.trim()) createTree.mutate(newTreeName.trim()) }}>
          <input value={newTreeName} onChange={(event) => setNewTreeName(event.target.value)} placeholder={t('treeNamePlaceholder')} autoFocus />
          <button className="primary" disabled={!newTreeName.trim() || createTree.isPending}>{t('createTree')}</button>
        </form>
      </section>
    </main>
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t('appName')}</div>
        <div className="tree-switcher">
          <select value={treeId ?? ''} onChange={(event) => { setTreeId(event.target.value); clearSelection() }}>
            {treesQuery.data.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
          </select>
          <button className="quiet" onClick={() => {
            const name = window.prompt(t('newTreePrompt'))?.trim()
            if (name) createTree.mutate(name)
          }}>{t('newTree')}</button>
          {graph && <button className="quiet" onClick={() => {
            const name = window.prompt(t('renameTreePrompt'), graph.tree.name)?.trim()
            if (name && treeId) void run(() => api.updateTree(treeId, name))
          }}>{t('rename')}</button>}
        </div>
        <div className="global-search">
          <span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchPeople')} />
          {search && <div className="search-results">
            {searchQuery.data?.map((person) => <button key={person.id} onClick={() => focusPerson(person.id)}><strong>{fullName(person)}</strong><small>{person.birthDate?.slice(0, 4) ?? t('birthYearUnknown')}</small></button>)}
            {!searchQuery.isFetching && searchQuery.data?.length === 0 && <p>{t('noPeopleFound')}</p>}
          </div>}
        </div>
        <LanguageSelect />
        <button className="primary add-person" aria-label={t('addPerson').replace('+ ', '')} onClick={() => { setError(null); setPersonModal('create') }}><span>{t('addPerson')}</span></button>
      </header>

      <main className={`canvas-area ${selected ? 'with-details' : ''}`}>
        {graphQuery.isLoading && <div className="center-message">{t('arrangingTree')}</div>}
        {graphQuery.isError && <div className="center-message error">{t('loadTreeError')}</div>}
        {graph && graph.people.length === 0 && <div className="empty-tree"><div className="empty-avatar">+</div><h2>{t('treeReady')}</h2><p>{t('treeReadyHelp')}</p><button className="primary" onClick={() => setPersonModal('create')}>{t('addFirstPerson')}</button></div>}
        {graph && graph.people.length > 0 && <FamilyGraphCanvas graph={graph} selectedPersonIds={selectedPersonIds} focusId={focusId} onSelect={focusPersonOccurrence} onToggleSelect={togglePersonForConnection} onSelectConnection={selectConnection} onClearSelection={clearSelection} onAddRelative={(kind) => { setError(null); setRelativeKind(kind) }} />}
        {manualConnectionSelection && selectedPersonIds.length === 1 && <div className="connection-selection-help">{t('selectTwoPeopleHelp')}</div>}
        {manualConnectionSelection && selectedPersonIds.length === 2 && !selectedPeopleAreConnected && <button className="primary connect-selected" onClick={() => { setError(null); setConnectionDialogOpen(true) }}>{t('connectSelected')}</button>}
      </main>

      {selected && graph && <PersonDetails person={selected} graph={graph} onClose={clearSelection} onSelect={focusPerson} onEdit={() => { setError(null); setPersonModal('edit') }} onAddRelative={(kind) => { setError(null); setRelativeKind(kind) }}
        onDelete={() => { if (treeId && window.confirm(t('deleteConfirm', { name: fullName(selected) }))) void run(() => api.deletePerson(treeId, selected.id), clearSelection) }}
        onRemoveParentChild={(relationship) => { if (treeId) void run(() => api.deleteParentChild(treeId, relationship.id)) }}
        onRemovePartnership={(partnership) => { if (treeId) void run(() => api.deletePartnership(treeId, partnership.id)) }} />}

      {personModal && <Modal title={personModal === 'edit' ? t('editPerson') : t('addPerson').replace('+ ', '')} onClose={() => setPersonModal(null)} wide><PersonForm person={personModal === 'edit' ? selected ?? undefined : undefined} busy={false} error={error} onSubmit={savePerson} /></Modal>}
      {relativeKind && selectedId && graph && <RelativeDialog kind={relativeKind} selectedId={selectedId} graph={graph} error={error} onClose={() => setRelativeKind(null)} onLink={(personId, type, secondParentId, sharedChildIds, sharedChildrenSourceId) => addRelative(personId, type, undefined, secondParentId, sharedChildIds, sharedChildrenSourceId)} onCreate={addRelative} />}
      {connectionDialogOpen && graph && selectedPersonIds.length === 2 && !selectedPeopleAreConnected && <ConnectPeopleDialog graph={graph} personIds={[selectedPersonIds[0], selectedPersonIds[1]]} error={error} onClose={() => setConnectionDialogOpen(false)} onConnect={connectSelectedPeople} />}
    </div>
  )
}

function LanguageSelect() {
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
