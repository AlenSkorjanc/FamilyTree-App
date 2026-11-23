import type { FamilyGraph, UUID } from '../types'

export function descendantIds(graph: FamilyGraph, personId: UUID): Set<UUID> {
  const childrenByParent = new Map<UUID, UUID[]>()
  graph.parentChildRelationships.forEach((relationship) => {
    childrenByParent.set(relationship.parentId, [...(childrenByParent.get(relationship.parentId) ?? []), relationship.childId])
  })
  const descendants = new Set<UUID>()
  const frontier = [...(childrenByParent.get(personId) ?? [])]
  while (frontier.length) {
    const candidate = frontier.pop()
    if (!candidate || descendants.has(candidate)) continue
    descendants.add(candidate)
    frontier.push(...(childrenByParent.get(candidate) ?? []))
  }
  return descendants
}

export function wouldCreateParentChildCycle(graph: FamilyGraph, parentId: UUID, childId: UUID): boolean {
  return parentId === childId || descendantIds(graph, childId).has(parentId)
}
