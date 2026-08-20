import type { FamilyGraph, FamilyTree, ParentChildRelationship, Partnership, PartnershipType, Person, PersonInput, RelationshipType, TreeSharing, TreeVisibility, UUID } from './types'
import { apiBaseUrl, authenticatedRequest as request, publicRequest } from './authClient'

export const api = {
  listTrees: () => request<FamilyTree[]>('/api/trees'),
  createTree: (name: string) => request<FamilyTree>('/api/trees', { method: 'POST', body: JSON.stringify({ name }) }),
  updateTree: (treeId: UUID, name: string) => request<FamilyTree>(`/api/trees/${treeId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteTree: (treeId: UUID) => request<void>(`/api/trees/${treeId}`, { method: 'DELETE' }),
  graph: (treeId: UUID) => request<FamilyGraph>(`/api/trees/${treeId}/graph`),
  searchPeople: (treeId: UUID, search: string) => request<Person[]>(`/api/trees/${treeId}/people?search=${encodeURIComponent(search)}`),
  createPerson: (treeId: UUID, input: PersonInput) => request<Person>(`/api/trees/${treeId}/people`, { method: 'POST', body: JSON.stringify(input) }),
  updatePerson: (treeId: UUID, personId: UUID, input: PersonInput) => request<Person>(`/api/trees/${treeId}/people/${personId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deletePerson: (treeId: UUID, personId: UUID) => request<void>(`/api/trees/${treeId}/people/${personId}`, { method: 'DELETE' }),
  uploadPhoto: async (treeId: UUID, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<{ photoUrl: string }>(`/api/trees/${treeId}/photos`, { method: 'POST', body })
  },
  createParentChild: (treeId: UUID, parentId: UUID, childId: UUID, relationshipType: RelationshipType) =>
    request<ParentChildRelationship>(`/api/trees/${treeId}/parent-child-relationships`, { method: 'POST', body: JSON.stringify({ parentId, childId, relationshipType }) }),
  deleteParentChild: (treeId: UUID, relationshipId: UUID) => request<void>(`/api/trees/${treeId}/parent-child-relationships/${relationshipId}`, { method: 'DELETE' }),
  createPartnership: (treeId: UUID, person1Id: UUID, person2Id: UUID, partnershipType: PartnershipType, copyChildrenFromPersonId?: UUID, sharedChildIds?: UUID[], isCurrent = false) =>
    request<Partnership>(`/api/trees/${treeId}/partnerships`, { method: 'POST', body: JSON.stringify({ person1Id, person2Id, partnershipType, copyChildrenFromPersonId, sharedChildIds, isCurrent }) }),
  updatePartnership: (treeId: UUID, partnership: Partnership, partnershipType: PartnershipType) =>
    request<Partnership>(`/api/trees/${treeId}/partnerships/${partnership.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        person1Id: partnership.person1Id,
        person2Id: partnership.person2Id,
        partnershipType,
        startDate: partnership.startDate,
        endDate: partnership.endDate,
        isCurrent: partnership.isCurrent,
      }),
    }),
  setCurrentPartner: (treeId: UUID, personId: UUID, partnerId: UUID | null) =>
    request<Partnership[]>(`/api/trees/${treeId}/people/${personId}/current-partner`, { method: 'PATCH', body: JSON.stringify({ partnerId }) }),
  deletePartnership: (treeId: UUID, partnershipId: UUID) => request<void>(`/api/trees/${treeId}/partnerships/${partnershipId}`, { method: 'DELETE' }),
  previewGuestTrees: (treeIds: UUID[]) => request<FamilyTree[]>('/api/trees/claim-preview', { method: 'POST', body: JSON.stringify({ treeIds }) }),
  claimGuestTrees: (treeIds: UUID[]) => request<FamilyTree[]>('/api/trees/claim', { method: 'POST', body: JSON.stringify({ treeIds }) }),
  getSharing: (treeId: UUID) => request<TreeSharing>(`/api/trees/${treeId}/sharing`),
  updateSharing: (treeId: UUID, visibility: TreeVisibility, sharedWithEmails: string[]) => request<TreeSharing>(`/api/trees/${treeId}/sharing`, { method: 'PUT', body: JSON.stringify({ visibility, sharedWithEmails }) }),
}

const GUEST_TREE_IDS_KEY = 'family-tree-guest-tree-ids'

export function guestTreeIds(): UUID[] {
  try {
    const value = JSON.parse(localStorage.getItem(GUEST_TREE_IDS_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? value.filter((id): id is UUID => typeof id === 'string') : []
  } catch { return [] }
}

export function removeGuestTreeIds(ids: UUID[]) {
  const removed = new Set(ids)
  localStorage.setItem(GUEST_TREE_IDS_KEY, JSON.stringify(guestTreeIds().filter((id) => !removed.has(id))))
}

function rememberGuestTree(id: UUID) {
  localStorage.setItem(GUEST_TREE_IDS_KEY, JSON.stringify([...new Set([...guestTreeIds(), id])]))
}

export const guestApi: typeof api = {
  ...api,
  listTrees: async () => {
    const ids = new Set(guestTreeIds())
    return (await api.listTrees()).filter((tree) => ids.has(tree.id))
  },
  createTree: async (name) => {
    const tree = await api.createTree(name)
    rememberGuestTree(tree.id)
    return tree
  },
  deleteTree: async (treeId) => {
    await api.deleteTree(treeId)
    removeGuestTreeIds([treeId])
  },
}

export const publicApi = {
  graph: (publicShareId: UUID) => publicRequest<FamilyGraph>(`/api/public/trees/${publicShareId}/graph`),
}

export function resolvePhotoUrl(photoUrl: string): string {
  if (/^(https?:|data:|blob:)/.test(photoUrl)) return photoUrl
  return `${apiBaseUrl}${photoUrl}`
}

export function fullName(person: Person): string {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ')
}
