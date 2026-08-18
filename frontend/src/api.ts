import type { ApiError, FamilyGraph, FamilyTree, ParentChildRelationship, Partnership, PartnershipType, Person, PersonInput, RelationshipType, UUID } from './types'

const baseUrl = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText })) as ApiError
    throw new Error(error.message || 'Request failed')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

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
    const response = await fetch(`${baseUrl}/api/trees/${treeId}/photos`, { method: 'POST', body })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as ApiError
      throw new Error(error.message || 'Photo upload failed')
    }
    return response.json() as Promise<{ photoUrl: string }>
  },
  createParentChild: (treeId: UUID, parentId: UUID, childId: UUID, relationshipType: RelationshipType) =>
    request<ParentChildRelationship>(`/api/trees/${treeId}/parent-child-relationships`, { method: 'POST', body: JSON.stringify({ parentId, childId, relationshipType }) }),
  deleteParentChild: (treeId: UUID, relationshipId: UUID) => request<void>(`/api/trees/${treeId}/parent-child-relationships/${relationshipId}`, { method: 'DELETE' }),
  createPartnership: (treeId: UUID, person1Id: UUID, person2Id: UUID, partnershipType: PartnershipType, copyChildrenFromPersonId?: UUID, sharedChildIds?: UUID[]) =>
    request<Partnership>(`/api/trees/${treeId}/partnerships`, { method: 'POST', body: JSON.stringify({ person1Id, person2Id, partnershipType, copyChildrenFromPersonId, sharedChildIds }) }),
  deletePartnership: (treeId: UUID, partnershipId: UUID) => request<void>(`/api/trees/${treeId}/partnerships/${partnershipId}`, { method: 'DELETE' }),
}

export function resolvePhotoUrl(photoUrl: string): string {
  if (/^(https?:|data:|blob:)/.test(photoUrl)) return photoUrl
  return `${baseUrl}${photoUrl}`
}

export function fullName(person: Person): string {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ')
}
