import { describe, expect, it } from 'vitest'
import type { FamilyGraph, ParentChildRelationship, Partnership, Person } from '../types'
import { arrangeFamilyTreePositions } from './familyGraphLayout'
import { findVisualGraphOccurrences, validateVisualGraphOccurrences, validateVisualGraphPositions } from './familyGraphOccurrences'

describe('visual family graph occurrence expansion', () => {
  it('retains one connected occurrence for a related canonical Person', () => {
    const visual = expand(['A', 'B'], [['A', 'B']])
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'A')).toHaveLength(1)
    expect(visual.occurrenceDegrees.get('A')).toBe(1)
  })

  it('keeps the ancestry primary connected instead of moving its edge to a partnership copy', () => {
    const visual = findVisualGraphOccurrences(orphanRegressionGraph())
    expect(visual.occurrences.some((occurrence) => occurrence.id === 'Oče')).toBe(true)
    expect(visual.occurrenceDegrees.get('Oče')).toBeGreaterThan(0)
    expect(visual.preferredOccurrenceByPerson.get('Oče')).toBe('Oče')
  })

  it('retains a primary used by ancestry and a copy used by partnership', () => {
    const visual = expand(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'C', false]])
    const occurrences = visual.occurrences.filter((occurrence) => occurrence.personId === 'A')
    expect(occurrences).toHaveLength(2)
    expect(occurrences.every((occurrence) => (visual.occurrenceDegrees.get(occurrence.id) ?? 0) > 0)).toBe(true)
  })

  it('does not create unused occurrence candidates', () => {
    const visual = findVisualGraphOccurrences(orphanRegressionGraph())
    expect(visual.prunedOccurrenceCount).toBe(0)
    expect([...visual.occurrenceDegrees.values()].every((degree) => degree > 0)).toBe(true)
  })

  it('keeps one primary occurrence for a truly standalone Person', () => {
    const visual = expand(['Standalone'], [])
    expect(visual.occurrences).toEqual([{ id: 'Standalone', personId: 'Standalone', rank: 0, context: 'PRIMARY', isAlias: false }])
    expect(visual.occurrenceDegrees.get('Standalone')).toBe(0)
  })

  it('keeps a useful ancestry primary in a cross-generation partnership', () => {
    const visual = expand(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'C', false]])
    expect(visual.occurrences.some((occurrence) => occurrence.id === 'A')).toBe(true)
    expect(visual.occurrenceDegrees.get('A')).toBeGreaterThan(0)
  })

  it('regresses two floating originals while preserving one connected rendered family', () => {
    const graph = orphanRegressionGraph()
    const visual = findVisualGraphOccurrences(graph)
    validateVisualGraphOccurrences(graph, visual)
    layoutAndValidate(graph, visual)
    expect(graph.people).toHaveLength(7)
    expect(visual.occurrences).toHaveLength(9)
    expect(visual.occurrences.filter((occurrence) => occurrence.context !== 'PRIMARY')).toHaveLength(2)
    expect(visual.prunedOccurrenceCount).toBe(0)
    expect(visual.canonicalConnectedComponentCount).toBe(1)
    expect(visual.renderedConnectedComponentCount).toBe(1)
    expect(visual.splitCanonicalComponentCount).toBe(0)
    expect([...visual.occurrenceDegrees.values()].filter((degree) => degree === 0)).toEqual([])
  })

  it('does not propagate a parent partnership copy to an already compatible child', () => {
    const visual = expand(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'C', false]])
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'A')).toHaveLength(2)
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'B')).toHaveLength(1)
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'C')).toHaveLength(1)
    expect(visual.renderedConnectedComponentCount).toBe(1)
  })

  it('aligns and connects two ancestry families through their spanning partnership', () => {
    const visual = expand(
      ['A', 'B', 'C', 'X', 'D'],
      [['A', 'B'], ['C', 'X'], ['X', 'D']],
      [['B', 'D', true]],
    )
    const endpoints = visual.partnershipEndpoints.get('p-B-D')!
    expect(endpoints).toEqual({ sourceId: 'B', targetId: 'D' })
    expect(visual.ranks.get('B')).toBe(visual.ranks.get('D'))
    expect(visual.renderedConnectedComponentCount).toBe(1)
    expect(visual.splitCanonicalComponentCount).toBe(0)
  })

  it('keeps multiple cross-generation partnerships in one rendered component', () => {
    const visual = expand(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']], [['A', 'D', false], ['B', 'D', false]])
    expect(visual.renderedConnectedComponentCount).toBe(1)
    expect(visual.splitCanonicalComponentCount).toBe(0)
  })

  it('assigns every canonical relationship exactly once', () => {
    const graph = orphanRegressionGraph()
    const visual = findVisualGraphOccurrences(graph)
    expect(visual.relationshipEndpoints.size).toBe(graph.parentChildRelationships.length)
    expect(visual.partnershipEndpoints.size).toBe(graph.partnerships.length)
  })

  it('keeps an ordinary parent and child as primary occurrences', () => {
    const visual = expand(['A', 'B'], [['A', 'B']])
    expect(aliasIds(visual)).toEqual([])
    expect(ranks(visual, ['A', 'B'])).toEqual([0, 1])
  })

  it('keeps a five-generation ancestry chain downward without copies', () => {
    const visual = expand(['A', 'B', 'C', 'D', 'E'], [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E']])
    expect(aliasIds(visual)).toEqual([])
    expect(ranks(visual, ['A', 'B', 'C', 'D', 'E'])).toEqual([0, 1, 2, 3, 4])
  })

  it('copies one endpoint for a direct parent-child partnership', () => {
    const visual = expand(['A', 'B'], [['A', 'B']], [['A', 'B', false]])
    expect(visual.occurrences).toHaveLength(3)
    expectPartnershipHorizontal(visual, 'p-A-B')
  })

  it('regresses a grandfather and son partnership without moving ancestry', () => {
    const visual = expand(['Grandfather', 'Son', 'Grandchild'], [['Grandfather', 'Son'], ['Son', 'Grandchild']], [['Grandfather', 'Son', false]])
    expect(ranks(visual, ['Grandfather', 'Son', 'Grandchild'])).toEqual([0, 1, 2])
    expect(visual.occurrences.some((occurrence) => occurrence.personId === 'Grandfather' && occurrence.context === 'PARTNERSHIP' && occurrence.rank === 1)).toBe(true)
    expectPartnershipHorizontal(visual, 'p-Grandfather-Son')
  })

  it('copies a great-grandparent for a descendant partnership', () => {
    const visual = expand(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']], [['A', 'D', false]])
    expect(visual.occurrences.find((occurrence) => occurrence.personId === 'A' && occurrence.rank === 3)).toBeDefined()
  })

  it('handles an ancestor partnership at arbitrary depth', () => {
    const ids = Array.from({ length: 9 }, (_, index) => `P${index}`)
    const visual = expand(ids, ids.slice(0, -1).map((id, index) => [id, ids[index + 1]]), [['P0', 'P8', false]])
    expectPartnershipHorizontal(visual, 'p-P0-P8')
    expect(ranks(visual, ids)).toEqual(ids.map((_, index) => index))
  })

  it('handles multiple cross-generation partnerships with several copies', () => {
    const visual = expand(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']], [['A', 'D', false], ['B', 'D', false]])
    expect(aliasIds(visual).length).toBeGreaterThanOrEqual(2)
    expectPartnershipHorizontal(visual, 'p-A-D')
    expectPartnershipHorizontal(visual, 'p-B-D')
  })

  it('keeps a cross-generation current partnership horizontal', () => {
    const visual = expand(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'C', true]])
    expectPartnershipHorizontal(visual, 'p-A-C')
  })

  it('preserves a normal current pair beside a cross-generation former partner', () => {
    const visual = expand(['A', 'B', 'C', 'X'], [['A', 'B'], ['B', 'C']], [['B', 'X', true], ['A', 'B', false]])
    const current = visual.partnershipEndpoints.get('p-B-X')!
    expect(current.sourceId).toBe('B')
    expect(visual.ranks.get(current.sourceId)).toBe(visual.ranks.get(current.targetId))
    expectPartnershipHorizontal(visual, 'p-A-B')
  })

  it('places children from several partnerships below their family units', () => {
    const visual = expand(
      ['P', 'X', 'Y', 'CX', 'CY'],
      [['P', 'CX'], ['X', 'CX'], ['P', 'CY'], ['Y', 'CY']],
      [['P', 'X', true], ['P', 'Y', false]],
    )
    expectAllRelationshipsDownward(visual)
    expectPartnershipHorizontal(visual, 'p-P-X')
    expectPartnershipHorizontal(visual, 'p-P-Y')
  })

  it('reuses one occurrence for equal-depth converging branches', () => {
    const visual = expand(['A', 'B', 'C', 'D'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']])
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'D')).toHaveLength(1)
  })

  it('does not copy a person merely because ancestry paths have unequal depths', () => {
    const visual = expand(['A', 'B', 'C', 'E', 'D'], [['A', 'B'], ['B', 'D'], ['A', 'C'], ['C', 'E'], ['E', 'D']])
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'D')).toHaveLength(1)
    expectAllRelationshipsDownward(visual)
  })

  it('renders ordinary pedigree collapse without inventing canonical people', () => {
    const visual = expand(['A', 'B', 'C', 'D'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']])
    expect(new Set(visual.occurrences.map((occurrence) => occurrence.personId))).toEqual(new Set(['A', 'B', 'C', 'D']))
  })

  it('combines pedigree collapse with a cross-generation partnership', () => {
    const visual = expand(['A', 'B', 'C', 'D'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']], [['A', 'D', false]])
    expectPartnershipHorizontal(visual, 'p-A-D')
    expectAllRelationshipsDownward(visual)
  })

  it('allows one canonical person to require three visual occurrences', () => {
    const visual = expand(
      ['A', 'B', 'C', 'D'],
      [['A', 'B'], ['B', 'C'], ['C', 'D']],
      [['A', 'C', false], ['A', 'D', false]],
    )
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'A')).toHaveLength(3)
  })

  it('reuses compatible partner occurrences across multiple family units', () => {
    const visual = expand(
      ['P', 'X', 'Y', 'CX', 'CY'],
      [['P', 'CX'], ['X', 'CX'], ['P', 'CY'], ['Y', 'CY']],
      [['P', 'X', true], ['P', 'Y', false]],
    )
    const partnerEndpoints = ['p-P-X', 'p-P-Y'].map((id) => visual.partnershipEndpoints.get(id)!)
    expect(partnerEndpoints[0].sourceId).toBe(partnerEndpoints[1].sourceId)
  })

  it('removes an unnecessary copy when the conflicting partnership is removed', () => {
    const withPartnership = expand(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'C', false]])
    const withoutPartnership = expand(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']])
    expect(aliasIds(withPartnership)).not.toEqual([])
    expect(aliasIds(withoutPartnership)).toEqual([])
  })

  it('produces the same occurrence IDs and order after input reordering', () => {
    const graph = makeGraph(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']], [['A', 'D', false], ['B', 'D', false]])
    const reordered = { ...graph, people: [...graph.people].reverse(), parentChildRelationships: [...graph.parentChildRelationships].reverse(), partnerships: [...graph.partnerships].reverse() }
    expect(findVisualGraphOccurrences(reordered).occurrences).toEqual(findVisualGraphOccurrences(graph).occurrences)
  })

  it('keeps canonical identity when a copy is selected', () => {
    const visual = expand(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'C', false]])
    const copy = visual.occurrences.find((occurrence) => occurrence.isAlias)!
    expect(copy.personId).toBe('A')
    expect(copy.id).not.toBe(copy.personId)
  })

  it('resolves every occurrence to the updated canonical Person after editing', () => {
    const graph = makeGraph(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'C', false]])
    const visual = findVisualGraphOccurrences(graph)
    const updatedPeople = new Map(graph.people.map((person) => [person.id, person.id === 'A' ? { ...person, firstName: 'Updated' } : person]))
    expect(visual.occurrences.filter((occurrence) => occurrence.personId === 'A').map((occurrence) => updatedPeople.get(occurrence.personId)?.firstName)).toEqual(['Updated', 'Updated'])
  })
})

type Visual = ReturnType<typeof findVisualGraphOccurrences>
type ParentPair = [string, string]
type PartnerTriple = [string, string, boolean]

function expand(personIds: string[], parentPairs: ParentPair[], partnerTriples: PartnerTriple[] = []) {
  const graph = makeGraph(personIds, parentPairs, partnerTriples)
  const visual = findVisualGraphOccurrences(graph)
  validateVisualGraphOccurrences(graph, visual)
  layoutAndValidate(graph, visual)
  return visual
}

function layoutAndValidate(graph: FamilyGraph, visual: Visual) {
  const positions = arrangeFamilyTreePositions(
    new Map(visual.occurrences.map((occurrence, index) => [occurrence.id, { x: index * 200, y: occurrence.rank * 300 }])),
    visual.occurrences.map((occurrence) => occurrence.id),
    graph.parentChildRelationships.map((relationship) => {
      const endpoints = visual.relationshipEndpoints.get(relationship.id)!
      return [endpoints.sourceId, endpoints.targetId] as [string, string]
    }),
    graph.partnerships.map((item) => {
      const endpoints = visual.partnershipEndpoints.get(item.id)!
      return { ...item, person1Id: endpoints.sourceId, person2Id: endpoints.targetId }
    }),
    new Map(),
    new Map(),
    visual.ranks,
  )
  validateVisualGraphPositions(graph, visual, positions)
}

function makeGraph(personIds: string[], parentPairs: ParentPair[], partnerTriples: PartnerTriple[] = []): FamilyGraph {
  return {
    tree: { id: 'tree', name: 'Tree', createdAt: '', updatedAt: '' },
    people: personIds.map(person),
    parentChildRelationships: parentPairs.map(([parentId, childId], index) => relationship(`r-${index}-${parentId}-${childId}`, parentId, childId)),
    partnerships: partnerTriples.map(([person1Id, person2Id, isCurrent]) => partnership(`p-${person1Id}-${person2Id}`, person1Id, person2Id, isCurrent)),
  }
}

function orphanRegressionGraph(): FamilyGraph {
  return makeGraph(
    ['Ancestor', 'Middle', 'Center', 'Oče', 'bivši', 'ChildOče', 'ChildBivši'],
    [
      ['Ancestor', 'Middle'], ['Middle', 'Center'],
      ['Oče', 'ChildOče'], ['Center', 'ChildOče'],
      ['bivši', 'ChildBivši'], ['Center', 'ChildBivši'],
    ],
    [['Oče', 'Center', false], ['bivši', 'Center', false]],
  )
}

function person(id: string): Person {
  return { id, treeId: 'tree', firstName: id, middleName: null, lastName: null, maidenName: null, gender: null, birthDate: null, deathDate: null, birthPlace: null, deathPlace: null, notes: null, photoUrl: null, createdAt: '', updatedAt: '' }
}

function relationship(id: string, parentId: string, childId: string): ParentChildRelationship {
  return { id, treeId: 'tree', parentId, childId, relationshipType: 'BIOLOGICAL', createdAt: '' }
}

function partnership(id: string, person1Id: string, person2Id: string, isCurrent: boolean): Partnership {
  return { id, treeId: 'tree', person1Id, person2Id, partnershipType: 'PARTNERSHIP', startDate: null, endDate: null, isCurrent, createdAt: '' }
}

function aliasIds(visual: Visual) {
  return visual.occurrences.filter((occurrence) => occurrence.isAlias).map((occurrence) => occurrence.id)
}

function ranks(visual: Visual, occurrenceIds: string[]) {
  return occurrenceIds.map((id) => visual.ranks.get(id))
}

function expectAllRelationshipsDownward(visual: Visual) {
  visual.relationshipEndpoints.forEach((endpoints) => expect(visual.ranks.get(endpoints.sourceId)!).toBeLessThan(visual.ranks.get(endpoints.targetId)!))
}

function expectPartnershipHorizontal(visual: Visual, partnershipId: string) {
  const endpoints = visual.partnershipEndpoints.get(partnershipId)!
  expect(visual.ranks.get(endpoints.sourceId)).toBe(visual.ranks.get(endpoints.targetId))
}
