import { useMemo, useState } from 'react'
import { fullName } from '../api'
import type { FamilyGraph, PartnershipType, PersonInput, RelationshipType, UUID } from '../types'
import { Modal } from './Modal'
import { PersonForm } from './PersonForm'

export type RelativeKind = 'parent' | 'child' | 'partner'

interface Props {
  kind: RelativeKind
  selectedId: UUID
  graph: FamilyGraph
  busy?: boolean
  error?: string | null
  onClose: () => void
  onLink: (personId: UUID, type: RelationshipType | PartnershipType) => void
  onCreate: (input: PersonInput, type: RelationshipType | PartnershipType) => void
}

export function RelativeDialog({ kind, selectedId, graph, busy, error, onClose, onLink, onCreate }: Props) {
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [query, setQuery] = useState('')
  const [candidateId, setCandidateId] = useState('')
  const [type, setType] = useState<RelationshipType | PartnershipType>(kind === 'partner' ? 'PARTNERSHIP' : 'BIOLOGICAL')
  const title = `Add ${kind}`
  const candidates = useMemo(() => {
    const childrenOf = (id: UUID) => graph.parentChildRelationships.filter((r) => r.parentId === id).map((r) => r.childId)
    const descendants = (id: UUID) => {
      const found = new Set<UUID>()
      let frontier = childrenOf(id)
      while (frontier.length) {
        const next = frontier.filter((candidate) => !found.has(candidate))
        next.forEach((candidate) => found.add(candidate))
        frontier = next.flatMap(childrenOf)
      }
      return found
    }
    const alreadyRelated = new Set(kind === 'partner'
      ? graph.partnerships.filter((r) => r.person1Id === selectedId || r.person2Id === selectedId).map((r) => r.person1Id === selectedId ? r.person2Id : r.person1Id)
      : graph.parentChildRelationships.filter((r) => kind === 'parent' ? r.childId === selectedId : r.parentId === selectedId).map((r) => kind === 'parent' ? r.parentId : r.childId))
    const cycleCandidates = kind === 'parent' ? descendants(selectedId) : kind === 'child' ? new Set(graph.people.filter((p) => descendants(p.id).has(selectedId)).map((p) => p.id)) : new Set<UUID>()
    return graph.people.filter((person) => person.id !== selectedId && !alreadyRelated.has(person.id) && !cycleCandidates.has(person.id) && fullName(person).toLowerCase().includes(query.toLowerCase()))
  }, [graph, kind, query, selectedId])

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="tabs">
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create new person</button>
        <button className={mode === 'link' ? 'active' : ''} onClick={() => setMode('link')}>Link existing person</button>
      </div>
      <label className="relationship-type">Relationship type
        <select value={type} onChange={(event) => setType(event.target.value as RelationshipType | PartnershipType)}>
          {kind === 'partner' ? <><option value="PARTNERSHIP">Partnership</option><option value="MARRIAGE">Marriage</option><option value="OTHER">Other</option></> : <><option value="BIOLOGICAL">Biological</option><option value="ADOPTIVE">Adoptive</option><option value="STEP">Step</option><option value="OTHER">Other</option></>}
        </select>
      </label>
      {mode === 'create' ? (
        <PersonForm submitLabel={`Create and add ${kind}`} busy={busy} error={error} onSubmit={(input) => onCreate(input, type)} />
      ) : (
        <div className="link-person-form">
          <label>Search people<input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a name…" /></label>
          <div className="candidate-list">
            {candidates.map((person) => <button key={person.id} className={candidateId === person.id ? 'selected' : ''} onClick={() => setCandidateId(person.id)}>{fullName(person)}</button>)}
            {candidates.length === 0 && <p>No matching people available.</p>}
          </div>
          {error && <p className="form-error">{error}</p>}
          <footer><button className="primary" disabled={!candidateId || busy} onClick={() => onLink(candidateId, type)}>{busy ? 'Linking…' : 'Link person'}</button></footer>
        </div>
      )}
    </Modal>
  )
}
