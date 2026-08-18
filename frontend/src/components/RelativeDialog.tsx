import { useId, useMemo, useState } from 'react'
import { fullName } from '../api'
import type { FamilyGraph, PartnershipType, Person, PersonInput, RelationshipType, UUID } from '../types'
import { Modal } from './Modal'
import { PersonForm } from './PersonForm'
import { useI18n } from '../i18n'
import { PersonAvatar, personGenderTone } from './PersonNode'

export type RelativeKind = 'parent' | 'child' | 'partner'

interface Props {
  kind: RelativeKind
  selectedId: UUID
  graph: FamilyGraph
  busy?: boolean
  error?: string | null
  onClose: () => void
  onLink: (personId: UUID, type: RelationshipType | PartnershipType, secondParentId?: UUID, sharedChildIds?: UUID[], sharedChildrenSourceId?: UUID) => void
  onCreate: (input: PersonInput, type: RelationshipType | PartnershipType, photoFile?: File, secondParentId?: UUID, sharedChildIds?: UUID[]) => void
}

export function RelativeDialog({ kind, selectedId, graph, busy, error, onClose, onLink, onCreate }: Props) {
  const selectedPerson = graph.people.find((person) => person.id === selectedId)
  const secondParentOptions = kind === 'child' ? graph.partnerships
    .filter((partnership) => partnership.person1Id === selectedId || partnership.person2Id === selectedId)
    .map((partnership) => graph.people.find((person) => person.id === (partnership.person1Id === selectedId ? partnership.person2Id : partnership.person1Id)))
    .filter((person) => person !== undefined) : []
  const { t } = useI18n()
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [query, setQuery] = useState('')
  const [candidateId, setCandidateId] = useState('')
  const [type, setType] = useState<RelationshipType | PartnershipType>(kind === 'partner' ? 'PARTNERSHIP' : 'BIOLOGICAL')
  const [secondParentId, setSecondParentId] = useState<UUID>(secondParentOptions.length === 1 ? secondParentOptions[0].id : '')
  const childrenFor = (parentId: UUID) => graph.parentChildRelationships
    .filter((relationship) => relationship.parentId === parentId)
    .map((relationship) => graph.people.find((person) => person.id === relationship.childId))
    .filter((person) => person !== undefined)
  const possibleChildren = childrenFor(selectedId)
  const [sharedChildIds, setSharedChildIds] = useState<UUID[]>(possibleChildren.map((child) => child.id))
  const [sharedChildrenSourceId, setSharedChildrenSourceId] = useState<UUID>(selectedId)
  const kindLabel = t(kind)
  const title = t('addRelative', { kind: kindLabel })
  const suggestedLastName = kind === 'parent' ? selectedPerson?.maidenName ?? selectedPerson?.lastName : kind === 'child' ? selectedPerson?.lastName : null
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
    const ancestors = new Set(graph.people.filter((person) => descendants(person.id).has(selectedId)).map((person) => person.id))
    const cycleCandidates = kind === 'parent' ? descendants(selectedId) : kind === 'child' ? ancestors : new Set([...descendants(selectedId), ...ancestors])
    const incompatibleCandidates = new Set(kind === 'partner'
      ? graph.parentChildRelationships.filter((r) => r.parentId === selectedId || r.childId === selectedId).map((r) => r.parentId === selectedId ? r.childId : r.parentId)
      : graph.partnerships.filter((r) => r.person1Id === selectedId || r.person2Id === selectedId).map((r) => r.person1Id === selectedId ? r.person2Id : r.person1Id))
    return graph.people.filter((person) => person.id !== selectedId && !alreadyRelated.has(person.id) && !cycleCandidates.has(person.id) && !incompatibleCandidates.has(person.id) && fullName(person).toLowerCase().includes(query.toLowerCase()))
  }, [graph, kind, query, selectedId])
  const candidateChildren = candidateId ? childrenFor(candidateId) : []
  const chooseCandidate = (personId: UUID) => {
    setCandidateId(personId)
    setSharedChildrenSourceId(personId)
    setSharedChildIds(childrenFor(personId).map((child) => child.id))
  }
  const showLinkChildren = kind === 'partner' && type === 'PARTNERSHIP' && candidateChildren.length > 0

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="tabs">
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>{t('createNewPerson')}</button>
        <button className={mode === 'link' ? 'active' : ''} onClick={() => setMode('link')}>{t('linkExistingPerson')}</button>
      </div>
      <label className="relationship-type">{t('relationshipType')}
        <select value={type} onChange={(event) => setType(event.target.value as RelationshipType | PartnershipType)}>
          {kind === 'partner' ? <><option value="PARTNERSHIP">{t('partnership')}</option><option value="MARRIAGE">{t('marriage')}</option><option value="OTHER">{t('other')}</option></> : <><option value="BIOLOGICAL">{t('biological')}</option><option value="ADOPTIVE">{t('adoptive')}</option><option value="STEP">{t('step')}</option><option value="OTHER">{t('other')}</option></>}
        </select>
      </label>
      {kind === 'child' && secondParentOptions.length > 0 && <label className="relationship-type">{t('secondParent')}
        <select value={secondParentId} onChange={(event) => setSecondParentId(event.target.value)}>
          <option value="">{t('noSecondParent')}</option>
          {secondParentOptions.map((person) => <option key={person.id} value={person.id}>{fullName(person)}</option>)}
        </select>
        {secondParentId && <small>{t('secondParentHelp')}</small>}
      </label>}
      {mode === 'create' ? (
        <>
          {kind === 'partner' && type === 'PARTNERSHIP' && possibleChildren.length > 0 && <SharedChildrenPicker
            children={possibleChildren} selectedIds={sharedChildIds} onChange={setSharedChildIds}
          />}
          <PersonForm initialValues={{ lastName: suggestedLastName }} submitLabel={t('createAndAdd', { kind: kindLabel })} busy={busy} error={error} onSubmit={(input, photoFile) => onCreate(input, type, photoFile, secondParentId || undefined, kind === 'partner' && type === 'PARTNERSHIP' ? sharedChildIds : undefined)} />
        </>
      ) : (
        <div className="link-person-form">
          <div className={`link-person-content ${showLinkChildren ? 'with-children' : ''}`}>
            <section className="link-person-section candidate-section">
              <label>{t('searchPeopleLabel')}<input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('typeName')} /></label>
              <div className="candidate-list">
                {candidates.map((person) => <button
                  key={person.id}
                  aria-label={fullName(person)}
                  className={`candidate-card person-node-${personGenderTone(person.gender)} ${candidateId === person.id ? 'selected' : ''}`}
                  onClick={() => chooseCandidate(person.id)}
                >
                  <PersonAvatar person={person} className="candidate-avatar" />
                  <span className="candidate-copy"><strong>{fullName(person)}</strong><small>{person.birthDate?.slice(0, 4) ?? t('birthYearUnknown')}</small></span>
                  <span className="candidate-check" aria-hidden="true">✓</span>
                </button>)}
                {candidates.length === 0 && <p>{t('noCandidates')}</p>}
              </div>
            </section>
            {showLinkChildren && <section className="link-person-section children-section">
              <SharedChildrenPicker children={candidateChildren} selectedIds={sharedChildIds} onChange={setSharedChildIds} />
            </section>}
          </div>
          {error && <p className="form-error">{error}</p>}
          <footer><button className="primary" disabled={!candidateId || busy} onClick={() => onLink(
            candidateId, type, secondParentId || undefined,
            kind === 'partner' && type === 'PARTNERSHIP' ? sharedChildIds : undefined,
            kind === 'partner' && type === 'PARTNERSHIP' && sharedChildIds.length ? sharedChildrenSourceId : undefined,
          )}>{busy ? t('linking') : t('linkPerson')}</button></footer>
        </div>
      )}
    </Modal>
  )
}

export function SharedChildrenPicker({ children, selectedIds, onChange }: { children: Person[]; selectedIds: UUID[]; onChange: (ids: UUID[]) => void }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const allSelected = children.every((child) => selectedIds.includes(child.id))
  const toggleChild = (childId: UUID) => onChange(selectedIds.includes(childId) ? selectedIds.filter((id) => id !== childId) : [...selectedIds, childId])
  return <fieldset className="shared-children-picker">
    <div className="shared-children-option">
      <input
        aria-label={t('shareChildren')}
        type="checkbox"
        checked={allSelected}
        ref={(element) => { if (element) element.indeterminate = selectedIds.length > 0 && !allSelected }}
        onChange={() => {
          onChange(allSelected ? [] : children.map((child) => child.id))
          setExpanded(true)
        }}
      />
      <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((current) => !current)}>
        <span><strong>{t('shareChildren')}</strong><small>{t('shareChildrenHelp', { count: String(selectedIds.length) })}</small></span>
        <span className="shared-children-chevron" aria-hidden="true" />
      </button>
    </div>
    {expanded && <div id={detailsId} className="shared-children-list">
      {children.map((child) => <label key={child.id}><input type="checkbox" checked={selectedIds.includes(child.id)} onChange={() => toggleChild(child.id)} /><span>{fullName(child)}</span></label>)}
    </div>}
  </fieldset>
}
