package com.familytree.dto

import com.familytree.domain.PartnershipType
import com.familytree.domain.RelationshipType
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class CreateTreeRequest(@field:NotBlank @field:Size(max = 200) val name: String)
data class UpdateTreeRequest(@field:NotBlank @field:Size(max = 200) val name: String)
data class TreeResponse(val id: UUID, val name: String, val createdAt: Instant, val updatedAt: Instant)

data class PersonRequest(
    @field:NotBlank @field:Size(max = 120) val firstName: String,
    @field:Size(max = 120) val middleName: String? = null,
    @field:Size(max = 120) val lastName: String? = null,
    @field:Size(max = 120) val maidenName: String? = null,
    @field:Size(max = 50) val gender: String? = null,
    val birthDate: LocalDate? = null,
    val deathDate: LocalDate? = null,
    @field:Size(max = 250) val birthPlace: String? = null,
    @field:Size(max = 250) val deathPlace: String? = null,
    val notes: String? = null,
    @field:Size(max = 2000) val photoUrl: String? = null,
)

data class PersonResponse(
    val id: UUID,
    val treeId: UUID,
    val firstName: String,
    val middleName: String?,
    val lastName: String?,
    val maidenName: String?,
    val gender: String?,
    val birthDate: LocalDate?,
    val deathDate: LocalDate?,
    val birthPlace: String?,
    val deathPlace: String?,
    val notes: String?,
    val photoUrl: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class ParentChildRequest(
    val parentId: UUID,
    val childId: UUID,
    val relationshipType: RelationshipType = RelationshipType.BIOLOGICAL,
)

data class ParentChildResponse(
    val id: UUID,
    val treeId: UUID,
    val parentId: UUID,
    val childId: UUID,
    val relationshipType: RelationshipType,
    val createdAt: Instant,
)

data class PartnershipRequest(
    val person1Id: UUID,
    val person2Id: UUID,
    val partnershipType: PartnershipType = PartnershipType.PARTNERSHIP,
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null,
    val copyChildrenFromPersonId: UUID? = null,
    val sharedChildIds: Set<UUID>? = null,
)

data class PartnershipResponse(
    val id: UUID,
    val treeId: UUID,
    val person1Id: UUID,
    val person2Id: UUID,
    val partnershipType: PartnershipType,
    val startDate: LocalDate?,
    val endDate: LocalDate?,
    val createdAt: Instant,
)

data class GraphResponse(
    val tree: TreeResponse,
    val people: List<PersonResponse>,
    val parentChildRelationships: List<ParentChildResponse>,
    val partnerships: List<PartnershipResponse>,
)

data class PhotoUploadResponse(val photoUrl: String)

data class ApiError(
    val status: Int,
    val code: String,
    val message: String,
    val path: String,
    val timestamp: Instant = Instant.now(),
    val fieldErrors: Map<String, String> = emptyMap(),
)
