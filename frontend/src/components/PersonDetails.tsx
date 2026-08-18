import { fullName } from '../api'
import { relationshipLabel, useI18n } from '../i18n'
import type { FamilyGraph, ParentChildRelationship, Partnership, Person, UUID } from '../types'
import type { ReactNode } from 'react'
import { formatPersonDate, PersonAvatar, personGenderTone } from './PersonNode'

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
  const { t, language } = useI18n()
  const byId = new Map(graph.people.map((candidate) => [candidate.id, candidate]))
  const parents = graph.parentChildRelationships.filter((relation) => relation.childId === person.id)
  const children = graph.parentChildRelationships.filter((relation) => relation.parentId === person.id)
  const partners = graph.partnerships.filter((relation) => relation.person1Id === person.id || relation.person2Id === person.id)
  const valueOrEmpty = (value: string | null) => value?.trim() ?? ''
  const dateOrEmpty = (value: string | null) => value ? formatPersonDate(value, language) : ''
  const gender = personGenderTone(person.gender)
  const genderLabel = gender === 'male' ? t('male') : gender === 'female' ? t('female') : valueOrEmpty(person.gender)

  const relativeRow = (relative: Person | undefined, detail: string, remove: () => void) => relative && (
    <li key={`${detail}-${relative.id}`}>
      <button className="relative-name" onClick={() => onSelect(relative.id)}>{fullName(relative)}</button>
      <small>{relationshipLabel(detail, t).toLowerCase()}</small>
      <button className="remove-link" onClick={remove} aria-label={t('removeRelationship', { name: fullName(relative) })}>×</button>
    </li>
  )

  return (
    <aside className="details-panel">
      <header><span>{t('personDetails')}</span><button className="icon-button" onClick={onClose} aria-label={t('closeDetails')}>×</button></header>
      <div className="details-scroll">
        <div className={`details-identity person-node-${gender}`}>
          <PersonAvatar person={person} />
          <h2>{fullName(person)}</h2>
        </div>
        <dl className="person-data">
          <DetailRow label={t('firstName')} value={valueOrEmpty(person.firstName)} />
          <DetailRow label={t('middleName')} value={valueOrEmpty(person.middleName)} />
          <DetailRow label={t('lastName')} value={valueOrEmpty(person.lastName)} />
          <DetailRow label={t('maidenName')} value={valueOrEmpty(person.maidenName)} />
          <DetailRow label={t('gender')} value={genderLabel} />
          <DetailRow label={t('birthDate')} value={dateOrEmpty(person.birthDate)} />
          <DetailRow label={t('birthPlace')} value={valueOrEmpty(person.birthPlace)} />
          <DetailRow label={t('deathDate')} value={dateOrEmpty(person.deathDate)} />
          <DetailRow label={t('deathPlace')} value={valueOrEmpty(person.deathPlace)} />
          <DetailRow label={t('notes')} value={valueOrEmpty(person.notes)} long />
        </dl>

        <RelativeSection title={t('parents')} addLabel={t('add')} onAdd={() => onAddRelative('parent')}>
          {parents.map((relation) => relativeRow(byId.get(relation.parentId), relation.relationshipType, () => onRemoveParentChild(relation)))}
        </RelativeSection>
        <RelativeSection title={t('partners')} addLabel={t('add')} onAdd={() => onAddRelative('partner')}>
          {partners.map((relation) => relativeRow(byId.get(relation.person1Id === person.id ? relation.person2Id : relation.person1Id), relation.partnershipType, () => onRemovePartnership(relation)))}
        </RelativeSection>
        <RelativeSection title={t('children')} addLabel={t('add')} onAdd={() => onAddRelative('child')}>
          {children.map((relation) => relativeRow(byId.get(relation.childId), relation.relationshipType, () => onRemoveParentChild(relation)))}
        </RelativeSection>
      </div>
      <footer>
        <button onClick={onEdit}>{t('editPerson')}</button>
        <button className="danger-text" onClick={onDelete}>{t('deletePerson')}</button>
      </footer>
    </aside>
  )
}

function DetailRow({ label, value, long = false }: { label: string; value: string; long?: boolean }) {
  return <div className={long ? 'person-data-long' : undefined}><dt>{label}</dt><dd>{value}</dd></div>
}

function RelativeSection({ title, addLabel, children, onAdd }: { title: string; addLabel: string; children: ReactNode; onAdd: () => void }) {
  return <section className="relative-section"><header><h3>{title}</h3><button onClick={onAdd}>{addLabel}</button></header><ul>{children}</ul></section>
}
