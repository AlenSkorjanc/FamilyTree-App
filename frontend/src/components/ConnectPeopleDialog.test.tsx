import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FamilyGraph, Person } from '../types'
import { ConnectPeopleDialog } from './ConnectPeopleDialog'

const person = (id: string, firstName: string): Person => ({
  id, treeId: 'tree', firstName, middleName: null, lastName: null, maidenName: null, gender: null,
  birthDate: null, deathDate: null, birthPlace: null, deathPlace: null, notes: null, photoUrl: null, createdAt: '', updatedAt: '',
})

const first = person('first', 'Anna')
const second = person('second', 'Mark')
const child = person('child', 'Lina')
const graph: FamilyGraph = {
  tree: { id: 'tree', name: 'Tree', createdAt: '', updatedAt: '' },
  people: [first, second, child],
  parentChildRelationships: [{ id: 'child-link', treeId: 'tree', parentId: first.id, childId: child.id, relationshipType: 'BIOLOGICAL', createdAt: '' }],
  partnerships: [],
}

describe('ConnectPeopleDialog', () => {
  it('creates a partnership and can copy existing children', () => {
    const onConnect = vi.fn()
    render(<ConnectPeopleDialog graph={graph} personIds={[first.id, second.id]} onClose={vi.fn()} onConnect={onConnect} />)

    expect(screen.getByRole('checkbox', { name: /Partner is also a parent/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Lina' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Partner is also a parent/ }))
    expect(screen.getByRole('checkbox', { name: 'Lina' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }))

    expect(onConnect).toHaveBeenCalledWith({
      kind: 'partner', person1Id: first.id, person2Id: second.id, partnershipType: 'PARTNERSHIP', copyChildrenFromPersonId: first.id, sharedChildIds: [child.id],
    })
  })

  it('only offers shared-child selection for the partnership type', () => {
    const onConnect = vi.fn()
    render(<ConnectPeopleDialog graph={graph} personIds={[first.id, second.id]} onClose={vi.fn()} onConnect={onConnect} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Relationship type' }), { target: { value: 'MARRIAGE' } })
    expect(screen.queryByRole('checkbox', { name: /Partner is also a parent/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }))

    expect(onConnect).toHaveBeenCalledWith({
      kind: 'partner', person1Id: first.id, person2Id: second.id, partnershipType: 'MARRIAGE', copyChildrenFromPersonId: undefined, sharedChildIds: undefined,
    })
  })

  it('creates a directed parent-child connection', () => {
    const onConnect = vi.fn()
    render(<ConnectPeopleDialog graph={graph} personIds={[first.id, second.id]} onClose={vi.fn()} onConnect={onConnect} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Connection' }), { target: { value: 'SECOND_PARENT' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Relationship type' }), { target: { value: 'ADOPTIVE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }))

    expect(onConnect).toHaveBeenCalledWith({ kind: 'parent-child', parentId: second.id, childId: first.id, relationshipType: 'ADOPTIVE' })
  })
})
