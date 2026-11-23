import type { FamilyGraph, UUID } from '../types'
import type { PersonFlowNode } from './PersonNode'
import { NODE_HEIGHT, NODE_WIDTH } from './familyGraphLayout'
import { sharedFamilyEdgeId, sharedFamilyTrunkEdgeId, sharedParentFamilies } from './familyGraphEdges'

export function mobileFocusedViewport(nodeCenter: { x: number; y: number }, viewportWidth: number, viewportHeight: number) {
  const zoom = 1
  const visibleAreaCenterY = Math.max(NODE_HEIGHT / 2 + 12, viewportHeight / 4)
  return { x: viewportWidth / 2 - nodeCenter.x * zoom, y: visibleAreaCenterY - nodeCenter.y * zoom, zoom }
}

export function focusedViewportLeftOfDetails(
  nodeCenter: { x: number; y: number },
  visibleWidth: number,
  viewportHeight: number,
) {
  const horizontalPadding = 24
  const zoom = Math.min(1.25, Math.max(0.08, (visibleWidth - horizontalPadding * 2) / NODE_WIDTH))
  return {
    x: visibleWidth / 2 - nodeCenter.x * zoom,
    y: viewportHeight / 2 - nodeCenter.y * zoom,
    zoom,
  }
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

export function closestEdgeIdFromPointElements(elements: Element[], clickedEdgeId: string, clientX: number, clientY: number): string {
  const candidateIds = edgeIdsFromPointElements(elements, clickedEdgeId)
  const edgeElements = new Map<string, Element>()
  elements.forEach((element) => {
    const edgeElement = element.closest('.react-flow__edge')
    const edgeId = edgeElement?.getAttribute('data-id')
    if (edgeElement && edgeId && !edgeElements.has(edgeId)) edgeElements.set(edgeId, edgeElement)
  })
  if (!edgeElements.has(clickedEdgeId)) {
    const clickedElement = [...document.querySelectorAll('.react-flow__edge')]
      .find((element) => element.getAttribute('data-id') === clickedEdgeId)
    if (clickedElement) edgeElements.set(clickedEdgeId, clickedElement)
  }

  let closestId = clickedEdgeId
  let closestDistance = Number.POSITIVE_INFINITY
  candidateIds.forEach((edgeId) => {
    const path = edgeElements.get(edgeId)?.querySelector<SVGPathElement>('.react-flow__edge-path')
    if (!path) return
    const distance = distanceToPath(path, clientX, clientY)
    if (distance < closestDistance) {
      closestDistance = distance
      closestId = edgeId
    }
  })
  return closestId
}

function distanceToPath(path: SVGPathElement, clientX: number, clientY: number): number {
  const matrix = path.getScreenCTM()
  const svgPoint = path.ownerSVGElement?.createSVGPoint()
  if (!matrix || !svgPoint) return Number.POSITIVE_INFINITY
  const length = path.getTotalLength()
  const sampleCount = Math.min(200, Math.max(24, Math.ceil(length / 8)))
  let nearestOffset = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  const distanceAt = (offset: number) => {
    const point = path.getPointAtLength(offset)
    svgPoint.x = point.x
    svgPoint.y = point.y
    const screenPoint = svgPoint.matrixTransform(matrix)
    return Math.hypot(screenPoint.x - clientX, screenPoint.y - clientY)
  }
  for (let index = 0; index <= sampleCount; index += 1) {
    const offset = length * index / sampleCount
    const distance = distanceAt(offset)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestOffset = offset
    }
  }
  let start = Math.max(0, nearestOffset - length / sampleCount)
  let end = Math.min(length, nearestOffset + length / sampleCount)
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const first = start + (end - start) / 3
    const second = end - (end - start) / 3
    if (distanceAt(first) <= distanceAt(second)) end = second
    else start = first
  }
  return Math.min(nearestDistance, distanceAt((start + end) / 2))
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
