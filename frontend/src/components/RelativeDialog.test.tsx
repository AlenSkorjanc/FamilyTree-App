import { fireEvent, render, screen } from '@testing-library/react'
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
  people: [person('selected', 'Anna'), person('existing-parent', 'Peter'), person('available', 'Maja')],
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
    expect(onLink).toHaveBeenCalledWith('available', 'ADOPTIVE')
  })
})
