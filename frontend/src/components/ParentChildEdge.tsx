import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react'

export interface ParentChildEdgeData extends Record<string, unknown> {
  branchOrigin?: { x: number; y: number; splitY: number }
  branchPart?: 'trunk' | 'child'
}

export type ParentChildFlowEdge = Edge<ParentChildEdgeData, 'parentChild'>

export function ParentChildEdge({ id, sourceX, sourceY, targetX, targetY, style, data }: EdgeProps<ParentChildFlowEdge>) {
  const origin = data?.branchOrigin
  const isSharedTrunk = Boolean(origin && data?.branchPart === 'trunk')
  return <BaseEdge
    id={id}
    path={origin
      ? data?.branchPart === 'trunk'
        ? sharedFamilyTrunkPath(origin.x, origin.y, origin.splitY)
        : sharedFamilyBranchPath(origin.x, origin.splitY, targetX, targetY)
      : familyBranchPath(sourceX, sourceY, targetX, targetY)}
    style={{ ...style, strokeLinecap: isSharedTrunk ? 'butt' : 'round', strokeLinejoin: 'round' }}
  />
}

export function familyBranchPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const verticalDistance = Math.max(targetY - sourceY, 40)
  const curveDepth = Math.min(Math.max(verticalDistance * 0.28, 26), 70)
  const branchY = sourceY + verticalDistance * 0.48
  const branchX = sourceX + (targetX - sourceX) * 0.5
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${sourceY + curveDepth}, ${sourceX} ${branchY}, ${branchX} ${branchY}`,
    `C ${targetX} ${branchY}, ${targetX} ${targetY - curveDepth}, ${targetX} ${targetY}`,
  ].join(' ')
}

export function sharedFamilyTrunkPath(sourceX: number, sourceY: number, splitY: number): string {
  return `M ${sourceX} ${sourceY} L ${sourceX} ${splitY}`
}

export function sharedFamilyBranchPath(splitX: number, splitY: number, targetX: number, targetY: number): string {
  const curveDepth = Math.min(Math.max((targetY - splitY) * 0.42, 24), 64)
  return [
    `M ${splitX} ${splitY}`,
    `C ${splitX} ${splitY + curveDepth}, ${targetX} ${targetY - curveDepth}, ${targetX} ${targetY}`,
  ].join(' ')
}
