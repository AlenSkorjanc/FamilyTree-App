import { describe, expect, it } from 'vitest'
import type { FamilyGraph, ParentChildRelationship, Partnership, Person } from '../types'
import { arrangeFamilyTreePositions, edgeIdsFromPointElements, findVisualGraphOccurrences, haveDirectRelationship, personIdsForGraphEdges, selectPersonOccurrences, toggleConnectionPerson } from './FamilyGraphCanvas'
import type { PersonFlowNode } from './PersonNode'

describe('family graph layout', () => {
  it('aligns married people horizontally and keeps their cards separated', () => {
    const positions = new Map([
      ['one', { x: 100, y: 20 }],
      ['two', { x: 100, y: 240 }],
      ['unrelated', { x: 500, y: 400 }],
    ])

    const aligned = arrangeFamilyTreePositions(positions, ['one', 'two', 'unrelated'], [], [['one', 'two']])

    expect(aligned.get('one')?.y).toBe(aligned.get('two')?.y)
    expect(Math.abs(aligned.get('one')!.x - aligned.get('two')!.x)).toBe(204)
    expect(aligned.get('unrelated')?.y).toBe(0)
    expect(aligned.get('unrelated')?.x).not.toBe(aligned.get('two')?.x)
  })

  it('places each child generation below its parents', () => {
    const positions = new Map([
      ['grandparent', { x: 0, y: 0 }], ['parent', { x: 0, y: 100 }], ['child', { x: 0, y: 200 }],
    ])
    const arranged = arrangeFamilyTreePositions(positions, ['grandparent', 'parent', 'child'], [['grandparent', 'parent'], ['parent', 'child']], [])
    expect(arranged.get('grandparent')?.y).toBe(0)
    expect(arranged.get('parent')?.y).toBe(280)
    expect(arranged.get('child')?.y).toBe(560)
  })

  it('aligns non-married partners when the partnership is supplied to the layout', () => {
    const arranged = arrangeFamilyTreePositions(
      new Map([['one', { x: 0, y: 0 }], ['two', { x: 300, y: 200 }]]),
      ['one', 'two'], [], [['two', 'one']],
    )
    expect(arranged.get('one')?.y).toBe(arranged.get('two')?.y)
    expect(arranged.get('two')!.x).toBeLessThan(arranged.get('one')!.x)
  })

  it('places a female or unspecified partner to the left of a male partner', () => {
    const arranged = arrangeFamilyTreePositions(
      new Map([['alen', { x: 0, y: 0 }], ['partner', { x: 300, y: 0 }]]),
      ['alen', 'partner'], [], [['alen', 'partner']], new Map([['alen', 'Moški'], ['partner', 'Ženska']]),
    )
    expect(arranged.get('partner')!.x).toBeLessThan(arranged.get('alen')!.x)
  })

  it('centers a parent close to its children instead of leaving unrelated groups between them', () => {
    const arranged = arrangeFamilyTreePositions(
      new Map([
        ['parent', { x: 0, y: 0 }], ['unrelated', { x: 200, y: 0 }],
        ['first-child', { x: 600, y: 200 }], ['second-child', { x: 850, y: 200 }],
      ]),
      ['parent', 'unrelated', 'first-child', 'second-child'],
      [['parent', 'first-child'], ['parent', 'second-child']],
      [],
    )
    const parentCenter = (arranged.get('parent')?.x ?? 0) + 95
    const childrenCenter = ((arranged.get('first-child')?.x ?? 0) + (arranged.get('second-child')?.x ?? 0)) / 2 + 95
    expect(Math.abs(parentCenter - childrenCenter)).toBeLessThan(120)
  })
})

describe('visual person aliases', () => {
  it('creates an alias only for a parent edge that would otherwise skip a generation', () => {
    const peterToAnna = relationship('peter-anna', 'peter', 'anna')
    const peterToAlen = relationship('peter-alen', 'peter', 'alen')
    const markToAlen = relationship('mark-alen', 'mark', 'alen')
    const graph = familyGraph(
      ['peter', 'anna', 'mark', 'alen', 'testni'],
      [peterToAnna, peterToAlen, markToAlen],
      [partnership('anna-mark', 'anna', 'mark'), partnership('alen-testni', 'alen', 'testni')],
    )

    const occurrences = findVisualGraphOccurrences(graph)

    expect(occurrences.aliases).toEqual([{ id: 'alias:alen:generation:1', personId: 'alen' }])
    expect(occurrences.relationshipTargets.get(peterToAlen.id)).toBe('alias:alen:generation:1')
    expect(occurrences.relationshipTargets.has(markToAlen.id)).toBe(false)
    expect(occurrences.relationshipTargets.has(peterToAnna.id)).toBe(false)
  })

  it('does not duplicate a child whose parents are in the same generation', () => {
    const graph = familyGraph(
      ['first-parent', 'second-parent', 'child'],
      [relationship('first-child', 'first-parent', 'child'), relationship('second-child', 'second-parent', 'child')],
      [partnership('parents', 'first-parent', 'second-parent')],
    )

    const occurrences = findVisualGraphOccurrences(graph)

    expect(occurrences.aliases).toEqual([])
    expect(occurrences.relationshipTargets.size).toBe(0)
  })

  it('selects every visual occurrence of the same person', () => {
    const alen = person('alen')
    const mark = person('mark')
    const nodes: PersonFlowNode[] = [
      flowNode('alen', alen),
      flowNode('alias:alen:generation:1', alen, true),
      flowNode('mark', mark),
    ]

    const selected = selectPersonOccurrences(nodes, ['alen'])

    expect(selected.filter((node) => node.selected).map((node) => node.id)).toEqual(['alen', 'alias:alen:generation:1'])
    expect(selected.find((node) => node.id === 'mark')?.selected).toBe(false)
  })

  it('selects both people and all their aliases for a clicked connection', () => {
    const alen = person('alen')
    const mark = person('mark')
    const nodes: PersonFlowNode[] = [
      flowNode('alen', alen),
      flowNode('alias:alen:generation:1', alen, true),
      flowNode('mark', mark),
    ]

    const selected = selectPersonOccurrences(nodes, ['alen', 'mark'])

    expect(selected.every((node) => node.selected)).toBe(true)
  })

  it('clears every selected occurrence when the selection is empty', () => {
    const nodes = [flowNode('alen', person('alen')), flowNode('mark', person('mark'))].map((node) => ({ ...node, selected: true }))

    expect(selectPersonOccurrences(nodes, []).every((node) => !node.selected)).toBe(true)
  })

  it('selects every person from the edges overlapping at the clicked point', () => {
    const graph = familyGraph(
      ['parent', 'first-child', 'second-child', 'other-parent'],
      [
        relationship('first', 'parent', 'first-child'),
        relationship('second', 'parent', 'second-child'),
        relationship('unrelated', 'other-parent', 'second-child'),
      ],
      [],
    )

    expect(personIdsForGraphEdges(['pc-first', 'pc-second'], graph)).toEqual(['parent', 'first-child', 'second-child'])
  })

  it('selects only the two people on a non-overlapping connection', () => {
    const graph = familyGraph(
      ['parent', 'first-child', 'second-child'],
      [relationship('first', 'parent', 'first-child'), relationship('second', 'parent', 'second-child')],
      [],
    )

    expect(personIdsForGraphEdges(['pc-first'], graph)).toEqual(['parent', 'first-child'])
  })

  it('selects only both partners when a partnership is clicked', () => {
    const graph = familyGraph(['first', 'second'], [], [partnership('couple', 'first', 'second')])

    expect(personIdsForGraphEdges(['partner-couple'], graph)).toEqual(['first', 'second'])
  })

  it('collects all React Flow edges physically present under the pointer', () => {
    const firstEdge = document.createElement('div')
    firstEdge.className = 'react-flow__edge'
    firstEdge.setAttribute('data-id', 'pc-first')
    const firstPath = document.createElement('path')
    firstEdge.append(firstPath)
    const secondEdge = document.createElement('div')
    secondEdge.className = 'react-flow__edge'
    secondEdge.setAttribute('data-id', 'pc-second')

    expect(edgeIdsFromPointElements([firstPath, secondEdge], 'pc-first')).toEqual(['pc-first', 'pc-second'])
  })
})

describe('direct relationships', () => {
  it('recognizes a partnership regardless of selected-person order', () => {
    const graph = familyGraph(['first', 'second'], [], [partnership('couple', 'first', 'second')])

    expect(haveDirectRelationship('first', 'second', graph)).toBe(true)
    expect(haveDirectRelationship('second', 'first', graph)).toBe(true)
  })

  it('recognizes a parent-child relationship regardless of selected-person order', () => {
    const graph = familyGraph(['parent', 'child'], [relationship('family', 'parent', 'child')], [])

    expect(haveDirectRelationship('parent', 'child', graph)).toBe(true)
    expect(haveDirectRelationship('child', 'parent', graph)).toBe(true)
  })

  it('keeps unrelated people available for a new connection', () => {
    const graph = familyGraph(['first', 'second', 'third'], [relationship('family', 'first', 'third')], [])

    expect(haveDirectRelationship('first', 'second', graph)).toBe(false)
  })
})

describe('manual person selection', () => {
  it('replaces the most recently selected person when a third person is clicked', () => {
    expect(toggleConnectionPerson(['first', 'second'], 'third')).toEqual(['first', 'third'])
  })

  it('still deselects a person that is already selected', () => {
    expect(toggleConnectionPerson(['first', 'second'], 'second')).toEqual(['first'])
  })
})

function familyGraph(personIds: string[], parentChildRelationships: ParentChildRelationship[], partnerships: Partnership[]): FamilyGraph {
  return {
    tree: { id: 'tree', name: 'Tree', createdAt: '', updatedAt: '' },
    people: personIds.map(person),
    parentChildRelationships,
    partnerships,
  }
}

function person(id: string): Person {
  return {
    id, treeId: 'tree', firstName: id, middleName: null, lastName: null, maidenName: null, gender: null,
    birthDate: null, deathDate: null, birthPlace: null, deathPlace: null, notes: null, photoUrl: null, createdAt: '', updatedAt: '',
  }
}

function relationship(id: string, parentId: string, childId: string): ParentChildRelationship {
  return { id, treeId: 'tree', parentId, childId, relationshipType: 'BIOLOGICAL', createdAt: '' }
}

function partnership(id: string, person1Id: string, person2Id: string): Partnership {
  return { id, treeId: 'tree', person1Id, person2Id, partnershipType: 'MARRIAGE', startDate: null, endDate: null, createdAt: '' }
}

function flowNode(id: string, nodePerson: Person, isAlias = false): PersonFlowNode {
  return { id, type: 'person', position: { x: 0, y: 0 }, data: { person: nodePerson, isAlias } }
}
