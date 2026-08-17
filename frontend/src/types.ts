export type UUID = string

export interface FamilyTree {
  id: UUID
  name: string
  createdAt: string
  updatedAt: string
}

export interface Person {
  id: UUID
  treeId: UUID
  firstName: string
  middleName: string | null
  lastName: string | null
  maidenName: string | null
  gender: string | null
  birthDate: string | null
  deathDate: string | null
  birthPlace: string | null
  deathPlace: string | null
  notes: string | null
  photoUrl: string | null
  createdAt: string
  updatedAt: string
}

export type PersonInput = Pick<Person, 'firstName' | 'middleName' | 'lastName' | 'maidenName' | 'gender' | 'birthDate' | 'deathDate' | 'birthPlace' | 'deathPlace' | 'notes' | 'photoUrl'>
export type RelationshipType = 'BIOLOGICAL' | 'ADOPTIVE' | 'STEP' | 'OTHER'
export type PartnershipType = 'MARRIAGE' | 'PARTNERSHIP' | 'OTHER'

export interface ParentChildRelationship {
  id: UUID
  treeId: UUID
  parentId: UUID
  childId: UUID
  relationshipType: RelationshipType
  createdAt: string
}

export interface Partnership {
  id: UUID
  treeId: UUID
  person1Id: UUID
  person2Id: UUID
  partnershipType: PartnershipType
  startDate: string | null
  endDate: string | null
  createdAt: string
}

export interface FamilyGraph {
  tree: FamilyTree
  people: Person[]
  parentChildRelationships: ParentChildRelationship[]
  partnerships: Partnership[]
}

export interface ApiError {
  message: string
  fieldErrors?: Record<string, string>
}
