import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FamilyGraph, Person } from '../types'
import { RelativeDialog } from './RelativeDialog'

const person = (id: string, firstName: string): Person => ({
  id, treeId: 'tree', firstName, middleName: null, lastName: null, maidenName: null, gender: null,
  birthDate: null, deathDate: null, birthPlace: null, deathPlace: null, notes: null, photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
})

const graph: FamilyGraph = {
  tree: { id: 'tree', name: 'Test', createdAt: '', updatedAt: '' },
  people: [{ ...person('selected', 'Anna'), lastName: 'Novak' }, person('existing-parent', 'Peter'), person('available', 'Maja')],
  parentChildRelationships: [{ id: 'relation', treeId: 'tree', parentId: 'existing-parent', childId: 'selected', relationshipType: 'BIOLOGICAL', createdAt: '' }],
  partnerships: [],
}

describe('RelativeDialog', () => {
  it('excludes the selected person and already-linked relatives', () => {
    render(<RelativeDialog kind="parent" selectedId="selected" graph={graph} onClose={vi.fn()} onLink={vi.fn()} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Link existing person' }))
    expect(screen.getByRole('button', { name: 'Maja' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anna' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Peter' })).not.toBeInTheDocument()
  })

  it('links the chosen existing person with the selected relationship type', () => {
    const onLink = vi.fn()
    render(<RelativeDialog kind="parent" selectedId="selected" graph={graph} onClose={vi.fn()} onLink={onLink} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Link existing person' }))
    fireEvent.change(screen.getByLabelText('Relationship type'), { target: { value: 'ADOPTIVE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Maja' }))
    fireEvent.click(screen.getByRole('button', { name: 'Link person' }))
    expect(onLink).toHaveBeenCalledWith('available', 'ADOPTIVE', undefined, undefined, undefined)
  })

  it('prefills a new child surname from the selected person', () => {
    render(<RelativeDialog kind="child" selectedId="selected" graph={graph} onClose={vi.fn()} onLink={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Last name' })).toHaveValue('Novak')
    expect(screen.getByRole('button', { name: 'Create and add child' })).toBeInTheDocument()
  })

  it('preselects the only partner as an optional second parent', async () => {
    const onCreate = vi.fn()
    const graphWithPartner: FamilyGraph = {
      ...graph,
      partnerships: [{ id: 'partnership', treeId: 'tree', person1Id: 'selected', person2Id: 'available', partnershipType: 'PARTNERSHIP', startDate: null, endDate: null, createdAt: '' }],
    }
    render(<RelativeDialog kind="child" selectedId="selected" graph={graphWithPartner} onClose={vi.fn()} onLink={vi.fn()} onCreate={onCreate} />)
    expect(screen.getByRole('combobox', { name: /Other parent/ })).toHaveValue('available')
    fireEvent.change(screen.getByRole('textbox', { name: /^First name/ }), { target: { value: 'Lina' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create and add child' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Lina' }), 'BIOLOGICAL', undefined, 'available', undefined))
  })

  it('does not offer an existing partner as a child candidate', () => {
    const graphWithPartner: FamilyGraph = {
      ...graph,
      partnerships: [{ id: 'partnership', treeId: 'tree', person1Id: 'selected', person2Id: 'available', partnershipType: 'PARTNERSHIP', startDate: null, endDate: null, createdAt: '' }],
    }
    render(<RelativeDialog kind="child" selectedId="selected" graph={graphWithPartner} onClose={vi.fn()} onLink={vi.fn()} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Link existing person' }))
    expect(screen.queryByRole('button', { name: 'Maja' })).not.toBeInTheDocument()
  })

  it('does not offer the selected person children in the existing-person tab', () => {
    const onLink = vi.fn()
    const child = person('child', 'Lina')
    const secondChild = person('second-child', 'Miha')
    const graphWithChild: FamilyGraph = {
      ...graph,
      people: [...graph.people, child, secondChild],
      parentChildRelationships: [
        ...graph.parentChildRelationships,
        { id: 'selected-child', treeId: 'tree', parentId: 'selected', childId: child.id, relationshipType: 'BIOLOGICAL', createdAt: '' },
        { id: 'selected-second-child', treeId: 'tree', parentId: 'selected', childId: secondChild.id, relationshipType: 'BIOLOGICAL', createdAt: '' },
      ],
    }
    render(<RelativeDialog kind="partner" selectedId="selected" graph={graphWithChild} onClose={vi.fn()} onLink={onLink} onCreate={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: /Partner is also a parent/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Lina' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Partner is also a parent/ }))
    expect(screen.getByRole('checkbox', { name: 'Lina' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Miha' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Link existing person' }))
    fireEvent.click(screen.getByRole('button', { name: 'Maja' }))
    expect(screen.queryByRole('checkbox', { name: 'Lina' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Miha' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Link person' }))

    expect(onLink).toHaveBeenCalledWith('available', 'PARTNERSHIP', undefined, [], undefined)
  })

  it('offers the existing candidate children when the selected person has none', () => {
    const onLink = vi.fn()
    const candidateChild = person('candidate-child', 'Tina')
    const graphWithCandidateChild: FamilyGraph = {
      ...graph,
      people: [...graph.people, candidateChild],
      parentChildRelationships: [
        ...graph.parentChildRelationships,
        { id: 'candidate-child-link', treeId: 'tree', parentId: 'available', childId: candidateChild.id, relationshipType: 'BIOLOGICAL', createdAt: '' },
      ],
    }
    render(<RelativeDialog kind="partner" selectedId="selected" graph={graphWithCandidateChild} onClose={vi.fn()} onLink={onLink} onCreate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Link existing person' }))
    fireEvent.click(screen.getByRole('button', { name: 'Maja' }))
    expect(screen.queryByRole('checkbox', { name: 'Tina' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Partner is also a parent/ }))
    expect(screen.getByRole('checkbox', { name: 'Tina' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Link person' }))

    expect(onLink).toHaveBeenCalledWith('available', 'PARTNERSHIP', undefined, ['candidate-child'], 'available')
  })
})
