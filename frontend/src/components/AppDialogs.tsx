import type { FormEvent } from 'react'
import { fullName } from '../api'
import { useI18n } from '../i18n'
import type { Person } from '../types'
import { Modal } from './Modal'

interface TreeNameDialogProps {
  mode: 'create' | 'rename'
  value: string
  pending?: boolean
  error?: string | null
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function TreeNameDialog({ mode, value, pending, error, onChange, onClose, onSubmit }: TreeNameDialogProps) {
  const { t } = useI18n()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (value.trim()) onSubmit()
  }
  return (
    <Modal title={mode === 'create' ? t('newTree').replace('+ ', '') : t('renameTree')} onClose={onClose}>
      <form className="tree-name-form" onSubmit={submit}>
        <label>{t('treeName')}<input autoFocus maxLength={200} value={value} onChange={(event) => onChange(event.target.value)} /></label>
        {error && <p className="form-error">{error}</p>}
        <footer>
          <button type="button" className="quiet" onClick={onClose}>{t('cancel')}</button>
          <button className="primary" disabled={!value.trim() || pending}>{mode === 'create' ? t('createTree') : t('saveTreeName')}</button>
        </footer>
      </form>
    </Modal>
  )
}

interface DeletePersonDialogProps {
  person: Person
  onClose: () => void
  onConfirm: () => void
}

export function DeletePersonDialog({ person, onClose, onConfirm }: DeletePersonDialogProps) {
  const { t } = useI18n()
  return (
    <Modal title={t('deletePerson')} onClose={onClose}>
      <div className="confirmation-dialog">
        <p>{t('deleteConfirm', { name: fullName(person) })}</p>
        <footer>
          <button type="button" className="quiet" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="danger-button" onClick={onConfirm}>{t('deletePerson')}</button>
        </footer>
      </div>
    </Modal>
  )
}
