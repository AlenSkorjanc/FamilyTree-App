import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FamilyGraph, Person } from '../types'
import { PersonDetails } from './PersonDetails'

const person: Person = {
  id: 'person', treeId: 'tree', firstName: 'Anna', middleName: 'Marija', lastName: 'Novak', maidenName: 'Kovač', gender: 'FEMALE',
  birthDate: '1990-01-02', deathDate: '2050-03-04', birthPlace: 'Ljubljana', deathPlace: 'Maribor', notes: 'Family notes',
  photoUrl: null, createdAt: '', updatedAt: '',
}

const graph: FamilyGraph = {
  tree: { id: 'tree', name: 'Tree', createdAt: '', updatedAt: '' },
  people: [person], parentChildRelationships: [], partnerships: [],
}

describe('PersonDetails', () => {
  it('shows every editable person field and uses the same initials avatar as the tree', () => {
    render(<PersonDetails
      person={person} graph={graph} onClose={vi.fn()} onSelect={vi.fn()} onEdit={vi.fn()} onAddRelative={vi.fn()}
      onDelete={vi.fn()} onRemoveParentChild={vi.fn()} onRemovePartnership={vi.fn()}
    />)

    expect(screen.getByText('AN')).toBeInTheDocument()
    expect(screen.getByText('First name')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Middle name')).toBeInTheDocument()
    expect(screen.getByText('Marija')).toBeInTheDocument()
    expect(screen.getByText('Last name')).toBeInTheDocument()
    expect(screen.getByText('Novak')).toBeInTheDocument()
    expect(screen.getByText('Maiden name')).toBeInTheDocument()
    expect(screen.getByText('Kovač')).toBeInTheDocument()
    expect(screen.getByText('Female')).toBeInTheDocument()
    expect(screen.getByText('2 Jan 1990')).toBeInTheDocument()
    expect(screen.getByText('Ljubljana')).toBeInTheDocument()
    expect(screen.getByText('4 Mar 2050')).toBeInTheDocument()
    expect(screen.getByText('Maribor')).toBeInTheDocument()
    expect(screen.getByText('Family notes')).toBeInTheDocument()
  })

  it('leaves missing detail values empty instead of showing an unknown placeholder', () => {
    const incomplete = { ...person, middleName: null, maidenName: null, deathDate: null, deathPlace: null, notes: null }
    const incompleteGraph = { ...graph, people: [incomplete] }

    render(<PersonDetails
      person={incomplete} graph={incompleteGraph} onClose={vi.fn()} onSelect={vi.fn()} onEdit={vi.fn()} onAddRelative={vi.fn()}
      onDelete={vi.fn()} onRemoveParentChild={vi.fn()} onRemovePartnership={vi.fn()}
    />)

    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })
})
