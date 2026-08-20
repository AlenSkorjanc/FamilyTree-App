import type { FamilyGraph, ParentChildRelationship, Partnership, UUID } from '../types'

export interface SharedFamilyChild {
  childId: UUID
  relationships: [ParentChildRelationship, ParentChildRelationship]
}

export interface SharedParentFamily {
  partnership: Partnership
  children: SharedFamilyChild[]
}

export function sharedParentFamilies(graph: FamilyGraph): SharedParentFamily[] {
  const relationshipsByParent = new Map<UUID, ParentChildRelationship[]>()
  graph.parentChildRelationships.forEach((relationship) => {
    relationshipsByParent.set(relationship.parentId, [...(relationshipsByParent.get(relationship.parentId) ?? []), relationship])
  })
  const claimedRelationshipIds = new Set<UUID>()

  return graph.partnerships.flatMap((partnership) => {
    const secondParentRelationships = new Map(
      (relationshipsByParent.get(partnership.person2Id) ?? []).map((relationship) => [relationship.childId, relationship]),
    )
    const children = (relationshipsByParent.get(partnership.person1Id) ?? []).flatMap<SharedFamilyChild>((firstRelationship) => {
      const secondRelationship = secondParentRelationships.get(firstRelationship.childId)
      if (!secondRelationship || claimedRelationshipIds.has(firstRelationship.id) || claimedRelationshipIds.has(secondRelationship.id)) return []
      claimedRelationshipIds.add(firstRelationship.id)
      claimedRelationshipIds.add(secondRelationship.id)
      return [{ childId: firstRelationship.childId, relationships: [firstRelationship, secondRelationship] }]
    })
    return children.length ? [{ partnership, children }] : []
  })
}

export function sharedFamilyEdgeId(partnershipId: UUID, childId: UUID) {
  return `family-${partnershipId}:${childId}`
}

export function sharedFamilyTrunkEdgeId(partnershipId: UUID) {
  return `family-trunk-${partnershipId}`
}
