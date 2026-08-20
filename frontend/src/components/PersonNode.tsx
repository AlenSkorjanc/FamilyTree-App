import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { fullName, resolvePhotoUrl } from '../api'
import type { Person } from '../types'
import { useI18n } from '../i18n'
import type { RelativeKind } from './RelativeDialog'

export type PersonNodeData = {
  person: Person
  onAddRelative?: (kind: RelativeKind) => void
  isAlias?: boolean
  quickAddEnabled?: boolean
  canAddParent?: boolean
  joinedPartnerLeft?: boolean
  joinedPartnerRight?: boolean
}
export type PersonFlowNode = Node<PersonNodeData, 'person'>

export function formatPersonDate(date: string, language = 'en'): string {
  return new Intl.DateTimeFormat(language === 'sl' ? 'sl-SI' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function lifeYears(person: Person, bornLabel = 'Born', language = 'en'): string {
  const birth = person.birthDate ? formatPersonDate(person.birthDate, language) : '?'
  const death = person.deathDate ? formatPersonDate(person.deathDate, language) : undefined
  return death ? `${birth} – ${death}` : `${bornLabel} ${birth}`
}

export function personGenderTone(gender: string | null | undefined): 'male' | 'female' | 'neutral' {
  const normalized = gender?.trim().toUpperCase()
  if (normalized === 'MALE' || normalized === 'MOŠKI' || normalized === 'MOSKI' || normalized === 'M') return 'male'
  if (normalized === 'FEMALE' || normalized === 'ŽENSKI' || normalized === 'ZENSKI' || normalized === 'ŽENSKA' || normalized === 'ZENSKA' || normalized === 'F') return 'female'
  return 'neutral'
}

export function bornTranslationKey(gender: string | null | undefined): 'bornMale' | 'bornFemale' | 'born' {
  const tone = personGenderTone(gender)
  return tone === 'male' ? 'bornMale' : tone === 'female' ? 'bornFemale' : 'born'
}

export function PersonNode({ data, selected }: NodeProps<PersonFlowNode>) {
  const { t, language } = useI18n()
  const genderTone = personGenderTone(data.person.gender)
  const bornLabel = t(bornTranslationKey(data.person.gender))
  return (
    <article className={`person-node person-node-${genderTone} ${selected ? 'selected' : ''} ${data.isAlias ? 'person-node-alias' : ''} ${data.joinedPartnerLeft ? 'person-node-joined-left' : ''} ${data.joinedPartnerRight ? 'person-node-joined-right' : ''}`} aria-label={fullName(data.person)}>
      {data.isAlias && <span className="person-alias-badge">↗ {t('samePerson')}</span>}
      <Handle type="target" position={Position.Top} id="parent" />
      <PersonAvatar person={data.person} />
      <div className="person-node-copy">
        <strong>{fullName(data.person)}</strong>
        <small>{lifeYears(data.person, bornLabel, language)}</small>
      </div>
      {!data.isAlias && data.onAddRelative && data.quickAddEnabled !== false && <div className="node-quick-add nodrag nowheel">
        {(['parent', 'partner', 'child'] as const).filter((kind) => kind !== 'parent' || data.canAddParent !== false).map((kind) => (
          <button key={kind} aria-label={t('quickAddRelative', { kind: t(kind) })} onClick={(event) => { event.stopPropagation(); data.onAddRelative?.(kind) }}>
            {t(kind === 'parent' ? 'quickParent' : kind === 'partner' ? 'quickPartner' : 'quickChild')}
          </button>
        ))}
      </div>}
      <Handle type="source" position={Position.Bottom} id="partner-bottom-source" />
      <Handle type="target" position={Position.Bottom} id="partner-bottom-target" />
      <Handle type="source" position={Position.Bottom} id="child" />
    </article>
  )
}

export function PersonAvatar({ person, className = '' }: { person: Person; className?: string }) {
  const initials = [person.firstName, person.lastName].filter(Boolean).map((name) => name![0]).join('').toUpperCase()
  return <div className={`avatar ${className}`}>{person.photoUrl ? <img src={resolvePhotoUrl(person.photoUrl)} alt="" /> : <span>{initials}</span>}</div>
}
