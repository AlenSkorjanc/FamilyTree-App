import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import type { FamilyTree, TreeMemberInput, TreePermission, TreeSharing, UUID } from '../types'
import { Modal } from './Modal'
import { PlusIcon, TrashIcon } from './Icons'

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
  const [publicPermission, setPublicPermission] = useState<TreePermission | null>(null)
  const [members, setMembers] = useState<Array<TreeMemberInput & { displayName?: string | null }>>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPermission, setNewPermission] = useState<TreePermission>('VIEW')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applySettings = (value: TreeSharing) => {
    setSettings(value)
    setPublicPermission(value.publicPermission)
    setMembers(value.members.map((member) => ({ email: member.email, permission: member.permission, displayName: member.displayName })))
  }

  useEffect(() => {
    void api.getSharing(tree.id).then(applySettings)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : t('unexpectedError')))
  }, [t, tree.id])

  const addMember = () => {
    const email = newEmail.trim()
    if (!email) return
    setMembers((current) => {
      const existing = current.findIndex((member) => member.email.toLowerCase() === email.toLowerCase())
      if (existing < 0) return [...current, { email, permission: newPermission }]
      return current.map((member, index) => index === existing ? { ...member, permission: newPermission } : member)
    })
    setNewEmail('')
    setNewPermission('VIEW')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    const pendingEmail = newEmail.trim()
    const submittedMembers = pendingEmail
      ? [...members.filter((member) => member.email.toLowerCase() !== pendingEmail.toLowerCase()), { email: pendingEmail, permission: newPermission }]
      : members
    try {
      const value = await api.updateSharing(tree.id, publicPermission, submittedMembers.map(({ email, permission }) => ({ email, permission })))
      applySettings(value); setNewEmail(''); setNewPermission('VIEW'); setBusy(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('unexpectedError')); setBusy(false) }
  }
  const deletePublicLink = async () => {
    setBusy(true); setError(null)
    try { applySettings(await api.deletePublicLink(tree.id)) } catch (caught) { setError(caught instanceof Error ? caught.message : t('unexpectedError')) } finally { setBusy(false) }
  }
  const publicUrl = settings?.publicShareId ? `${window.location.origin}/shared/${settings.publicShareId}` : null

  return <Modal title={t('shareTree')} onClose={onClose}>
    <form className="tree-access-form" onSubmit={save}>
      <p>{t('shareTreeHelp')}</p>
      <section className="sharing-section">
        <label className="sharing-channel-toggle"><input type="checkbox" checked={publicPermission !== null} onChange={(event) => setPublicPermission(event.target.checked ? 'VIEW' : null)} /><span><strong>{t('publicTree')}</strong><small>{t('publicTreeHelp')}</small></span></label>
        {publicPermission && <label className="sharing-permission">{t('linkPermission')}<select value={publicPermission} onChange={(event) => setPublicPermission(event.target.value as TreePermission)}><option value="VIEW">{t('viewPermission')}</option><option value="EDIT">{t('editPermission')}</option></select></label>}
        {publicPermission && !publicUrl && <small className="sharing-hint">{t('publicLinkCreatedAfterSave')}</small>}
        {publicUrl && <div className="public-link"><label>{t('publicLink')}<input readOnly value={publicUrl} /></label><div className="public-link-actions"><button type="button" className="quiet" onClick={() => void navigator.clipboard?.writeText(publicUrl)}>{t('copyLink')}</button><button type="button" className="icon-button public-link-delete" disabled={busy} onClick={() => void deletePublicLink()} aria-label={t('deletePublicLink')} title={t('deletePublicLink')}><TrashIcon /></button></div></div>}
      </section>
      <section className="sharing-section">
        <header><div><strong>{t('allowedUsers')}</strong><small>{t('allowedUsersHelp')}</small></div></header>
        <div className="add-shared-user"><input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder={t('allowedUsersPlaceholder')} /><select aria-label={t('userPermission')} value={newPermission} onChange={(event) => setNewPermission(event.target.value as TreePermission)}><option value="VIEW">{t('viewPermission')}</option><option value="EDIT">{t('editPermission')}</option></select><button type="button" className="quiet" disabled={!newEmail.trim()} onClick={addMember}><PlusIcon />{t('addUser')}</button></div>
        {members.length > 0 && <div className="shared-user-list">{members.map((member) => <div className="shared-user-row" key={member.email.toLowerCase()}><span><strong>{member.displayName || member.email}</strong>{member.displayName && <small>{member.email}</small>}</span><select aria-label={`${t('userPermission')}: ${member.email}`} value={member.permission} onChange={(event) => setMembers((current) => current.map((candidate) => candidate.email === member.email ? { ...candidate, permission: event.target.value as TreePermission } : candidate))}><option value="VIEW">{t('viewPermission')}</option><option value="EDIT">{t('editPermission')}</option></select><button type="button" className="icon-button" onClick={() => setMembers((current) => current.filter((candidate) => candidate.email !== member.email))} aria-label={`${t('removeUser')}: ${member.email}`}><TrashIcon /></button></div>)}</div>}
      </section>
      {error && <p className="form-error">{error}</p>}
      <footer><button type="button" className="quiet" onClick={onClose}>{t('close')}</button><button className="primary" disabled={busy || settings === null}>{busy ? t('saving') : t('saveSharing')}</button></footer>
    </form>
  </Modal>
}
