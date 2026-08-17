import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fullName } from './api'
import { FamilyGraphCanvas } from './components/FamilyGraphCanvas'
import { Modal } from './components/Modal'
import { PersonDetails } from './components/PersonDetails'
import { PersonForm } from './components/PersonForm'
import { RelativeDialog, type RelativeKind } from './components/RelativeDialog'
import type { PartnershipType, PersonInput, RelationshipType, UUID } from './types'

export default function App() {
  const queryClient = useQueryClient()
  const treesQuery = useQuery({ queryKey: ['trees'], queryFn: api.listTrees })
  const [treeId, setTreeId] = useState<UUID | null>(null)
  const [selectedId, setSelectedId] = useState<UUID | null>(null)
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
  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['graph', treeId] }), queryClient.invalidateQueries({ queryKey: ['trees'] })])
  }
  const run = async (operation: () => Promise<unknown>, after?: () => void) => {
    setError(null)
    try { await operation(); await refresh(); after?.() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Something went wrong') }
  }
  const focusPerson = (id: UUID) => {
    setSelectedId(id)
    setFocusId(null)
    window.setTimeout(() => setFocusId(id), 0)
    setSearch('')
  }

  const createTree = useMutation({ mutationFn: api.createTree, onSuccess: async (tree) => {
    await queryClient.invalidateQueries({ queryKey: ['trees'] }); setTreeId(tree.id); setNewTreeName('')
  } })

  const savePerson = (input: PersonInput) => {
    if (!treeId) return
    const operation = personModal === 'edit' && selected ? api.updatePerson(treeId, selected.id, input) : api.createPerson(treeId, input)
    void run(async () => {
      const saved = await operation
      setSelectedId(saved.id)
    }, () => setPersonModal(null))
  }

  const connectRelative = async (relativeId: UUID, type: RelationshipType | PartnershipType) => {
    if (!treeId || !selectedId || !relativeKind) return
    if (relativeKind === 'partner') await api.createPartnership(treeId, selectedId, relativeId, type as PartnershipType)
    else await api.createParentChild(treeId, relativeKind === 'parent' ? relativeId : selectedId, relativeKind === 'child' ? relativeId : selectedId, type as RelationshipType)
  }

  const addRelative = (inputOrId: PersonInput | UUID, type: RelationshipType | PartnershipType) => {
    if (!treeId) return
    void run(async () => {
      const relativeId = typeof inputOrId === 'string' ? inputOrId : (await api.createPerson(treeId, inputOrId)).id
      await connectRelative(relativeId, type)
    }, () => setRelativeKind(null))
  }

  if (treesQuery.isLoading) return <div className="center-message">Loading your family trees…</div>
  if (treesQuery.isError) return <div className="center-message error">Could not reach the family-tree API.</div>

  if (!treesQuery.data?.length) return (
    <main className="welcome">
      <div className="brand">Family Tree</div>
      <section><span className="sprout">⌘</span><h1>Start your family story</h1><p>Create a tree, then add people and connect their relationships.</p>
        <form onSubmit={(event) => { event.preventDefault(); if (newTreeName.trim()) createTree.mutate(newTreeName.trim()) }}>
          <input value={newTreeName} onChange={(event) => setNewTreeName(event.target.value)} placeholder="Tree name, e.g. The Novak Family" autoFocus />
          <button className="primary" disabled={!newTreeName.trim() || createTree.isPending}>Create family tree</button>
        </form>
      </section>
    </main>
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Family Tree</div>
        <div className="tree-switcher">
          <select value={treeId ?? ''} onChange={(event) => { setTreeId(event.target.value); setSelectedId(null) }}>
            {treesQuery.data.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
          </select>
          <button className="quiet" onClick={() => {
            const name = window.prompt('New family tree name')?.trim()
            if (name) createTree.mutate(name)
          }}>+ New tree</button>
          {graph && <button className="quiet" onClick={() => {
            const name = window.prompt('Rename family tree', graph.tree.name)?.trim()
            if (name && treeId) void run(() => api.updateTree(treeId, name))
          }}>Rename</button>}
        </div>
        <div className="global-search">
          <span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people…" />
          {search && <div className="search-results">
            {searchQuery.data?.map((person) => <button key={person.id} onClick={() => focusPerson(person.id)}><strong>{fullName(person)}</strong><small>{person.birthDate?.slice(0, 4) ?? 'Birth year unknown'}</small></button>)}
            {!searchQuery.isFetching && searchQuery.data?.length === 0 && <p>No people found</p>}
          </div>}
        </div>
        <button className="primary add-person" onClick={() => { setError(null); setPersonModal('create') }}>+ Add person</button>
      </header>

      <main className={`canvas-area ${selected ? 'with-details' : ''}`}>
        {graphQuery.isLoading && <div className="center-message">Arranging the family tree…</div>}
        {graphQuery.isError && <div className="center-message error">Could not load this tree.</div>}
        {graph && graph.people.length === 0 && <div className="empty-tree"><div className="empty-avatar">+</div><h2>Your tree is ready</h2><p>Add the first person to begin connecting your family.</p><button className="primary" onClick={() => setPersonModal('create')}>+ Add first person</button></div>}
        {graph && graph.people.length > 0 && <FamilyGraphCanvas graph={graph} selectedId={selectedId} focusId={focusId} onSelect={(id) => { setSelectedId(id); setFocusId(id) }} />}
      </main>

      {selected && graph && <PersonDetails person={selected} graph={graph} onClose={() => setSelectedId(null)} onSelect={focusPerson} onEdit={() => { setError(null); setPersonModal('edit') }} onAddRelative={(kind) => { setError(null); setRelativeKind(kind) }}
        onDelete={() => { if (treeId && window.confirm(`Delete ${fullName(selected)}? Their relationships will also be removed.`)) void run(() => api.deletePerson(treeId, selected.id), () => setSelectedId(null)) }}
        onRemoveParentChild={(relationship) => { if (treeId) void run(() => api.deleteParentChild(treeId, relationship.id)) }}
        onRemovePartnership={(partnership) => { if (treeId) void run(() => api.deletePartnership(treeId, partnership.id)) }} />}

      {personModal && <Modal title={personModal === 'edit' ? 'Edit person' : 'Add person'} onClose={() => setPersonModal(null)} wide><PersonForm person={personModal === 'edit' ? selected ?? undefined : undefined} busy={false} error={error} onSubmit={savePerson} /></Modal>}
      {relativeKind && selectedId && graph && <RelativeDialog kind={relativeKind} selectedId={selectedId} graph={graph} error={error} onClose={() => setRelativeKind(null)} onLink={addRelative} onCreate={addRelative} />}
    </div>
  )
}
