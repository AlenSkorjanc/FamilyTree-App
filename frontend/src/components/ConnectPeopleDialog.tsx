import { useState } from 'react'
import { fullName } from '../api'
import { useI18n } from '../i18n'
import type { FamilyGraph, PartnershipType, RelationshipType, UUID } from '../types'
import { Modal } from './Modal'
import { SharedChildrenPicker } from './RelativeDialog'

type ConnectionChoice = 'PARTNERS' | 'FIRST_PARENT' | 'SECOND_PARENT'

export type PeopleConnection =
  | { kind: 'partner'; person1Id: UUID; person2Id: UUID; partnershipType: PartnershipType; copyChildrenFromPersonId?: UUID; sharedChildIds?: UUID[]; isCurrent: boolean }
  | { kind: 'parent-child'; parentId: UUID; childId: UUID; relationshipType: RelationshipType }

interface Props {
  graph: FamilyGraph
  personIds: [UUID, UUID]
  busy?: boolean
  error?: string | null
  onClose: () => void
  onConnect: (connection: PeopleConnection) => void
}

export function ConnectPeopleDialog({ graph, personIds, busy, error, onClose, onConnect }: Props) {
  const { t } = useI18n()
  const first = graph.people.find((person) => person.id === personIds[0])
  const second = graph.people.find((person) => person.id === personIds[1])
  const [choice, setChoice] = useState<ConnectionChoice>('PARTNERS')
  const [partnershipType, setPartnershipType] = useState<PartnershipType>('PARTNERSHIP')
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('BIOLOGICAL')
  const [isCurrent, setCurrent] = useState(false)
  const childSources = personIds.filter((personId) => graph.parentChildRelationships.some((relationship) => relationship.parentId === personId))
  const [childrenSourceId, setChildrenSourceId] = useState<UUID>(childSources[0] ?? '')
  const childrenFor = (parentId: UUID) => graph.parentChildRelationships
    .filter((relationship) => relationship.parentId === parentId)
    .map((relationship) => graph.people.find((person) => person.id === relationship.childId))
    .filter((person) => person !== undefined)
  const [sharedChildIds, setSharedChildIds] = useState<UUID[]>(() => childrenFor(childSources[0] ?? '').map((child) => child.id))

  if (!first || !second) return null
  const names = { first: fullName(first), second: fullName(second) }
  const submit = () => {
    if (choice === 'PARTNERS') {
      const selectedSharedChildIds = partnershipType === 'PARTNERSHIP' ? sharedChildIds : []
      onConnect({
        kind: 'partner', person1Id: first.id, person2Id: second.id, partnershipType,
        copyChildrenFromPersonId: selectedSharedChildIds.length && childrenSourceId ? childrenSourceId : undefined,
        sharedChildIds: partnershipType === 'PARTNERSHIP' && selectedSharedChildIds.length ? selectedSharedChildIds : undefined,
        isCurrent,
      })
      return
    }
    onConnect({
      kind: 'parent-child',
      parentId: choice === 'FIRST_PARENT' ? first.id : second.id,
      childId: choice === 'FIRST_PARENT' ? second.id : first.id,
      relationshipType,
    })
  }

  return <Modal title={t('connectPeople')} onClose={onClose}>
    <div className="connection-form">
      <label>{t('connection')}
        <select value={choice} onChange={(event) => setChoice(event.target.value as ConnectionChoice)}>
          <option value="PARTNERS">{t('partnersConnection', names)}</option>
          <option value="FIRST_PARENT">{t('firstParentConnection', names)}</option>
          <option value="SECOND_PARENT">{t('secondParentConnection', names)}</option>
        </select>
      </label>
      {choice === 'PARTNERS' && <label className="current-partner-checkbox"><input type="checkbox" checked={isCurrent} onChange={(event) => setCurrent(event.target.checked)} /><span>{t('setAsCurrentPartner')}</span></label>}
      <label>{t('relationshipType')}
        {choice === 'PARTNERS' ? <select value={partnershipType} onChange={(event) => setPartnershipType(event.target.value as PartnershipType)}>
          <option value="PARTNERSHIP">{t('partnership')}</option><option value="MARRIAGE">{t('marriage')}</option><option value="OTHER">{t('other')}</option>
        </select> : <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)}>
          <option value="BIOLOGICAL">{t('biological')}</option><option value="ADOPTIVE">{t('adoptive')}</option><option value="STEP">{t('step')}</option><option value="OTHER">{t('other')}</option>
        </select>}
      </label>
      {choice === 'PARTNERS' && partnershipType === 'PARTNERSHIP' && childSources.length > 0 && <>
        {childSources.length > 1 && <label>{t('childrenSource')}
          <select value={childrenSourceId} onChange={(event) => {
            const sourceId = event.target.value
            setChildrenSourceId(sourceId)
            setSharedChildIds(childrenFor(sourceId).map((child) => child.id))
          }}>
            {childSources.map((personId) => <option key={personId} value={personId}>{fullName(personId === first.id ? first : second)}</option>)}
          </select>
        </label>}
        <SharedChildrenPicker children={childrenFor(childrenSourceId)} selectedIds={sharedChildIds} onChange={setSharedChildIds} />
      </>}
      {error && <p className="form-error">{error}</p>}
      <footer><button className="primary" disabled={busy} onClick={submit}>{t('connectPeopleAction')}</button></footer>
    </div>
  </Modal>
}
