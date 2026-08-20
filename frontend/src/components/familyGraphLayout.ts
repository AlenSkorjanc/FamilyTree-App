import type { FamilyGraph, PartnershipType, UUID } from '../types'

export const NODE_WIDTH = 156
export const NODE_HEIGHT = 190
export const PARTNER_GAP = 0
export const FORMER_PARTNER_GAP = 34
export const PARTNERSHIP_ROUTE_OFFSET = 24
export const PARTNERSHIP_ROUTE_LEVEL_GAP = 16
const GROUP_GAP = 88
const GENERATION_GAP = 110
const DENSE_CONNECTION_THRESHOLD = 4
const CONNECTION_GAP_STEP = 8
const MAX_CONNECTION_GAP_EXTRA = 80

export interface PersonAlias {
  id: string
  personId: UUID
}

export interface VisualGraphOccurrences {
  aliases: PersonAlias[]
  relationshipTargets: Map<UUID, string>
}

export interface LayoutPartnership {
  id: string
  person1Id: string
  person2Id: string
  partnershipType: PartnershipType
  isCurrent: boolean
  startDate: string | null
  createdAt: string
}

export function joinsPartnerCards(partnershipType: PartnershipType): boolean {
  return partnershipType === 'PARTNERSHIP' || partnershipType === 'MARRIAGE'
}

export function partnershipRouteLevel(horizontalDistance: number, sameRow: boolean): number {
  return sameRow && horizontalDistance > NODE_WIDTH + FORMER_PARTNER_GAP + 1
    ? Math.max(1, Math.round(horizontalDistance / (NODE_WIDTH + FORMER_PARTNER_GAP)) - 1)
    : 0
}

export function partnershipRouteY(nodeBottomY: number, routeLevel: number): number {
  return nodeBottomY + PARTNERSHIP_ROUTE_OFFSET + routeLevel * PARTNERSHIP_ROUTE_LEVEL_GAP
}

export function findVisualGraphOccurrences(graph: FamilyGraph): VisualGraphOccurrences {
  const parent = new Map(graph.people.map((person) => [person.id, person.id]))
  const find = (id: UUID): UUID => {
    const direct = parent.get(id) ?? id
    if (direct === id) return id
    const root = find(direct)
    parent.set(id, root)
    return root
  }
  const union = (first: UUID, second: UUID) => {
    const firstRoot = find(first)
    const secondRoot = find(second)
    if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot)
  }
  graph.partnerships.forEach((partnership) => union(partnership.person1Id, partnership.person2Id))

  const componentIds = new Set(graph.people.map((person) => find(person.id)))
  const outgoing = new Map<UUID, Set<UUID>>()
  const indegree = new Map([...componentIds].map((id) => [id, 0]))
  graph.parentChildRelationships.forEach((relationship) => {
    const from = find(relationship.parentId)
    const to = find(relationship.childId)
    if (from === to || outgoing.get(from)?.has(to)) return
    outgoing.set(from, new Set([...(outgoing.get(from) ?? []), to]))
    indegree.set(to, (indegree.get(to) ?? 0) + 1)
  })

  const rank = new Map([...componentIds].map((id) => [id, 0]))
  const pending = [...componentIds].filter((id) => indegree.get(id) === 0)
  for (let index = 0; index < pending.length; index += 1) {
    const componentId = pending[index]
    for (const child of outgoing.get(componentId) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(componentId) ?? 0) + 1))
      indegree.set(child, (indegree.get(child) ?? 1) - 1)
      if (indegree.get(child) === 0) pending.push(child)
    }
  }

  const aliasesById = new Map<string, PersonAlias>()
  const relationshipTargets = new Map<UUID, string>()
  graph.parentChildRelationships.forEach((relationship) => {
    const parentRank = rank.get(find(relationship.parentId)) ?? 0
    const childRank = rank.get(find(relationship.childId)) ?? 0
    if (childRank <= parentRank + 1) return
    const aliasId = `alias:${relationship.childId}:generation:${parentRank + 1}`
    aliasesById.set(aliasId, { id: aliasId, personId: relationship.childId })
    relationshipTargets.set(relationship.id, aliasId)
  })

  return { aliases: [...aliasesById.values()], relationshipTargets }
}

export function arrangeFamilyTreePositions(
  suggested: Map<string, { x: number; y: number }>,
  personIds: string[],
  parentChildEdges: Array<[string, string]>,
  partnerships: LayoutPartnership[],
  genders: Map<string, string | null> = new Map(),
  birthDates: Map<string, string | null> = new Map(),
) {
  const parent = new Map(personIds.map((id) => [id, id]))
  const find = (id: string): string => {
    const direct = parent.get(id) ?? id
    if (direct === id) return id
    const root = find(direct)
    parent.set(id, root)
    return root
  }
  const union = (first: string, second: string) => {
    const firstRoot = find(first)
    const secondRoot = find(second)
    if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot)
  }
  partnerships.forEach((partnership) => union(partnership.person1Id, partnership.person2Id))
  const partnerNeighbors = new Map<string, Set<string>>()
  partnerships.forEach(({ person1Id: first, person2Id: second }) => {
    partnerNeighbors.set(first, new Set([...(partnerNeighbors.get(first) ?? []), second]))
    partnerNeighbors.set(second, new Set([...(partnerNeighbors.get(second) ?? []), first]))
  })

  const members = new Map<string, string[]>()
  personIds.forEach((id) => {
    const root = find(id)
    members.set(root, [...(members.get(root) ?? []), id])
  })
  const outgoing = new Map<string, Set<string>>()
  const indegree = new Map([...members.keys()].map((root) => [root, 0]))
  parentChildEdges.forEach(([parentId, childId]) => {
    const from = find(parentId)
    const to = find(childId)
    if (from === to || outgoing.get(from)?.has(to)) return
    outgoing.set(from, new Set([...(outgoing.get(from) ?? []), to]))
    indegree.set(to, (indegree.get(to) ?? 0) + 1)
  })

  const rank = new Map([...members.keys()].map((root) => [root, 0]))
  const pending = [...members.keys()].filter((root) => indegree.get(root) === 0)
  for (let index = 0; index < pending.length; index += 1) {
    const root = pending[index]
    for (const child of outgoing.get(root) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(root) ?? 0) + 1))
      indegree.set(child, (indegree.get(child) ?? 1) - 1)
      if (indegree.get(child) === 0) pending.push(child)
    }
  }

  const suggestedX = (root: string) => {
    const group = members.get(root) ?? []
    return group.reduce((sum, id) => sum + (suggested.get(id)?.x ?? 0), 0) / Math.max(group.length, 1)
  }
  const rows = new Map<number, string[]>()
  members.forEach((_, root) => {
    const row = rank.get(root) ?? 0
    rows.set(row, [...(rows.get(row) ?? []), root])
  })

  const incoming = new Map<string, Set<string>>()
  outgoing.forEach((children, root) => children.forEach((child) => incoming.set(child, new Set([...(incoming.get(child) ?? []), root]))))
  const parentIdsByChildRoot = new Map<string, Set<string>>()
  const birthDateByChildRoot = new Map<string, string>()
  parentChildEdges.forEach(([parentId, childId]) => {
    const birthDate = birthDates.get(childId)
    const childRoot = find(childId)
    parentIdsByChildRoot.set(childRoot, new Set([...(parentIdsByChildRoot.get(childRoot) ?? []), parentId]))
    const currentBirthDate = birthDateByChildRoot.get(childRoot)
    if (birthDate && (!currentBirthDate || birthDate < currentBirthDate)) birthDateByChildRoot.set(childRoot, birthDate)
  })
  const multiPartnerAnchor = (root: string) => [...(members.get(root) ?? [])]
    .filter((id) => (partnerNeighbors.get(id)?.size ?? 0) > 1)
    .sort((first, second) => (partnerNeighbors.get(second)?.size ?? 0) - (partnerNeighbors.get(first)?.size ?? 0) || first.localeCompare(second))[0]
  const relationBetween = (first: string, second: string) => partnerships.find((partnership) =>
    (partnership.person1Id === first && partnership.person2Id === second)
    || (partnership.person1Id === second && partnership.person2Id === first))
  const comparePartnerships = (first: LayoutPartnership, second: LayoutPartnership) =>
    compareOptionalDates(first.startDate, second.startDate)
    || first.createdAt.localeCompare(second.createdAt)
    || first.id.localeCompare(second.id)
  const defaultPersonOrder = (first: string, second: string) => {
    const genderDifference = genderOrder(genders.get(first)) - genderOrder(genders.get(second))
    return genderDifference
      || (suggested.get(first)?.x ?? 0) - (suggested.get(second)?.x ?? 0)
      || first.localeCompare(second)
  }
  const orderedGroups = new Map<string, string[]>()
  const orderedGroup = (root: string) => {
    const cached = orderedGroups.get(root)
    if (cached) return cached
    const group = [...(members.get(root) ?? [])]
    const anchor = multiPartnerAnchor(root)
    if (!anchor) {
      const ordered = group.sort(defaultPersonOrder)
      orderedGroups.set(root, ordered)
      return ordered
    }
    const orderedPartners = partnerships
      .filter((partnership) => partnership.person1Id === anchor || partnership.person2Id === anchor)
      .sort((first, second) => Number(second.isCurrent) - Number(first.isCurrent) || comparePartnerships(first, second))
      .map((partnership) => partnership.person1Id === anchor ? partnership.person2Id : partnership.person1Id)
    const rightPartners = orderedPartners.filter((_, index) => index % 2 === 0)
    const leftPartners = orderedPartners.filter((_, index) => index % 2 === 1).reverse()
    const directPartners = new Set(orderedPartners)
    const extras = group.filter((id) => id !== anchor && !directPartners.has(id)).sort(defaultPersonOrder)
    const ordered = [...leftPartners, anchor, ...rightPartners, ...extras]
    orderedGroups.set(root, ordered)
    return ordered
  }
  const gapBetween = (root: string, first: string, second: string) => {
    const group = orderedGroup(root)
    const relation = relationBetween(first, second)
    if (!relation || !joinsPartnerCards(relation.partnershipType)) return FORMER_PARTNER_GAP
    if (group.length === 2) return PARTNER_GAP
    return relation.isCurrent ? PARTNER_GAP : FORMER_PARTNER_GAP
  }
  const groupWidth = (root: string) => {
    const group = orderedGroup(root)
    return group.reduce((width, id, index) => width + NODE_WIDTH + (index ? gapBetween(root, group[index - 1], id) : 0), 0)
  }
  const centers = new Map<string, number>()
  const familyKey = (root: string) => [...(parentIdsByChildRoot.get(root) ?? [])].sort().join(':')
  const personCenter = (personId: string) => {
    const root = find(personId)
    const rootCenter = centers.get(root)
    if (rootCenter === undefined) return undefined
    const group = orderedGroup(root)
    let relativeLeft = -groupWidth(root) / 2
    for (let index = 0; index < group.length; index += 1) {
      if (index) relativeLeft += gapBetween(root, group[index - 1], group[index])
      if (group[index] === personId) return rootCenter + relativeLeft + NODE_WIDTH / 2
      relativeLeft += NODE_WIDTH
    }
    return undefined
  }
  const partnershipCenterForChild = (root: string) => {
    const parentIds = parentIdsByChildRoot.get(root)
    if (!parentIds) return undefined
    const familyPartnership = partnerships.find((partnership) => parentIds.has(partnership.person1Id) && parentIds.has(partnership.person2Id))
    if (!familyPartnership) return undefined
    const firstCenter = personCenter(familyPartnership.person1Id)
    const secondCenter = personCenter(familyPartnership.person2Id)
    return firstCenter !== undefined && secondCenter !== undefined ? (firstCenter + secondCenter) / 2 : undefined
  }

  const packRow = (row: number, desired: (root: string) => number) => {
    const roots = [...(rows.get(row) ?? [])].sort((first, second) => {
      const firstFamilyKey = familyKey(first)
      if (firstFamilyKey && firstFamilyKey === familyKey(second)) {
        const birthDifference = compareBirthDates(birthDateByChildRoot.get(first), birthDateByChildRoot.get(second))
        if (birthDifference !== 0) return birthDifference
      }
      const difference = desired(first) - desired(second)
      return difference || suggestedX(first) - suggestedX(second) || first.localeCompare(second)
    })
    if (!roots.length) return
    const leftEdges: number[] = []
    roots.forEach((root, index) => {
      const preferredLeft = desired(root) - groupWidth(root) / 2
      leftEdges[index] = index === 0 ? preferredLeft : Math.max(preferredLeft, leftEdges[index - 1] + groupWidth(roots[index - 1]) + GROUP_GAP)
    })
    const averageOffset = roots.reduce((sum, root, index) => sum + desired(root) - (leftEdges[index] + groupWidth(root) / 2), 0) / roots.length
    roots.forEach((root, index) => centers.set(root, leftEdges[index] + averageOffset + groupWidth(root) / 2))
    rows.set(row, roots)
  }

  const rowNumbers = [...rows.keys()].sort((first, second) => first - second)
  rowNumbers.forEach((row) => packRow(row, (root) => suggestedX(root)))
  repeat(5, () => {
    rowNumbers.slice(1).forEach((row) => packRow(row, (root) => partnershipCenterForChild(root) ?? averageCenter(incoming.get(root), centers) ?? centers.get(root) ?? suggestedX(root)))
    rowNumbers.slice(0, -1).reverse().forEach((row) => packRow(row, (root) => averageCenter(outgoing.get(root), centers) ?? centers.get(root) ?? suggestedX(root)))
  })

  const result = new Map<string, { x: number; y: number }>()
  rows.forEach((roots) => roots.forEach((root) => {
    const group = orderedGroup(root)
    const left = (centers.get(root) ?? 0) - groupWidth(root) / 2
    let nextX = left
    group.forEach((id, index) => {
      if (index) nextX += gapBetween(root, group[index - 1], id)
      result.set(id, { x: nextX, y: 0 })
      nextX += NODE_WIDTH
    })
  }))

  const generationY = new Map<number, number>()
  let nextGenerationY = 0
  rowNumbers.forEach((row, index) => {
    generationY.set(row, nextGenerationY)
    const nextRow = rowNumbers[index + 1]
    if (nextRow === undefined) return
    const crossingParentChildCount = parentChildEdges.filter(([parentId, childId]) =>
      (rank.get(find(parentId)) ?? 0) === row && (rank.get(find(childId)) ?? 0) > row).length
    const rowPartnerships = partnerships.filter((partnership) => (rank.get(find(partnership.person1Id)) ?? 0) === row)
    const maximumRouteLevel = rowPartnerships.reduce((maximum, partnership) => {
      const firstPosition = result.get(partnership.person1Id)
      const secondPosition = result.get(partnership.person2Id)
      if (!firstPosition || !secondPosition) return maximum
      return Math.max(maximum, partnershipRouteLevel(Math.abs(firstPosition.x - secondPosition.x), true))
    }, 0)
    const connectionCount = crossingParentChildCount + rowPartnerships.length
    const densityExtra = Math.min(MAX_CONNECTION_GAP_EXTRA, Math.max(0, connectionCount - DENSE_CONNECTION_THRESHOLD) * CONNECTION_GAP_STEP)
    const routeExtra = maximumRouteLevel * PARTNERSHIP_ROUTE_LEVEL_GAP
    const skippedGenerationSpace = Math.max(0, nextRow - row - 1) * (NODE_HEIGHT + GENERATION_GAP)
    nextGenerationY += NODE_HEIGHT + GENERATION_GAP + Math.max(densityExtra, routeExtra) + skippedGenerationSpace
  })
  result.forEach((position, id) => {
    const row = rank.get(find(id)) ?? 0
    result.set(id, { x: position.x, y: generationY.get(row) ?? 0 })
  })
  return result
}

function compareBirthDates(first: string | undefined, second: string | undefined) {
  if (first && second) return first.localeCompare(second)
  if (first) return -1
  if (second) return 1
  return 0
}

function compareOptionalDates(first: string | null, second: string | null) {
  if (first && second) return first.localeCompare(second)
  if (first) return -1
  if (second) return 1
  return 0
}

function genderOrder(gender: string | null | undefined) {
  const normalized = gender?.trim().toUpperCase()
  if (normalized === 'MALE' || normalized === 'MOŠKI' || normalized === 'MOSKI' || normalized === 'M') return 0
  if (normalized === 'FEMALE' || normalized === 'ŽENSKI' || normalized === 'ZENSKI' || normalized === 'ŽENSKA' || normalized === 'ZENSKA' || normalized === 'F') return 2
  return 1
}

function averageCenter(related: Set<string> | undefined, centers: Map<string, number>) {
  const values = [...(related ?? [])].map((id) => centers.get(id)).filter((value): value is number => value !== undefined)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
}

function repeat(times: number, action: () => void) {
  for (let iteration = 0; iteration < times; iteration += 1) action()
}
