import type { FamilyGraph, UUID } from '../types'
import type { PersonFlowNode } from './PersonNode'
import { NODE_HEIGHT } from './familyGraphLayout'
import { sharedFamilyEdgeId, sharedFamilyTrunkEdgeId, sharedParentFamilies } from './familyGraphEdges'

export function mobileFocusedViewport(nodeCenter: { x: number; y: number }, viewportWidth: number, viewportHeight: number) {
  const zoom = 1
  const visibleAreaCenterY = Math.max(NODE_HEIGHT / 2 + 12, viewportHeight / 4)
  return { x: viewportWidth / 2 - nodeCenter.x * zoom, y: visibleAreaCenterY - nodeCenter.y * zoom, zoom }
}

export function selectPersonOccurrences(nodes: PersonFlowNode[], selectedPersonIds: readonly UUID[], hideQuickAddForSelection = false): PersonFlowNode[] {
  const selected = new Set(selectedPersonIds)
  return nodes.map((node) => {
    const isSelected = selected.has(node.data.person.id)
    return {
      ...node,
      selected: isSelected,
      data: { ...node.data, quickAddEnabled: !(hideQuickAddForSelection && isSelected) },
    }
  })
}

export function edgeIdsFromPointElements(elements: Element[], clickedEdgeId: string): string[] {
  const edgeIds = elements
    .map((element) => element.closest('.react-flow__edge')?.getAttribute('data-id'))
    .filter((edgeId): edgeId is string => Boolean(edgeId))
  return [...new Set([clickedEdgeId, ...edgeIds])]
}

export function completeFamilyBranchEdgeIds(edgeIds: readonly string[], graph: FamilyGraph): string[] {
  const clicked = new Set(edgeIds)
  const completed = new Set(edgeIds)
  sharedParentFamilies(graph).forEach((family) => {
    const trunkEdgeId = sharedFamilyTrunkEdgeId(family.partnership.id)
    const partnershipEdgeId = `partner-${family.partnership.id}`
    if (clicked.has(trunkEdgeId)) {
      family.children.forEach((child) => completed.add(sharedFamilyEdgeId(family.partnership.id, child.childId)))
      completed.add(partnershipEdgeId)
      return
    }
    const includesChildBranch = family.children.some((child) => completed.has(sharedFamilyEdgeId(family.partnership.id, child.childId)))
    if (includesChildBranch) {
      completed.add(trunkEdgeId)
      completed.add(partnershipEdgeId)
    }
  })
  return [...completed]
}

export function personIdsForGraphEdges(edgeIds: readonly string[], graph: FamilyGraph): UUID[] {
  const sharedEdges = new Map(sharedParentFamilies(graph).flatMap((family) => [
    [
      sharedFamilyTrunkEdgeId(family.partnership.id),
      [family.partnership.person1Id, family.partnership.person2Id, ...family.children.map((child) => child.childId)],
    ] as const,
    ...family.children.map((child) => [
      sharedFamilyEdgeId(family.partnership.id, child.childId),
      [family.partnership.person1Id, family.partnership.person2Id, child.childId],
    ] as const),
  ]))
  const personIds = edgeIds.flatMap((edgeId) => {
    const sharedPeople = sharedEdges.get(edgeId)
    if (sharedPeople) return sharedPeople
    if (edgeId.startsWith('pc-')) {
      const relationship = graph.parentChildRelationships.find((candidate) => `pc-${candidate.id}` === edgeId)
      return relationship ? [relationship.parentId, relationship.childId] : []
    }
    if (edgeId.startsWith('partner-')) {
      const partnership = graph.partnerships.find((candidate) => `partner-${candidate.id}` === edgeId)
      return partnership ? [partnership.person1Id, partnership.person2Id] : []
    }
    return []
  })
  return [...new Set(personIds)]
}

export function haveDirectRelationship(firstPersonId: UUID, secondPersonId: UUID, graph: FamilyGraph): boolean {
  const isSelectedPair = (firstId: UUID, secondId: UUID) =>
    (firstId === firstPersonId && secondId === secondPersonId) || (firstId === secondPersonId && secondId === firstPersonId)
  return graph.partnerships.some((partnership) => isSelectedPair(partnership.person1Id, partnership.person2Id))
    || graph.parentChildRelationships.some((relationship) => isSelectedPair(relationship.parentId, relationship.childId))
}

export function toggleConnectionPerson(currentPersonIds: readonly UUID[], personId: UUID): UUID[] {
  if (currentPersonIds.includes(personId)) return currentPersonIds.filter((id) => id !== personId)
  if (currentPersonIds.length === 2) return [currentPersonIds[0], personId]
  return currentPersonIds.length < 2 ? [...currentPersonIds, personId] : [...currentPersonIds]
}
