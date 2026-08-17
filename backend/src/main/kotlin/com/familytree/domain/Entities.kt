package com.familytree.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

enum class RelationshipType { BIOLOGICAL, ADOPTIVE, STEP, OTHER }
enum class PartnershipType { MARRIAGE, PARTNERSHIP, OTHER }

@Entity
@Table(name = "family_trees")
class FamilyTree(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 200) var name: String = "",
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = Instant.now(),
)

@Entity
@Table(name = "people")
class Person(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "tree_id", nullable = false) var treeId: UUID = UUID.randomUUID(),
    @Column(name = "first_name", nullable = false, length = 120) var firstName: String = "",
    @Column(name = "middle_name", length = 120) var middleName: String? = null,
    @Column(name = "last_name", length = 120) var lastName: String? = null,
    @Column(name = "maiden_name", length = 120) var maidenName: String? = null,
    @Column(length = 50) var gender: String? = null,
    @Column(name = "birth_date") var birthDate: LocalDate? = null,
    @Column(name = "death_date") var deathDate: LocalDate? = null,
    @Column(name = "birth_place", length = 250) var birthPlace: String? = null,
    @Column(name = "death_place", length = 250) var deathPlace: String? = null,
    @Column(columnDefinition = "TEXT") var notes: String? = null,
    @Column(name = "photo_url", length = 2000) var photoUrl: String? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = Instant.now(),
)

@Entity
@Table(name = "parent_child_relationships")
class ParentChildRelationship(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "tree_id", nullable = false) var treeId: UUID = UUID.randomUUID(),
    @Column(name = "parent_id", nullable = false) var parentId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING)
    @Column(name = "relationship_type", nullable = false, length = 30)
    var relationshipType: RelationshipType = RelationshipType.BIOLOGICAL,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "partnerships")
class Partnership(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "tree_id", nullable = false) var treeId: UUID = UUID.randomUUID(),
    @Column(name = "person_1_id", nullable = false) var person1Id: UUID = UUID.randomUUID(),
    @Column(name = "person_2_id", nullable = false) var person2Id: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING)
    @Column(name = "partnership_type", nullable = false, length = 30)
    var partnershipType: PartnershipType = PartnershipType.PARTNERSHIP,
    @Column(name = "start_date") var startDate: LocalDate? = null,
    @Column(name = "end_date") var endDate: LocalDate? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)
