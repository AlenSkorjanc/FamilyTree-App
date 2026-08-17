import { fullName } from '../api'
import type { FamilyGraph, ParentChildRelationship, Partnership, Person, UUID } from '../types'

interface Props {
  person: Person
  graph: FamilyGraph
  onClose: () => void
  onSelect: (id: UUID) => void
  onEdit: () => void
  onAddRelative: (kind: 'parent' | 'child' | 'partner') => void
  onDelete: () => void
  onRemoveParentChild: (relationship: ParentChildRelationship) => void
  onRemovePartnership: (partnership: Partnership) => void
}

export function PersonDetails({ person, graph, onClose, onSelect, onEdit, onAddRelative, onDelete, onRemoveParentChild, onRemovePartnership }: Props) {
  const byId = new Map(graph.people.map((candidate) => [candidate.id, candidate]))
  const parents = graph.parentChildRelationships.filter((relation) => relation.childId === person.id)
  const children = graph.parentChildRelationships.filter((relation) => relation.parentId === person.id)
  const partners = graph.partnerships.filter((relation) => relation.person1Id === person.id || relation.person2Id === person.id)

  const relativeRow = (relative: Person | undefined, detail: string, remove: () => void) => relative && (
    <li key={`${detail}-${relative.id}`}>
      <button className="relative-name" onClick={() => onSelect(relative.id)}>{fullName(relative)}</button>
      <small>{detail.toLowerCase()}</small>
      <button className="remove-link" onClick={remove} aria-label={`Remove relationship with ${fullName(relative)}`}>×</button>
    </li>
  )

  return (
    <aside className="details-panel">
      <header><span>Person details</span><button className="icon-button" onClick={onClose} aria-label="Close details">×</button></header>
      <div className="details-scroll">
        <div className="details-identity">
          <div className="avatar large">{person.photoUrl ? <img src={person.photoUrl} alt="" /> : <span>{person.firstName[0]}</span>}</div>
          <h2>{fullName(person)}</h2>
          {person.maidenName && <p>née {person.maidenName}</p>}
        </div>
        <dl>
          <div><dt>Born</dt><dd>{[person.birthDate, person.birthPlace].filter(Boolean).join(' · ') || 'Unknown'}</dd></div>
          {(person.deathDate || person.deathPlace) && <div><dt>Died</dt><dd>{[person.deathDate, person.deathPlace].filter(Boolean).join(' · ')}</dd></div>}
        </dl>
        {person.notes && <section><h3>Notes</h3><p className="notes">{person.notes}</p></section>}

        <RelativeSection title="Parents" onAdd={() => onAddRelative('parent')}>
          {parents.map((relation) => relativeRow(byId.get(relation.parentId), relation.relationshipType, () => onRemoveParentChild(relation)))}
        </RelativeSection>
        <RelativeSection title="Partners" onAdd={() => onAddRelative('partner')}>
          {partners.map((relation) => relativeRow(byId.get(relation.person1Id === person.id ? relation.person2Id : relation.person1Id), relation.partnershipType, () => onRemovePartnership(relation)))}
        </RelativeSection>
        <RelativeSection title="Children" onAdd={() => onAddRelative('child')}>
          {children.map((relation) => relativeRow(byId.get(relation.childId), relation.relationshipType, () => onRemoveParentChild(relation)))}
        </RelativeSection>
      </div>
      <footer>
        <button onClick={onEdit}>Edit person</button>
        <button className="danger-text" onClick={onDelete}>Delete person</button>
      </footer>
    </aside>
  )
}

function RelativeSection({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd: () => void }) {
  return <section className="relative-section"><header><h3>{title}</h3><button onClick={onAdd}>+ Add</button></header><ul>{children}</ul></section>
}
