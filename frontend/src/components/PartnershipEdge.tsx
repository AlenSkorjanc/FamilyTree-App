import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from '@xyflow/react'
import type { PartnershipType } from '../types'
import { NODE_HEIGHT, partnershipRouteY } from './familyGraphLayout'

type PartnershipFlowEdge = Edge<{ partnershipType?: PartnershipType; isCurrent?: boolean; joined?: boolean; routeLevel?: number }, 'partnership'>

export function PartnershipEdge({ id, sourceX, sourceY, targetX, targetY, style, label, data }: EdgeProps<PartnershipFlowEdge>) {
  const routeLevel = data?.routeLevel ?? 0
  const routeY = partnershipRouteY(Math.max(sourceY, targetY), routeLevel)
  const direction = targetX >= sourceX ? 1 : -1
  const cornerRadius = Math.min(16, Math.abs(targetX - sourceX) / 4)
  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${sourceY + 12}, ${sourceX} ${routeY}, ${sourceX + direction * cornerRadius} ${routeY}`,
    `L ${targetX - direction * cornerRadius} ${routeY}`,
    `C ${targetX} ${routeY}, ${targetX} ${targetY + 12}, ${targetX} ${targetY}`,
  ].join(' ')
  const labelX = (sourceX + targetX) / 2
  const labelY = Math.min(sourceY, targetY) - NODE_HEIGHT - 17
  return <>
    <BaseEdge id={id} path={path} className={`partnership-edge-path ${data?.isCurrent ? 'current' : 'former'}`} style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    {label && <EdgeLabelRenderer>
      <div
        className={`partnership-edge-label ${data?.isCurrent ? 'current' : ''}`}
        role="img"
        aria-label={typeof label === 'string' ? label : undefined}
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
      >
        {data?.partnershipType === 'MARRIAGE' && <WeddingRingsIcon />}
        <span>{label}</span>
      </div>
    </EdgeLabelRenderer>}
  </>
}

export function WeddingRingsIcon() {
  return (
    <svg viewBox="0 0 32 20" aria-hidden="true" focusable="false">
      <circle cx="11" cy="12" r="6" />
      <circle cx="21" cy="12" r="6" />
      <path d="M18.5 5.2 21 1.8l2.5 3.4L21 7.6Z" />
    </svg>
  )
}
