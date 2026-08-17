import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { fullName } from '../api'
import type { Person } from '../types'

export type PersonNodeData = { person: Person }
export type PersonFlowNode = Node<PersonNodeData, 'person'>

export function lifeYears(person: Person): string {
  const birth = person.birthDate?.slice(0, 4) ?? '?'
  const death = person.deathDate?.slice(0, 4)
  return death ? `${birth} – ${death}` : `Born ${birth}`
}

export function PersonNode({ data, selected }: NodeProps<PersonFlowNode>) {
  const initials = [data.person.firstName, data.person.lastName].filter(Boolean).map((name) => name![0]).join('').toUpperCase()
  return (
    <article className={`person-node ${selected ? 'selected' : ''}`} aria-label={fullName(data.person)}>
      <Handle type="target" position={Position.Top} id="parent" />
      <Handle type="target" position={Position.Left} id="partner-left" />
      <div className="avatar">
        {data.person.photoUrl ? <img src={data.person.photoUrl} alt="" /> : <span>{initials}</span>}
      </div>
      <div className="person-node-copy">
        <strong>{fullName(data.person)}</strong>
        <small>{lifeYears(data.person)}</small>
      </div>
      <Handle type="source" position={Position.Right} id="partner-right" />
      <Handle type="source" position={Position.Bottom} id="child" />
    </article>
  )
}
