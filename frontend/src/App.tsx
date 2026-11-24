import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, guestApi, guestTreeIds, publicApi, removeGuestTreeIds } from './api'
import { FamilyGraphCanvas } from './components/FamilyGraphCanvas'
import { haveDirectRelationship, toggleConnectionPerson } from './components/familyGraphInteractions'
import { Modal } from './components/Modal'
import { PersonDetails } from './components/PersonDetails'
import { PersonForm } from './components/PersonForm'
import { RelativeDialog, type RelativeKind } from './components/RelativeDialog'
import { ConnectPeopleDialog, type PeopleConnection } from './components/ConnectPeopleDialog'
import { AppHeader, LanguageSelect } from './components/AppHeader'
import { DeletePersonDialog, DeleteTreeDialog, TreeNameDialog } from './components/AppDialogs'
import type { PartnershipType, PersonInput, RelationshipType, UUID } from './types'
import { useI18n } from './i18n'
import { treeIdFromPath, treePath } from './treeRouting'
import { navigate, useAuth } from './auth'
import { GuestTreeClaimDialog, TreeSharingDialog } from './components/TreeAccessDialogs'
import { AppLogo } from './components/AppLogo'
import { AccountMenu } from './components/AccountMenu'
import { PlusIcon } from './components/Icons'
import { ApiRequestError } from './authClient'

export default function App({ publicShareId }: { publicShareId?: UUID }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { user, logout, isAuthenticated } = useAuth()
  const dataApi = publicShareId ? api : isAuthenticated ? api : guestApi
  const signOut = () => { void logout().finally(() => { queryClient.clear(); navigate('/login', true) }) }
  const treesQuery = useQuery({
    queryKey: ['trees', publicShareId ? `public-${publicShareId}` : isAuthenticated ? 'account' : 'guest'],
    queryFn: publicShareId ? async () => [(await publicApi.graph(publicShareId)).tree] : dataApi.listTrees,
  })
  const [treeId, setTreeId] = useState<UUID | null>(() => publicShareId ? null : treeIdFromPath(window.location.pathname))
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
  const [deleteTreeConfirmOpen, setDeleteTreeConfirmOpen] = useState(false)
  const [deleteTreePending, setDeleteTreePending] = useState(false)
  const [deletePersonConfirmOpen, setDeletePersonConfirmOpen] = useState(false)
  const [treeNameDraft, setTreeNameDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [claimableTrees, setClaimableTrees] = useState<import('./types').FamilyTree[] | null>(null)
  const [sharingOpen, setSharingOpen] = useState(false)
  const claimPreviewedFor = useRef<string | null>(null)

  useEffect(() => {
    if (publicShareId || !user || claimPreviewedFor.current === user.id) return
    claimPreviewedFor.current = user.id
    const ids = guestTreeIds()
    if (!ids.length) return
    void api.previewGuestTrees(ids).then((trees) => { if (trees.length) setClaimableTrees(trees) }).catch(() => undefined)
  }, [publicShareId, user])

  useEffect(() => {
    const trees = treesQuery.data
    if (!trees?.length) return
    const activeTreeId = treeId && trees.some((tree) => tree.id === treeId) ? treeId : trees[0].id
    if (activeTreeId !== treeId) setTreeId(activeTreeId)
    if (!publicShareId) {
      const activePath = treePath(activeTreeId)
      if (window.location.pathname !== activePath) window.history.replaceState(null, '', activePath)
    }
  }, [publicShareId, treeId, treesQuery.data])

  useEffect(() => {
    if (publicShareId) return
    const handleNavigation = () => setTreeId(treeIdFromPath(window.location.pathname))
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [publicShareId])

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
    try {
      await operation(); await refresh(); after?.()
    } catch (caught) {
      const integrityMessages: Record<string, string> = {
        ANCESTRY_CYCLE: t('ancestryCycleError'),
        MAX_PARENTS_REACHED: t('maxParentsError'),
        UNSUPPORTED_PARENT_RELATIONSHIP_TYPE: t('unsupportedParentTypeError'),
        SELF_PARENT_RELATIONSHIP: t('selfParentError'),
        DUPLICATE_PARENT_CHILD_RELATIONSHIP: t('duplicateParentChildError'),
        INVALID_BIOLOGICAL_PARENT_DATES: t('biologicalParentDatesError'),
        SELF_PARTNERSHIP: t('selfPartnershipError'),
        DUPLICATE_PARTNERSHIP: t('duplicatePartnershipError'),
        INVALID_PARTNERSHIP_DATES: t('invalidPartnershipDatesError'),
        INVALID_PERSON_DATES: t('invalidPersonDatesError'),
      }
      setError(caught instanceof ApiRequestError ? integrityMessages[caught.code] ?? caught.message : caught instanceof Error ? caught.message : t('unexpectedError'))
    }
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
    if (!publicShareId) window.history.pushState(null, '', treePath(id))
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
  const deleteCurrentTree = async () => {
    if (!treeId) return
    setError(null)
    setDeleteTreePending(true)
    try {
      const deletedTreeId = treeId
      await dataApi.deleteTree(deletedTreeId)
      const nextTree = treesQuery.data?.find((tree) => tree.id !== deletedTreeId)
      await queryClient.invalidateQueries({ queryKey: ['trees'] })
      setDeleteTreeConfirmOpen(false)
      clearSelection()
      setTreeId(nextTree?.id ?? null)
      window.history.replaceState(null, '', nextTree ? treePath(nextTree.id) : '/')
      queryClient.removeQueries({ queryKey: ['graph', isAuthenticated ? 'account' : 'guest', deletedTreeId], exact: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('unexpectedError'))
    } finally {
      setDeleteTreePending(false)
    }
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
      <div className="welcome-header"><button type="button" className="brand app-brand-lockup app-home-link" onClick={() => navigate('/')} aria-label={t('home')}><AppLogo className="welcome-logo" /><span>{t('appName')}</span></button><div className="welcome-actions">{user ? <AccountMenu user={user} onLogout={signOut} /> : <button className="quiet" onClick={() => navigate('/login')}>{t('signIn')}</button>}<LanguageSelect /></div></div>
      <section><AppLogo className="welcome-hero-logo" /><h1>{t('startStory')}</h1><p>{t('startStoryHelp')}</p>
        <form onSubmit={(event) => { event.preventDefault(); if (newTreeName.trim()) createTree.mutate(newTreeName.trim()) }}>
          <input value={newTreeName} onChange={(event) => setNewTreeName(event.target.value)} placeholder={t('treeNamePlaceholder')} autoFocus={!window.matchMedia('(pointer: coarse), (hover: none)').matches} />
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
        onNewTree={publicShareId ? undefined : () => { setNewTreeName(''); createTree.reset(); setNewTreeOpen(true) }}
        onRenameTree={graph && (graph.tree.access === 'OWNER' || graph.tree.access === 'GUEST_OWNER') ? () => { setError(null); setTreeNameDraft(graph.tree.name); setRenameTreeOpen(true) } : undefined}
        onDeleteTree={graph && (graph.tree.access === 'OWNER' || graph.tree.access === 'GUEST_OWNER') ? () => { setError(null); setDeleteTreeConfirmOpen(true) } : undefined}
        onAddPerson={() => { setError(null); setPersonModal('create') }}
        canEdit={canEdit}
        onShare={isAuthenticated && graph?.tree.access === 'OWNER' ? () => setSharingOpen(true) : undefined}
        onLogin={!isAuthenticated ? () => navigate('/login') : undefined}
        searchPeople={dataApi.searchPeople}
        user={user}
        onLogout={signOut}
      />

      <main className={`canvas-area ${selected ? 'with-details' : ''}`}>
        {graphQuery.isLoading && <div className="center-message">{t('arrangingTree')}</div>}
        {graphQuery.isError && <div className="center-message error">{t('loadTreeError')}</div>}
        {graph && graph.people.length === 0 && <div className="empty-tree"><div className="empty-avatar"><PlusIcon /></div><h2>{t('treeReady')}</h2><p>{canEdit ? t('treeReadyHelp') : t('sharedTreeEmpty')}</p>{canEdit && <button className="primary" onClick={() => setPersonModal('create')}>{t('addFirstPerson')}</button>}</div>}
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
      {deleteTreeConfirmOpen && graph && <DeleteTreeDialog treeName={graph.tree.name} pending={deleteTreePending} error={error} onClose={() => { if (!deleteTreePending) setDeleteTreeConfirmOpen(false) }} onConfirm={() => { void deleteCurrentTree() }} />}
      {relativeKind && selectedId && graph && <RelativeDialog kind={relativeKind} selectedId={selectedId} graph={graph} error={error} onClose={() => setRelativeKind(null)} onLink={(personId, type, secondParentId, sharedChildIds, sharedChildrenSourceId, isCurrent) => addRelative(personId, type, undefined, secondParentId, sharedChildIds, sharedChildrenSourceId, isCurrent)} onCreate={(input, type, photoFile, secondParentId, sharedChildIds, isCurrent) => addRelative(input, type, photoFile, secondParentId, sharedChildIds, undefined, isCurrent)} />}
      {connectionDialogOpen && graph && selectedPersonIds.length === 2 && !selectedPeopleAreConnected && <ConnectPeopleDialog graph={graph} personIds={[selectedPersonIds[0], selectedPersonIds[1]]} error={error} onClose={() => setConnectionDialogOpen(false)} onConnect={connectSelectedPeople} />}
      {claimDialog}
      {sharingOpen && graph && <TreeSharingDialog tree={graph.tree} onClose={() => setSharingOpen(false)} />}
    </div>
  )
}
