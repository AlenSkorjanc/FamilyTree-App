import type { FamilyGraph, ParentChildRelationship, Partnership, UUID } from '../types'
import { sharedParentFamilies } from './familyGraphEdges'

export type VisualOccurrenceContext = 'PRIMARY' | 'PARTNERSHIP'

export interface VisualPersonOccurrence {
  id: string
  personId: UUID
  rank: number
  context: VisualOccurrenceContext
  isAlias: boolean
}

export interface RenderedRelationshipEndpoints {
  sourceId: string
  targetId: string
}

export interface VisualGraphOccurrences {
  occurrences: VisualPersonOccurrence[]
  ranks: Map<string, number>
  relationshipEndpoints: Map<UUID, RenderedRelationshipEndpoints>
  partnershipEndpoints: Map<UUID, RenderedRelationshipEndpoints>
  occurrenceDegrees: Map<string, number>
  preferredOccurrenceByPerson: Map<UUID, string>
  prunedOccurrenceCount: number
  canonicalConnectedComponentCount: number
  renderedConnectedComponentCount: number
  splitCanonicalComponentCount: number
}

export function findVisualGraphOccurrences(graph: FamilyGraph): VisualGraphOccurrences {
  const people = [...graph.people].sort((first, second) => first.id.localeCompare(second.id))
  const relationships = [...graph.parentChildRelationships].sort(compareRelationships)
  const partnerships = [...graph.partnerships].sort(comparePartnerships)
  const personIds = new Set(people.map((person) => person.id))
  relationships.forEach((relationship) => assertCanonicalPerson(personIds, relationship.parentId, relationship.id))
  relationships.forEach((relationship) => assertCanonicalPerson(personIds, relationship.childId, relationship.id))
  partnerships.forEach((partnership) => assertCanonicalPerson(personIds, partnership.person1Id, partnership.id))
  partnerships.forEach((partnership) => assertCanonicalPerson(personIds, partnership.person2Id, partnership.id))

  const ancestryRanks = canonicalAncestryRanks(people.map((person) => person.id), relationships)
  const canonicalRanks = alignAncestryComponentsForPartnerships(people.map((person) => person.id), relationships, partnerships, ancestryRanks)
  const occurrences = new Map<string, VisualPersonOccurrence>()
  people.forEach((person) => occurrences.set(person.id, {
    id: person.id,
    personId: person.id,
    rank: canonicalRanks.get(person.id) ?? 0,
    context: 'PRIMARY',
    isAlias: false,
  }))
  const ensureAlias = (personId: UUID, rank: number, context: Exclude<VisualOccurrenceContext, 'PRIMARY'>, contextId: string) => {
    const id = `alias:${personId}:${context.toLowerCase()}:${contextId}:generation:${rank}`
    if (!occurrences.has(id)) occurrences.set(id, { id, personId, rank, context, isAlias: true })
    return id
  }

  const partnershipEndpoints = partnershipOccurrenceEndpoints(partnerships, canonicalRanks, ensureAlias)
  const stableGraph = { ...graph, parentChildRelationships: relationships, partnerships }
  const sharedFamilies = sharedParentFamilies(stableGraph, partnershipEndpoints)
  const sharedRelationshipIds = new Set(sharedFamilies.flatMap((family) => family.children.flatMap((child) => child.relationships.map((relationship) => relationship.id))))
  const relationshipEndpoints = new Map<UUID, RenderedRelationshipEndpoints>()

  relationships.forEach((relationship) => {
    if (sharedRelationshipIds.has(relationship.id)) return
    relationshipEndpoints.set(relationship.id, { sourceId: relationship.parentId, targetId: relationship.childId })
  })

  sharedFamilies.forEach((family) => {
    const partnerOccurrences = partnershipEndpoints.get(family.partnership.id)
    if (!partnerOccurrences) return
    const familyRank = occurrenceRank(occurrences, partnerOccurrences.sourceId)
    family.children.forEach((child) => {
      const childRank = canonicalRanks.get(child.childId) ?? familyRank + 1
      if (childRank <= familyRank) throw new Error(`Family ${family.partnership.id} cannot place child ${child.childId} below its parents`)
      child.relationships.forEach((relationship) => {
        const sourceId = relationship.parentId === family.partnership.person1Id
          ? partnerOccurrences.sourceId
          : partnerOccurrences.targetId
        relationshipEndpoints.set(relationship.id, { sourceId, targetId: child.childId })
      })
    })
  })

  const occurrenceDegrees = relationshipDegrees(occurrences.keys(), relationshipEndpoints, partnershipEndpoints)
  const canonicalDegrees = canonicalRelationshipDegrees(people.map((person) => person.id), relationships, partnerships)
  const retainedCandidates = [...occurrences.values()].filter((occurrence) =>
    (occurrenceDegrees.get(occurrence.id) ?? 0) > 0
    || ((canonicalDegrees.get(occurrence.personId) ?? 0) === 0 && occurrence.id === occurrence.personId))
  const renderedComponents = connectedComponents(retainedCandidates.map((occurrence) => occurrence.id), relationshipEndpoints, partnershipEndpoints)
  const componentAnalysis = analyzeCanonicalComponentConnectivity(people.map((person) => person.id), relationships, partnerships, retainedCandidates, renderedComponents.componentByOccurrence)
  const splitCanonicalComponentCount = componentAnalysis.splitComponentCount
  if (splitCanonicalComponentCount > 0) throw new Error(`${splitCanonicalComponentCount} canonical family component(s) were split by visual occurrence assignment`)
  const currentPartnerOccurrences = new Set(partnerships.filter((partnership) => partnership.isCurrent).flatMap((partnership) => {
    const endpoints = partnershipEndpoints.get(partnership.id)
    return endpoints ? [endpoints.sourceId, endpoints.targetId] : []
  }))
  const preferredOccurrenceByPerson = preferredOccurrences(
    retainedCandidates,
    occurrenceDegrees,
    renderedComponents.componentSizes,
    renderedComponents.componentByOccurrence,
    currentPartnerOccurrences,
  )
  const retainedOccurrences = retainedCandidates.map((occurrence) => ({
    ...occurrence,
    isAlias: preferredOccurrenceByPerson.get(occurrence.personId) !== occurrence.id,
  })).sort((first, second) => first.id.localeCompare(second.id))
  const result: VisualGraphOccurrences = {
    occurrences: retainedOccurrences,
    ranks: new Map(retainedOccurrences.map((occurrence) => [occurrence.id, occurrence.rank])),
    relationshipEndpoints,
    partnershipEndpoints,
    occurrenceDegrees: new Map(retainedOccurrences.map((occurrence) => [occurrence.id, occurrenceDegrees.get(occurrence.id) ?? 0])),
    preferredOccurrenceByPerson,
    prunedOccurrenceCount: occurrences.size - retainedOccurrences.length,
    canonicalConnectedComponentCount: componentAnalysis.canonicalComponentCount,
    renderedConnectedComponentCount: renderedComponents.componentSizes.size,
    splitCanonicalComponentCount,
  }
  validateVisualGraphOccurrences(graph, result)
  return result
}

export function validateVisualGraphOccurrences(graph: FamilyGraph, visual: VisualGraphOccurrences): void {
  const canonicalPersonIds = new Set(graph.people.map((person) => person.id))
  visual.occurrences.forEach((occurrence) => {
    if (!canonicalPersonIds.has(occurrence.personId)) throw new Error(`Visual occurrence ${occurrence.id} has no canonical Person`)
    const canonicalHasRelationships = graph.parentChildRelationships.some((relationship) => relationship.parentId === occurrence.personId || relationship.childId === occurrence.personId)
      || graph.partnerships.some((partnership) => partnership.person1Id === occurrence.personId || partnership.person2Id === occurrence.personId)
    if (canonicalHasRelationships && (visual.occurrenceDegrees.get(occurrence.id) ?? 0) === 0) {
      throw new Error(`Visual occurrence ${occurrence.id} is an unused orphan`)
    }
  })
  graph.parentChildRelationships.forEach((relationship) => {
    const endpoints = visual.relationshipEndpoints.get(relationship.id)
    if (!endpoints) throw new Error(`Missing rendered parent-child relationship ${relationship.id}`)
    const sourceRank = requiredRank(visual.ranks, endpoints.sourceId)
    const targetRank = requiredRank(visual.ranks, endpoints.targetId)
    if (sourceRank >= targetRank) {
      throw new Error(`Rendered parent-child relationship ${relationship.id} is not downward: ${endpoints.sourceId}@${sourceRank} -> ${endpoints.targetId}@${targetRank}`)
    }
  })
  graph.partnerships.forEach((partnership) => {
    const endpoints = visual.partnershipEndpoints.get(partnership.id)
    if (!endpoints) throw new Error(`Missing rendered partnership ${partnership.id}`)
    const sourceRank = requiredRank(visual.ranks, endpoints.sourceId)
    const targetRank = requiredRank(visual.ranks, endpoints.targetId)
    if (sourceRank !== targetRank) {
      throw new Error(`Rendered partnership ${partnership.id} is not horizontal: ${endpoints.sourceId}@${sourceRank} -> ${endpoints.targetId}@${targetRank}`)
    }
  })
}

export function validateVisualGraphPositions(
  graph: FamilyGraph,
  visual: VisualGraphOccurrences,
  positions: Map<string, { x: number; y: number }>,
): void {
  graph.parentChildRelationships.forEach((relationship) => {
    const endpoints = visual.relationshipEndpoints.get(relationship.id)
    if (!endpoints) throw new Error(`Missing rendered parent-child relationship ${relationship.id}`)
    const source = positions.get(endpoints.sourceId)
    const target = positions.get(endpoints.targetId)
    if (!source || !target) throw new Error(`Missing positioned occurrence for parent-child relationship ${relationship.id}`)
    if (source.y >= target.y) {
      throw new Error(`Positioned parent-child relationship ${relationship.id} is not downward: ${endpoints.sourceId}@${source.y} -> ${endpoints.targetId}@${target.y}`)
    }
  })
  graph.partnerships.forEach((partnership) => {
    const endpoints = visual.partnershipEndpoints.get(partnership.id)
    if (!endpoints) throw new Error(`Missing rendered partnership ${partnership.id}`)
    const source = positions.get(endpoints.sourceId)
    const target = positions.get(endpoints.targetId)
    if (!source || !target) throw new Error(`Missing positioned occurrence for partnership ${partnership.id}`)
    if (Math.abs(source.y - target.y) > 0.5) {
      throw new Error(`Positioned partnership ${partnership.id} is not horizontal: ${endpoints.sourceId}@${source.y} -> ${endpoints.targetId}@${target.y}`)
    }
  })
}

function canonicalAncestryRanks(personIds: UUID[], relationships: ParentChildRelationship[]): Map<UUID, number> {
  const outgoing = new Map(personIds.map((personId) => [personId, [] as UUID[]]))
  const indegree = new Map(personIds.map((personId) => [personId, 0]))
  relationships.forEach((relationship) => {
    outgoing.get(relationship.parentId)?.push(relationship.childId)
    indegree.set(relationship.childId, (indegree.get(relationship.childId) ?? 0) + 1)
  })
  outgoing.forEach((children) => children.sort())
  const ranks = new Map(personIds.map((personId) => [personId, 0]))
  const pending = personIds.filter((personId) => indegree.get(personId) === 0).sort()
  let processed = 0
  while (pending.length) {
    const personId = pending.shift()!
    processed += 1
    for (const childId of outgoing.get(personId) ?? []) {
      ranks.set(childId, Math.max(ranks.get(childId) ?? 0, (ranks.get(personId) ?? 0) + 1))
      indegree.set(childId, (indegree.get(childId) ?? 1) - 1)
      if (indegree.get(childId) === 0) insertSorted(pending, childId)
    }
  }
  if (processed !== personIds.length) throw new Error('Canonical parent-child relationships contain a cycle')
  return ranks
}

function alignAncestryComponentsForPartnerships(
  personIds: UUID[],
  relationships: ParentChildRelationship[],
  partnerships: Partnership[],
  ancestryRanks: Map<UUID, number>,
): Map<UUID, number> {
  const ancestryParent = new Map(personIds.map((personId) => [personId, personId]))
  const findAncestry = disjointSetFinder(ancestryParent)
  relationships.forEach((relationship) => unionSets(ancestryParent, findAncestry, relationship.parentId, relationship.childId))
  const ancestryComponentByPerson = new Map(personIds.map((personId) => [personId, findAncestry(personId)]))
  const ancestryComponents = [...new Set(ancestryComponentByPerson.values())].sort()

  const connectedParent = new Map(ancestryComponents.map((componentId) => [componentId, componentId]))
  const findConnected = disjointSetFinder(connectedParent)
  const offsetConstraints = new Map(ancestryComponents.map((componentId) => [componentId, [] as Array<{ componentId: UUID; delta: number }>]))
  ;[...partnerships].sort((first, second) => Number(second.isCurrent) - Number(first.isCurrent) || first.id.localeCompare(second.id)).forEach((partnership) => {
    const firstComponent = ancestryComponentByPerson.get(partnership.person1Id)!
    const secondComponent = ancestryComponentByPerson.get(partnership.person2Id)!
    if (firstComponent === secondComponent || findConnected(firstComponent) === findConnected(secondComponent)) return
    const delta = (ancestryRanks.get(partnership.person1Id) ?? 0) - (ancestryRanks.get(partnership.person2Id) ?? 0)
    offsetConstraints.get(firstComponent)?.push({ componentId: secondComponent, delta })
    offsetConstraints.get(secondComponent)?.push({ componentId: firstComponent, delta: -delta })
    unionSets(connectedParent, findConnected, firstComponent, secondComponent)
  })

  const offsets = new Map<UUID, number>()
  ancestryComponents.forEach((startComponent) => {
    if (offsets.has(startComponent)) return
    offsets.set(startComponent, 0)
    const pending = [startComponent]
    while (pending.length) {
      const componentId = pending.shift()!
      const offset = offsets.get(componentId) ?? 0
      ;[...(offsetConstraints.get(componentId) ?? [])].sort((first, second) => first.componentId.localeCompare(second.componentId)).forEach((constraint) => {
        if (offsets.has(constraint.componentId)) return
        offsets.set(constraint.componentId, offset + constraint.delta)
        pending.push(constraint.componentId)
      })
    }
  })

  const minimumRankByConnectedComponent = new Map<UUID, number>()
  personIds.forEach((personId) => {
    const ancestryComponent = ancestryComponentByPerson.get(personId)!
    const connectedComponent = findConnected(ancestryComponent)
    const rank = (ancestryRanks.get(personId) ?? 0) + (offsets.get(ancestryComponent) ?? 0)
    minimumRankByConnectedComponent.set(connectedComponent, Math.min(minimumRankByConnectedComponent.get(connectedComponent) ?? rank, rank))
  })
  return new Map(personIds.map((personId) => {
    const ancestryComponent = ancestryComponentByPerson.get(personId)!
    const connectedComponent = findConnected(ancestryComponent)
    const rank = (ancestryRanks.get(personId) ?? 0) + (offsets.get(ancestryComponent) ?? 0)
    return [personId, rank - (minimumRankByConnectedComponent.get(connectedComponent) ?? 0)]
  }))
}

function disjointSetFinder(parent: Map<UUID, UUID>) {
  const find = (id: UUID): UUID => {
    const direct = parent.get(id) ?? id
    if (direct === id) return id
    const root = find(direct)
    parent.set(id, root)
    return root
  }
  return find
}

function unionSets(parent: Map<UUID, UUID>, find: (id: UUID) => UUID, first: UUID, second: UUID) {
  const firstRoot = find(first)
  const secondRoot = find(second)
  if (firstRoot === secondRoot) return
  const root = firstRoot < secondRoot ? firstRoot : secondRoot
  parent.set(firstRoot, root)
  parent.set(secondRoot, root)
}

function partnershipOccurrenceEndpoints(
  partnerships: Partnership[],
  canonicalRanks: Map<UUID, number>,
  ensureAlias: (personId: UUID, rank: number, context: 'PARTNERSHIP', contextId: string) => string,
): Map<UUID, RenderedRelationshipEndpoints> {
  const endpoints = new Map<UUID, RenderedRelationshipEndpoints>()
  partnerships.forEach((partnership) => {
    const firstRank = canonicalRanks.get(partnership.person1Id) ?? 0
    const secondRank = canonicalRanks.get(partnership.person2Id) ?? 0
    if (firstRank === secondRank) {
      endpoints.set(partnership.id, { sourceId: partnership.person1Id, targetId: partnership.person2Id })
      return
    }
    if (firstRank < secondRank) {
      endpoints.set(partnership.id, {
        sourceId: ensureAlias(partnership.person1Id, secondRank, 'PARTNERSHIP', `rank-${secondRank}`),
        targetId: partnership.person2Id,
      })
      return
    }
    endpoints.set(partnership.id, {
      sourceId: partnership.person1Id,
      targetId: ensureAlias(partnership.person2Id, firstRank, 'PARTNERSHIP', `rank-${firstRank}`),
    })
  })
  return endpoints
}

function relationshipDegrees(
  occurrenceIds: Iterable<string>,
  relationships: Map<UUID, RenderedRelationshipEndpoints>,
  partnerships: Map<UUID, RenderedRelationshipEndpoints>,
): Map<string, number> {
  const degrees = new Map([...occurrenceIds].map((occurrenceId) => [occurrenceId, 0]))
  const increment = (occurrenceId: string) => degrees.set(occurrenceId, (degrees.get(occurrenceId) ?? 0) + 1)
  relationships.forEach((endpoints) => {
    increment(endpoints.sourceId)
    increment(endpoints.targetId)
  })
  partnerships.forEach((endpoints) => {
    increment(endpoints.sourceId)
    increment(endpoints.targetId)
  })
  return degrees
}

function canonicalRelationshipDegrees(
  personIds: UUID[],
  relationships: ParentChildRelationship[],
  partnerships: Partnership[],
): Map<UUID, number> {
  const degrees = new Map(personIds.map((personId) => [personId, 0]))
  const increment = (personId: UUID) => degrees.set(personId, (degrees.get(personId) ?? 0) + 1)
  relationships.forEach((relationship) => {
    increment(relationship.parentId)
    increment(relationship.childId)
  })
  partnerships.forEach((partnership) => {
    increment(partnership.person1Id)
    increment(partnership.person2Id)
  })
  return degrees
}

function connectedComponents(
  occurrenceIds: string[],
  relationships: Map<UUID, RenderedRelationshipEndpoints>,
  partnerships: Map<UUID, RenderedRelationshipEndpoints>,
) {
  const retained = new Set(occurrenceIds)
  const adjacency = new Map(occurrenceIds.map((occurrenceId) => [occurrenceId, new Set<string>()]))
  const connect = ({ sourceId, targetId }: RenderedRelationshipEndpoints) => {
    if (!retained.has(sourceId) || !retained.has(targetId)) return
    adjacency.get(sourceId)?.add(targetId)
    adjacency.get(targetId)?.add(sourceId)
  }
  relationships.forEach(connect)
  partnerships.forEach(connect)
  const componentByOccurrence = new Map<string, number>()
  const componentSizes = new Map<number, number>()
  occurrenceIds.sort().forEach((startId) => {
    if (componentByOccurrence.has(startId)) return
    const componentId = componentSizes.size
    const pending = [startId]
    componentByOccurrence.set(startId, componentId)
    let size = 0
    while (pending.length) {
      const occurrenceId = pending.shift()!
      size += 1
      ;[...(adjacency.get(occurrenceId) ?? [])].sort().forEach((neighborId) => {
        if (componentByOccurrence.has(neighborId)) return
        componentByOccurrence.set(neighborId, componentId)
        pending.push(neighborId)
      })
    }
    componentSizes.set(componentId, size)
  })
  return { componentByOccurrence, componentSizes }
}

function analyzeCanonicalComponentConnectivity(
  personIds: UUID[],
  relationships: ParentChildRelationship[],
  partnerships: Partnership[],
  occurrences: VisualPersonOccurrence[],
  renderComponentByOccurrence: Map<string, number>,
): { canonicalComponentCount: number; splitComponentCount: number } {
  const canonicalAdjacency = new Map(personIds.map((personId) => [personId, new Set<UUID>()]))
  const connect = (first: UUID, second: UUID) => {
    canonicalAdjacency.get(first)?.add(second)
    canonicalAdjacency.get(second)?.add(first)
  }
  relationships.forEach((relationship) => connect(relationship.parentId, relationship.childId))
  partnerships.forEach((partnership) => connect(partnership.person1Id, partnership.person2Id))
  const visited = new Set<UUID>()
  let canonicalComponentCount = 0
  let splitComponentCount = 0
  personIds.sort().forEach((startId) => {
    if (visited.has(startId)) return
    canonicalComponentCount += 1
    const canonicalComponent = new Set<UUID>([startId])
    const pending = [startId]
    visited.add(startId)
    while (pending.length) {
      const personId = pending.shift()!
      ;[...(canonicalAdjacency.get(personId) ?? [])].sort().forEach((neighborId) => {
        if (visited.has(neighborId)) return
        visited.add(neighborId)
        canonicalComponent.add(neighborId)
        pending.push(neighborId)
      })
    }
    const renderedComponentIds = new Set(occurrences
      .filter((occurrence) => canonicalComponent.has(occurrence.personId))
      .map((occurrence) => renderComponentByOccurrence.get(occurrence.id))
      .filter((componentId): componentId is number => componentId !== undefined))
    if (renderedComponentIds.size > 1) splitComponentCount += 1
  })
  return { canonicalComponentCount, splitComponentCount }
}

function preferredOccurrences(
  occurrences: VisualPersonOccurrence[],
  degrees: Map<string, number>,
  componentSizes: Map<number, number>,
  componentByOccurrence: Map<string, number>,
  currentPartnerOccurrences: Set<string>,
): Map<UUID, string> {
  const byPerson = new Map<UUID, VisualPersonOccurrence[]>()
  occurrences.forEach((occurrence) => byPerson.set(occurrence.personId, [...(byPerson.get(occurrence.personId) ?? []), occurrence]))
  return new Map([...byPerson.entries()].map(([personId, candidates]) => {
    const preferred = [...candidates].sort((first, second) =>
      (componentSizes.get(componentByOccurrence.get(second.id) ?? -1) ?? 0) - (componentSizes.get(componentByOccurrence.get(first.id) ?? -1) ?? 0)
      || Number(currentPartnerOccurrences.has(second.id)) - Number(currentPartnerOccurrences.has(first.id))
      || (degrees.get(second.id) ?? 0) - (degrees.get(first.id) ?? 0)
      || Number(first.id !== personId) - Number(second.id !== personId)
      || first.id.localeCompare(second.id))[0]
    return [personId, preferred.id]
  }))
}

function occurrenceRank(occurrences: Map<string, VisualPersonOccurrence>, occurrenceId: string): number {
  const rank = occurrences.get(occurrenceId)?.rank
  if (rank === undefined) throw new Error(`Missing visual occurrence ${occurrenceId}`)
  return rank
}

function requiredRank(ranks: Map<string, number>, occurrenceId: string): number {
  const rank = ranks.get(occurrenceId)
  if (rank === undefined) throw new Error(`Missing rank for visual occurrence ${occurrenceId}`)
  return rank
}

function assertCanonicalPerson(personIds: Set<UUID>, personId: UUID, relationshipId: UUID) {
  if (!personIds.has(personId)) throw new Error(`Relationship ${relationshipId} references missing Person ${personId}`)
}

function compareRelationships(first: ParentChildRelationship, second: ParentChildRelationship) {
  return first.id.localeCompare(second.id)
}

function comparePartnerships(first: Partnership, second: Partnership) {
  return first.id.localeCompare(second.id)
}

function insertSorted(values: UUID[], value: UUID) {
  const index = values.findIndex((candidate) => candidate > value)
  if (index < 0) values.push(value)
  else values.splice(index, 0, value)
}
