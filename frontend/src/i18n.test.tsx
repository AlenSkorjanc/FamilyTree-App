import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from './i18n'
import { PersonForm } from './components/PersonForm'

describe('localization', () => {
  it('renders Slovenian labels when Slovenian is selected', () => {
    localStorage.setItem('family-tree-language', 'sl')
    render(<I18nProvider><PersonForm onSubmit={() => undefined} /></I18nProvider>)
    expect(screen.getByRole('textbox', { name: /^Ime/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shrani osebo' })).toBeInTheDocument()
  })
})
