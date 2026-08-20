import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import type { FamilyTree, TreeSharing, TreeVisibility, UUID } from '../types'
import { Modal } from './Modal'

export function GuestTreeClaimDialog({ trees, onClose, onClaim }: {
  trees: FamilyTree[]
  onClose: () => void
  onClaim: (treeIds: UUID[]) => Promise<void>
}) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<Set<UUID>>(() => new Set(trees.map((tree) => tree.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try { await onClaim([...selected]) } catch (caught) { setError(caught instanceof Error ? caught.message : t('unexpectedError')); setBusy(false) }
  }
  return <Modal title={t('claimGuestTrees')} onClose={onClose}>
    <form className="tree-access-form" onSubmit={submit}>
      <p>{t('claimGuestTreesHelp')}</p>
      <div className="claim-tree-list">{trees.map((tree) => <label key={tree.id}>
        <input type="checkbox" checked={selected.has(tree.id)} onChange={(event) => setSelected((current) => {
          const next = new Set(current)
          if (event.target.checked) next.add(tree.id); else next.delete(tree.id)
          return next
        })} />
        <span><strong>{tree.name}</strong><small>{new Date(tree.updatedAt).toLocaleDateString()}</small></span>
      </label>)}</div>
      {error && <p className="form-error">{error}</p>}
      <footer><button type="button" className="quiet" onClick={onClose}>{t('notNow')}</button><button className="primary" disabled={busy || selected.size === 0}>{busy ? t('saving') : t('connectToProfile')}</button></footer>
    </form>
  </Modal>
}

export function TreeSharingDialog({ tree, onClose }: { tree: FamilyTree; onClose: () => void }) {
  const { t } = useI18n()
  const [settings, setSettings] = useState<TreeSharing | null>(null)
  const [visibility, setVisibility] = useState<TreeVisibility>('PRIVATE')
  const [emails, setEmails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api.getSharing(tree.id).then((value) => {
      setSettings(value); setVisibility(value.visibility); setEmails(value.members.map((member) => member.email).join('\n'))
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : t('unexpectedError')))
  }, [t, tree.id])

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    const selectedEmails = emails.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean)
    try {
      const value = await api.updateSharing(tree.id, visibility, selectedEmails)
      setSettings(value); setVisibility(value.visibility); setEmails(value.members.map((member) => member.email).join('\n')); setBusy(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('unexpectedError')); setBusy(false) }
  }
  const publicUrl = settings?.publicShareId ? `${window.location.origin}/shared/${settings.publicShareId}` : null

  return <Modal title={t('shareTree')} onClose={onClose}>
    <form className="tree-access-form" onSubmit={save}>
      <p>{t('shareTreeHelp')}</p>
      <div className="visibility-options">
        <VisibilityOption value="PRIVATE" selected={visibility} onSelect={setVisibility} title={t('privateTree')} description={t('privateTreeHelp')} />
        <VisibilityOption value="RESTRICTED" selected={visibility} onSelect={setVisibility} title={t('restrictedTree')} description={t('restrictedTreeHelp')} />
        <VisibilityOption value="PUBLIC" selected={visibility} onSelect={setVisibility} title={t('publicTree')} description={t('publicTreeHelp')} />
      </div>
      {visibility === 'RESTRICTED' && <label className="shared-emails">{t('allowedUsers')}<textarea rows={4} value={emails} onChange={(event) => setEmails(event.target.value)} placeholder={t('allowedUsersPlaceholder')} /><small>{t('allowedUsersHelp')}</small></label>}
      {visibility === 'PUBLIC' && publicUrl && <div className="public-link"><label>{t('publicLink')}<input readOnly value={publicUrl} /></label><button type="button" className="quiet" onClick={() => void navigator.clipboard?.writeText(publicUrl)}>{t('copyLink')}</button></div>}
      {error && <p className="form-error">{error}</p>}
      <footer><button type="button" className="quiet" onClick={onClose}>{t('close')}</button><button className="primary" disabled={busy || settings === null}>{busy ? t('saving') : t('saveSharing')}</button></footer>
    </form>
  </Modal>
}

function VisibilityOption({ value, selected, onSelect, title, description }: {
  value: TreeVisibility; selected: TreeVisibility; onSelect: (value: TreeVisibility) => void; title: string; description: string
}) {
  return <label className={selected === value ? 'selected' : ''}><input type="radio" name="visibility" value={value} checked={selected === value} onChange={() => onSelect(value)} /><span><strong>{title}</strong><small>{description}</small></span></label>
}
