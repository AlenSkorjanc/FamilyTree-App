import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, guestApi, guestTreeIds, removeGuestTreeIds } from './api'
import { FamilyGraphCanvas } from './components/FamilyGraphCanvas'
import { haveDirectRelationship, toggleConnectionPerson } from './components/familyGraphInteractions'
import { Modal } from './components/Modal'
import { PersonDetails } from './components/PersonDetails'
import { PersonForm } from './components/PersonForm'
import { RelativeDialog, type RelativeKind } from './components/RelativeDialog'
import { ConnectPeopleDialog, type PeopleConnection } from './components/ConnectPeopleDialog'
import { AppHeader, LanguageSelect } from './components/AppHeader'
import { DeletePersonDialog, TreeNameDialog } from './components/AppDialogs'
import type { PartnershipType, PersonInput, RelationshipType, UUID } from './types'
import { useI18n } from './i18n'
import { treeIdFromPath, treePath } from './treeRouting'
import { navigate, useAuth } from './auth'
import { GuestTreeClaimDialog, TreeSharingDialog } from './components/TreeAccessDialogs'

export default function App() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { user, logout, isAuthenticated } = useAuth()
  const dataApi = isAuthenticated ? api : guestApi
  const treesQuery = useQuery({ queryKey: ['trees', isAuthenticated ? 'account' : 'guest'], queryFn: dataApi.listTrees })
  const [treeId, setTreeId] = useState<UUID | null>(() => treeIdFromPath(window.location.pathname))
  const [selectedId, setSelectedId] = useState<UUID | null>(null)
  const [selectedPersonIds, setSelectedPersonIds] = useState<UUID[]>([])
  const [manualConnectionSelection, setManualConnectionSelection] = useState(false)
  const [edgeSelectionActive, setEdgeSelectionActive] = useState(false)
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
  const [focusId, setFocusId] = useState<UUID | null>(null)
  const [personModal, setPersonModal] = useState<'create' | 'edit' | null>(null)
  const [relativeKind, setRelativeKind] = useState<RelativeKind | null>(null)
  const [newTreeName, setNewTreeName] = useState('')
  const [newTreeOpen, setNewTreeOpen] = useState(false)
  const [renameTreeOpen, setRenameTreeOpen] = useState(false)
  const [deletePersonConfirmOpen, setDeletePersonConfirmOpen] = useState(false)
  const [treeNameDraft, setTreeNameDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [claimableTrees, setClaimableTrees] = useState<import('./types').FamilyTree[] | null>(null)
  const [sharingOpen, setSharingOpen] = useState(false)
  const claimPreviewedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!user || claimPreviewedFor.current === user.id) return
    claimPreviewedFor.current = user.id
    const ids = guestTreeIds()
    if (!ids.length) return
    void api.previewGuestTrees(ids).then((trees) => { if (trees.length) setClaimableTrees(trees) }).catch(() => undefined)
  }, [user])

  useEffect(() => {
    const trees = treesQuery.data
    if (!trees?.length) return
    const activeTreeId = treeId && trees.some((tree) => tree.id === treeId) ? treeId : trees[0].id
    if (activeTreeId !== treeId) setTreeId(activeTreeId)
    const activePath = treePath(activeTreeId)
    if (window.location.pathname !== activePath) window.history.replaceState(null, '', activePath)
  }, [treeId, treesQuery.data])

  useEffect(() => {
    const handleNavigation = () => setTreeId(treeIdFromPath(window.location.pathname))
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  useEffect(() => {
    const selectedTreeName = treesQuery.data?.find((tree) => tree.id === treeId)?.name
    document.title = selectedTreeName ?? t('appName')
  }, [treeId, treesQuery.data, t])

  const graphQuery = useQuery({ queryKey: ['graph', isAuthenticated ? 'account' : 'guest', treeId], queryFn: () => dataApi.graph(treeId!), enabled: Boolean(treeId) })
  const graph = graphQuery.data
  const canEdit = graph?.tree.access !== 'VIEWER'
  const selected = graph?.people.find((person) => person.id === selectedId) ?? null
  const selectedPeopleAreConnected = Boolean(
    graph && selectedPersonIds.length === 2 && haveDirectRelationship(selectedPersonIds[0], selectedPersonIds[1], graph),
  )
  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['graph'] }), queryClient.invalidateQueries({ queryKey: ['trees'] })])
  }
  const run = async (operation: () => Promise<unknown>, after?: () => void) => {
    setError(null)
    try { await operation(); await refresh(); after?.() } catch (caught) { setError(caught instanceof Error ? caught.message : t('unexpectedError')) }
  }
  const focusPerson = (id: UUID) => {
    setPersonModal(null)
    setSelectedId(id)
    setSelectedPersonIds([id])
    setManualConnectionSelection(false)
    setEdgeSelectionActive(false)
    setFocusId(null)
    window.setTimeout(() => setFocusId(id), 0)
  }
  const focusPersonOccurrence = (personId: UUID, nodeId: string) => {
    setPersonModal(null)
    setSelectedId(personId)
    setSelectedPersonIds([personId])
    setManualConnectionSelection(false)
    setEdgeSelectionActive(false)
    setFocusId(null)
    window.setTimeout(() => setFocusId(nodeId), 0)
  }
  const selectConnection = (personIds: UUID[]) => {
    setPersonModal(null)
    setSelectedId(null)
    setSelectedPersonIds(personIds)
    setManualConnectionSelection(false)
    setEdgeSelectionActive(true)
    setFocusId(null)
  }
  const togglePersonForConnection = (personId: UUID) => {
    setPersonModal(null)
    setSelectedId(null)
    setFocusId(null)
    setManualConnectionSelection(true)
    setEdgeSelectionActive(false)
    setSelectedPersonIds((current) => toggleConnectionPerson(current, personId))
  }
  const clearSelection = () => {
    setPersonModal(null)
    setDeletePersonConfirmOpen(false)
    setSelectedId(null)
    setSelectedPersonIds([])
    setManualConnectionSelection(false)
    setEdgeSelectionActive(false)
    setConnectionDialogOpen(false)
    setFocusId(null)
  }
  const openTree = (id: UUID) => {
    setTreeId(id)
    window.history.pushState(null, '', treePath(id))
    clearSelection()
  }

  const createTree = useMutation({ mutationFn: dataApi.createTree, onSuccess: async (tree) => {
    await queryClient.invalidateQueries({ queryKey: ['trees'] }); openTree(tree.id); setNewTreeName(''); setNewTreeOpen(false)
  } })

  const savePerson = (input: PersonInput, photoFile?: File) => {
    if (!treeId) return
    const isCreating = personModal !== 'edit' || !selected
    let createdPersonId: UUID | null = null
    void run(async () => {
      const personInput = photoFile ? { ...input, photoUrl: (await dataApi.uploadPhoto(treeId, photoFile)).photoUrl } : input
      const operation = !isCreating && selected ? dataApi.updatePerson(treeId, selected.id, personInput) : dataApi.createPerson(treeId, personInput)
      const saved = await operation
      setSelectedId(saved.id)
      setSelectedPersonIds([saved.id])
      if (isCreating) createdPersonId = saved.id
    }, () => {
      setPersonModal(null)
      if (createdPersonId) focusPerson(createdPersonId)
    })
  }
  const deleteSelectedPerson = () => {
    if (!treeId || !selected) return
    void run(() => dataApi.deletePerson(treeId, selected.id), () => {
      setDeletePersonConfirmOpen(false)
      setPersonModal(null)
      clearSelection()
    })
  }

  const connectRelative = async (relativeId: UUID, type: RelationshipType | PartnershipType, sharedChildIds?: UUID[], sharedChildrenSourceId?: UUID, isCurrent = false) => {
    if (!treeId || !selectedId || !relativeKind) return
    if (relativeKind === 'partner') await dataApi.createPartnership(treeId, selectedId, relativeId, type as PartnershipType, sharedChildIds?.length ? sharedChildrenSourceId ?? selectedId : undefined, sharedChildIds?.length ? sharedChildIds : undefined, isCurrent)
    else await dataApi.createParentChild(treeId, relativeKind === 'parent' ? relativeId : selectedId, relativeKind === 'child' ? relativeId : selectedId, type as RelationshipType)
  }

  const addRelative = (inputOrId: PersonInput | UUID, type: RelationshipType | PartnershipType, photoFile?: File, secondParentId?: UUID, sharedChildIds?: UUID[], sharedChildrenSourceId?: UUID, isCurrent = false) => {
    if (!treeId) return
    let createdRelativeId: UUID | null = null
    void run(async () => {
      const personInput = typeof inputOrId === 'string' || !photoFile ? inputOrId : { ...inputOrId, photoUrl: (await dataApi.uploadPhoto(treeId, photoFile)).photoUrl }
      const relativeId = typeof personInput === 'string' ? personInput : (await dataApi.createPerson(treeId, personInput)).id
      if (typeof inputOrId !== 'string') createdRelativeId = relativeId
      await connectRelative(relativeId, type, sharedChildIds, sharedChildrenSourceId, isCurrent)
      if (relativeKind === 'child' && secondParentId && secondParentId !== selectedId) {
        const alreadyLinked = graph?.parentChildRelationships.some((relationship) => relationship.parentId === secondParentId && relationship.childId === relativeId)
        if (!alreadyLinked) await dataApi.createParentChild(treeId, secondParentId, relativeId, type as RelationshipType)
      }
    }, () => {
      setRelativeKind(null)
      if (createdRelativeId) focusPerson(createdRelativeId)
    })
  }

  const connectSelectedPeople = (connection: PeopleConnection) => {
    if (!treeId) return
    void run(
      () => connection.kind === 'partner'
        ? dataApi.createPartnership(treeId, connection.person1Id, connection.person2Id, connection.partnershipType, connection.copyChildrenFromPersonId, connection.sharedChildIds, connection.isCurrent)
        : dataApi.createParentChild(treeId, connection.parentId, connection.childId, connection.relationshipType),
      clearSelection,
    )
  }

  const claimDialog = claimableTrees && <GuestTreeClaimDialog
    trees={claimableTrees}
    onClose={() => setClaimableTrees(null)}
    onClaim={async (ids) => {
      await api.claimGuestTrees(ids)
      removeGuestTreeIds(ids)
      setClaimableTrees(null)
      await queryClient.invalidateQueries({ queryKey: ['trees'] })
    }}
  />

  if (treesQuery.isLoading) return <div className="center-message">{t('loadingTrees')}</div>
  if (treesQuery.isError) return <div className="center-message error">{t('apiUnavailable')}</div>

  if (!treesQuery.data?.length) return <>
    <main className="welcome">
      <div className="welcome-header"><div className="brand">{t('appName')}</div><div className="welcome-actions">{!isAuthenticated && <button className="quiet" onClick={() => navigate('/login')}>{t('signIn')}</button>}<LanguageSelect /></div></div>
      <section><span className="sprout">⌘</span><h1>{t('startStory')}</h1><p>{t('startStoryHelp')}</p>
        <form onSubmit={(event) => { event.preventDefault(); if (newTreeName.trim()) createTree.mutate(newTreeName.trim()) }}>
          <input value={newTreeName} onChange={(event) => setNewTreeName(event.target.value)} placeholder={t('treeNamePlaceholder')} autoFocus />
          <button type="submit" className="primary" disabled={!newTreeName.trim() || createTree.isPending}>{t('createTree')}</button>
        </form>
        {createTree.isError && <p className="form-error" role="alert">{createTree.error instanceof Error ? createTree.error.message : t('unexpectedError')}</p>}
      </section>
    </main>
    {claimDialog}
  </>

  return (
    <div className="app-shell">
      <AppHeader
        treeId={treeId}
        trees={treesQuery.data}
        treeName={graph?.tree.name}
        onOpenTree={openTree}
        onSelectPerson={focusPerson}
        onNewTree={() => { setNewTreeName(''); createTree.reset(); setNewTreeOpen(true) }}
        onRenameTree={() => { if (graph) { setError(null); setTreeNameDraft(graph.tree.name); setRenameTreeOpen(true) } }}
        onAddPerson={() => { setError(null); setPersonModal('create') }}
        canEdit={canEdit}
        onShare={isAuthenticated && graph?.tree.access === 'OWNER' ? () => setSharingOpen(true) : undefined}
        onLogin={!isAuthenticated ? () => navigate('/login') : undefined}
        searchPeople={dataApi.searchPeople}
        user={user}
        onLogout={() => { void logout().finally(() => { queryClient.clear(); navigate('/login', true) }) }}
      />

      <main className={`canvas-area ${selected ? 'with-details' : ''}`}>
        {graphQuery.isLoading && <div className="center-message">{t('arrangingTree')}</div>}
        {graphQuery.isError && <div className="center-message error">{t('loadTreeError')}</div>}
        {graph && graph.people.length === 0 && <div className="empty-tree"><div className="empty-avatar">+</div><h2>{t('treeReady')}</h2><p>{canEdit ? t('treeReadyHelp') : t('sharedTreeEmpty')}</p>{canEdit && <button className="primary" onClick={() => setPersonModal('create')}>{t('addFirstPerson')}</button>}</div>}
        {graph && graph.people.length > 0 && <FamilyGraphCanvas graph={graph} readOnly={!canEdit} selectedPersonIds={selectedPersonIds} edgeSelectionActive={edgeSelectionActive} focusId={focusId} onSelect={focusPersonOccurrence} onToggleSelect={togglePersonForConnection} onSelectConnection={selectConnection} onClearSelection={clearSelection} onAddRelative={(personId, nodeId, kind) => { focusPersonOccurrence(personId, nodeId); setError(null); setRelativeKind(kind) }} />}
        {manualConnectionSelection && selectedPersonIds.length === 1 && <div className="connection-selection-help">{t('selectTwoPeopleHelp')}</div>}
        {manualConnectionSelection && selectedPersonIds.length === 2 && !selectedPeopleAreConnected && <button className="primary connect-selected" onClick={() => { setError(null); setConnectionDialogOpen(true) }}>{t('connectSelected')}</button>}
      </main>

      {selected && graph && <PersonDetails person={selected} graph={graph} readOnly={!canEdit} editing={personModal === 'edit'} error={error} onClose={clearSelection} onSelect={focusPerson} onEdit={() => { setError(null); setPersonModal('edit') }} onCancelEdit={() => { setError(null); setPersonModal(null) }} onSave={savePerson} onDelete={() => setDeletePersonConfirmOpen(true)} onAddRelative={(kind) => { setError(null); setRelativeKind(kind) }}
        onRemoveParentChild={(relationship) => { if (treeId) void run(() => dataApi.deleteParentChild(treeId, relationship.id)) }}
        onUpdatePartnership={(partnership, partnershipType) => { if (treeId) void run(() => dataApi.updatePartnership(treeId, partnership, partnershipType)) }}
        onSetCurrentPartner={(partnerId) => { if (treeId) void run(() => dataApi.setCurrentPartner(treeId, selected.id, partnerId)) }}
        onRemovePartnership={(partnership) => { if (treeId) void run(() => dataApi.deletePartnership(treeId, partnership.id)) }} />}

      {personModal === 'create' && <Modal title={t('addPerson').replace('+ ', '')} onClose={() => setPersonModal(null)} wide><PersonForm busy={false} error={error} onSubmit={savePerson} /></Modal>}
      {newTreeOpen && <TreeNameDialog mode="create" value={newTreeName} pending={createTree.isPending} error={createTree.isError ? t('unexpectedError') : null} onChange={setNewTreeName} onClose={() => setNewTreeOpen(false)} onSubmit={() => createTree.mutate(newTreeName.trim())} />}
      {deletePersonConfirmOpen && selected && <DeletePersonDialog person={selected} onClose={() => setDeletePersonConfirmOpen(false)} onConfirm={deleteSelectedPerson} />}
      {renameTreeOpen && graph && <TreeNameDialog mode="rename" value={treeNameDraft} error={error} onChange={setTreeNameDraft} onClose={() => setRenameTreeOpen(false)} onSubmit={() => { if (treeId) void run(() => dataApi.updateTree(treeId, treeNameDraft.trim()), () => setRenameTreeOpen(false)) }} />}
      {relativeKind && selectedId && graph && <RelativeDialog kind={relativeKind} selectedId={selectedId} graph={graph} error={error} onClose={() => setRelativeKind(null)} onLink={(personId, type, secondParentId, sharedChildIds, sharedChildrenSourceId, isCurrent) => addRelative(personId, type, undefined, secondParentId, sharedChildIds, sharedChildrenSourceId, isCurrent)} onCreate={(input, type, photoFile, secondParentId, sharedChildIds, isCurrent) => addRelative(input, type, photoFile, secondParentId, sharedChildIds, undefined, isCurrent)} />}
      {connectionDialogOpen && graph && selectedPersonIds.length === 2 && !selectedPeopleAreConnected && <ConnectPeopleDialog graph={graph} personIds={[selectedPersonIds[0], selectedPersonIds[1]]} error={error} onClose={() => setConnectionDialogOpen(false)} onConnect={connectSelectedPeople} />}
      {claimDialog}
      {sharingOpen && graph && <TreeSharingDialog tree={graph.tree} onClose={() => setSharingOpen(false)} />}
    </div>
  )
}
