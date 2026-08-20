import { fullName } from '../api'
import { partnershipStatusLabel, relationshipLabel, useI18n } from '../i18n'
import type { FamilyGraph, ParentChildRelationship, Partnership, PartnershipType, Person, PersonInput, UUID } from '../types'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { formatPersonDate, PersonAvatar, personGenderTone } from './PersonNode'
import { PersonForm } from './PersonForm'

type SheetSize = 'half' | 'full'
type SheetStyle = CSSProperties & { '--sheet-drag-offset': string }

interface Props {
  person: Person
  graph: FamilyGraph
  editing?: boolean
  readOnly?: boolean
  error?: string | null
  onClose: () => void
  onSelect: (id: UUID) => void
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (input: PersonInput, photoFile?: File) => void
  onDelete: () => void
  onAddRelative: (kind: 'parent' | 'child' | 'partner') => void
  onRemoveParentChild: (relationship: ParentChildRelationship) => void
  onRemovePartnership: (partnership: Partnership) => void
  onUpdatePartnership: (partnership: Partnership, partnershipType: PartnershipType) => void
  onSetCurrentPartner: (partnerId: UUID | null) => void
}

export function PersonDetails({ person, graph, editing = false, readOnly = false, error, onClose, onSelect, onEdit, onCancelEdit, onSave, onDelete, onAddRelative, onRemoveParentChild, onRemovePartnership, onUpdatePartnership, onSetCurrentPartner }: Props) {
  const { t, language } = useI18n()
  const [sheetSize, setSheetSize] = useState<SheetSize>('half')
  const [dragOffset, setDragOffset] = useState(0)
  const [editingPartnershipId, setEditingPartnershipId] = useState<UUID | null>(null)
  const [partnershipTypeDraft, setPartnershipTypeDraft] = useState<PartnershipType>('PARTNERSHIP')
  const [currentPartnerPickerOpen, setCurrentPartnerPickerOpen] = useState(false)
  const dragStart = useRef<{ pointerId: number; y: number } | null>(null)
  const dragged = useRef(false)
  useEffect(() => {
    setSheetSize('half')
    setDragOffset(0)
    setEditingPartnershipId(null)
    setCurrentPartnerPickerOpen(false)
  }, [person.id])
  useEffect(() => {
    if (editing) setSheetSize('full')
  }, [editing])
  const byId = new Map(graph.people.map((candidate) => [candidate.id, candidate]))
  const parents = graph.parentChildRelationships.filter((relation) => relation.childId === person.id)
  const children = graph.parentChildRelationships.filter((relation) => relation.parentId === person.id)
  const partners = graph.partnerships.filter((relation) => relation.person1Id === person.id || relation.person2Id === person.id)
  const currentPartnerRelation = partners.find((relation) => relation.isCurrent)
  const currentPartner = currentPartnerRelation
    ? byId.get(currentPartnerRelation.person1Id === person.id ? currentPartnerRelation.person2Id : currentPartnerRelation.person1Id)
    : undefined
  const valueOrEmpty = (value: string | null) => value?.trim() ?? ''
  const dateOrEmpty = (value: string | null) => value ? formatPersonDate(value, language) : ''
  const gender = personGenderTone(person.gender)
  const genderLabel = gender === 'male' ? t('male') : gender === 'female' ? t('female') : valueOrEmpty(person.gender)
  const sheetStyle: SheetStyle = { '--sheet-drag-offset': `${dragOffset}px` }
  const startSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStart.current = { pointerId: event.pointerId, y: event.clientY }
    dragged.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveSheet = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return
    const distance = event.clientY - dragStart.current.y
    if (Math.abs(distance) > 5) dragged.current = true
    setDragOffset(distance)
  }
  const finishSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return
    const distance = event.clientY - dragStart.current.y
    dragStart.current = null
    setDragOffset(0)
    if (sheetSize === 'full' && distance > 70) setSheetSize('half')
    else if (sheetSize === 'half' && distance < -70) setSheetSize('full')
    else if (sheetSize === 'half' && distance > 70) onClose()
    if (dragged.current) window.setTimeout(() => { dragged.current = false }, 0)
  }
  const cancelSheetDrag = () => {
    dragStart.current = null
    dragged.current = false
    setDragOffset(0)
  }
  const toggleSheetSize = () => {
    if (dragged.current) {
      return
    }
    setSheetSize((current) => current === 'half' ? 'full' : 'half')
  }

  const relativeRow = (relative: Person | undefined, detail: string, remove: () => void) => relative && (
    <li key={`${detail}-${relative.id}`}>
      <button className="relative-name" onClick={() => onSelect(relative.id)}>{fullName(relative)}</button>
      <small>{relationshipLabel(detail, t).toLowerCase()}</small>
      {!readOnly && <button className="remove-link" onClick={remove} aria-label={t('removeRelationship', { name: fullName(relative) })}>×</button>}
    </li>
  )

  const partnerRow = (relation: Partnership) => {
    const partner = byId.get(relation.person1Id === person.id ? relation.person2Id : relation.person1Id)
    if (!partner) return null
    const isEditing = editingPartnershipId === relation.id
    return (
      <li key={relation.id} className={isEditing ? 'relationship-edit-row' : undefined}>
        <button className="relative-name" onClick={() => onSelect(partner.id)}>{fullName(partner)}</button>
        {isEditing ? <div className="relationship-inline-editor">
          <select aria-label={t('relationshipType')} value={partnershipTypeDraft} onChange={(event) => setPartnershipTypeDraft(event.target.value as PartnershipType)}>
            <option value="PARTNERSHIP">{t('partnership')}</option>
            <option value="MARRIAGE">{t('marriage')}</option>
            <option value="OTHER">{t('other')}</option>
          </select>
          <button className="relationship-save" onClick={() => { onUpdatePartnership(relation, partnershipTypeDraft); setEditingPartnershipId(null) }}>{t('saveRelationship')}</button>
          <button className="quiet" onClick={() => setEditingPartnershipId(null)}>{t('cancel')}</button>
        </div> : <>
          <small>{partnershipStatusLabel(relation.partnershipType, t)}{relation.isCurrent ? ` · ${t('currentPartnerShort')}` : ''}</small>
          {!readOnly && <div className="relationship-actions">
            <button className="edit-link" onClick={() => { setPartnershipTypeDraft(relation.partnershipType); setEditingPartnershipId(relation.id) }} aria-label={t('editRelationship')} title={t('editRelationship')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.8 6.5 2.8 2.8" /></svg>
            </button>
            <button className="remove-link" onClick={() => onRemovePartnership(relation)} aria-label={t('removeRelationship', { name: fullName(partner) })}>×</button>
          </div>}
        </>}
      </li>
    )
  }

  return (
    <aside className="details-panel" data-sheet-size={sheetSize} data-dragging={dragStart.current !== null} style={sheetStyle}>
      <button
        type="button"
        className="sheet-handle"
        aria-label={sheetSize === 'half' ? t('expandDetails') : t('collapseDetails')}
        onClick={toggleSheetSize}
        onPointerDown={startSheetDrag}
        onPointerMove={moveSheet}
        onPointerUp={finishSheetDrag}
        onPointerCancel={cancelSheetDrag}
      />
      <header>
        <div className="details-header-title">
          <span>{editing ? t('editPerson') : t('personDetails')}</span>
          {editing && !readOnly && <button className="details-delete-button" onClick={onDelete} aria-label={t('deletePerson')} title={t('deletePerson')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
          </button>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t('closeDetails')}>×</button>
      </header>
      {editing ? (
        <div className="details-scroll details-edit-scroll">
          <PersonForm person={person} error={error} autoFocusFirstField={!isMobileEditor()} onSubmit={onSave} onCancel={onCancelEdit} />
        </div>
      ) : <div className="details-scroll">
        <div className={`details-identity person-node-${gender}`}>
          <PersonAvatar person={person} />
          <div className="details-name-row">
            <h2>{fullName(person)}</h2>
            {!readOnly && <button className="details-edit-button" onClick={onEdit} aria-label={t('editPerson')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.8 6.5 2.8 2.8" /></svg>
            </button>}
          </div>
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

        <RelativeSection title={t('parents')} addLabel={t('add')} onAdd={readOnly ? undefined : () => onAddRelative('parent')}>
          {parents.map((relation) => relativeRow(byId.get(relation.parentId), relation.relationshipType, () => onRemoveParentChild(relation)))}
        </RelativeSection>
        <RelativeSection title={t('partners')} addLabel={t('add')} onAdd={readOnly ? undefined : () => onAddRelative('partner')}>
          {partners.map(partnerRow)}
          {!readOnly && partners.length > 1 && <li className="current-partner-picker-row">
            <button type="button" className="current-partner-picker-toggle" aria-expanded={currentPartnerPickerOpen} onClick={() => setCurrentPartnerPickerOpen((open) => !open)}>
              <span><strong>{t('currentPartner')}</strong><small>{currentPartner ? fullName(currentPartner) : t('noCurrentPartner')}</small></span>
              <span className="shared-children-chevron" aria-hidden="true" />
            </button>
            {currentPartnerPickerOpen && <fieldset className="current-partner-picker">
              <legend>{t('currentPartner')}</legend>
              {partners.map((relation) => {
                const partner = byId.get(relation.person1Id === person.id ? relation.person2Id : relation.person1Id)
                return partner && <label key={relation.id}><input type="radio" name={`current-partner-${person.id}`} checked={relation.isCurrent} onChange={() => onSetCurrentPartner(partner.id)} /><span>{fullName(partner)}</span></label>
              })}
              <label><input type="radio" name={`current-partner-${person.id}`} checked={partners.every((relation) => !relation.isCurrent)} onChange={() => onSetCurrentPartner(null)} /><span>{t('noCurrentPartner')}</span></label>
            </fieldset>}
          </li>}
        </RelativeSection>
        <RelativeSection title={t('children')} addLabel={t('add')} onAdd={readOnly ? undefined : () => onAddRelative('child')}>
          {children.map((relation) => relativeRow(byId.get(relation.childId), relation.relationshipType, () => onRemoveParentChild(relation)))}
        </RelativeSection>
      </div>}
    </aside>
  )
}

function isMobileEditor() {
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 520px), (pointer: coarse)').matches === true
}

function DetailRow({ label, value, long = false }: { label: string; value: string; long?: boolean }) {
  return <div className={long ? 'person-data-long' : undefined}><dt>{label}</dt><dd>{value}</dd></div>
}

function RelativeSection({ title, addLabel, children, onAdd }: { title: string; addLabel: string; children: ReactNode; onAdd?: () => void }) {
  return <section className="relative-section"><header><h3>{title}</h3>{onAdd && <button onClick={onAdd}>{addLabel}</button>}</header><ul>{children}</ul></section>
}
