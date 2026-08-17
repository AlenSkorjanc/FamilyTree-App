import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PersonForm } from './PersonForm'

describe('PersonForm', () => {
  it('requires only a first name and accepts otherwise incomplete data', async () => {
    const onSubmit = vi.fn()
    render(<PersonForm onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save person' }))
    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /^First name/ }), { target: { value: 'Anna' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save person' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ firstName: 'Anna', lastName: null, birthDate: null })
  })
})
