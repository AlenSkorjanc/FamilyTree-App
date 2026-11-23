package com.familytree.service

import com.familytree.domain.Person
import com.familytree.domain.RelationshipType
import com.familytree.dto.PersonRequest
import com.familytree.dto.PersonResponse
import com.familytree.exception.BusinessRuleException
import com.familytree.exception.NotFoundException
import com.familytree.mapper.toResponse
import com.familytree.repository.ParentChildRelationshipRepository
import com.familytree.repository.PartnershipRepository
import com.familytree.repository.PersonRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Service
class PersonService(
    private val treeService: TreeService,
    private val people: PersonRepository,
    private val parentChildren: ParentChildRelationshipRepository,
    private val partnerships: PartnershipRepository,
) {
    @Transactional
    fun create(treeId: UUID, request: PersonRequest): PersonResponse {
        treeService.requireEditableTree(treeId)
        validateDates(request)
        return people.save(Person(treeId = treeId).applyRequest(request)).toResponse()
    }

    @Transactional(readOnly = true)
    fun list(treeId: UUID, search: String?): List<PersonResponse> {
        treeService.requireReadableTree(treeId)
        val matches = if (search.isNullOrBlank()) people.findByTreeIdOrderByFirstNameAscLastNameAsc(treeId) else people.search(treeId, search.trim())
        return matches.map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun get(treeId: UUID, personId: UUID): PersonResponse = requireReadablePerson(treeId, personId).toResponse()

    @Transactional
    fun update(treeId: UUID, personId: UUID, request: PersonRequest): PersonResponse {
        treeService.requireEditableTree(treeId)
        treeService.lockForAncestryMutation(treeId)
        validateDates(request)
        validateBiologicalRelationships(treeId, personId, request.birthDate)
        val person = people.findByIdAndTreeId(personId, treeId)
            ?: throw NotFoundException("Person $personId was not found in tree $treeId", "PERSON_NOT_IN_TREE")
        person.applyRequest(request)
        person.updatedAt = Instant.now()
        return people.save(person).toResponse()
    }

    @Transactional
    fun delete(treeId: UUID, personId: UUID) {
        treeService.requireEditableTree(treeId)
        treeService.lockForAncestryMutation(treeId)
        val person = people.findByIdAndTreeId(personId, treeId)
            ?: throw NotFoundException("Person $personId was not found in tree $treeId", "PERSON_NOT_IN_TREE")
        parentChildren.deleteForPerson(treeId, personId)
        partnerships.deleteForPerson(treeId, personId)
        people.delete(person)
    }

    fun requirePerson(treeId: UUID, personId: UUID): Person {
        treeService.requireEditableTree(treeId)
        return people.findByIdAndTreeId(personId, treeId)
            ?: throw NotFoundException("Person $personId was not found in tree $treeId", "PERSON_NOT_IN_TREE")
    }

    fun requirePersonForUpdate(treeId: UUID, personId: UUID): Person = people.findByIdAndTreeIdForUpdate(personId, treeId)
        ?: throw NotFoundException("Person $personId was not found in family tree $treeId", "PERSON_NOT_IN_TREE")

    private fun requireReadablePerson(treeId: UUID, personId: UUID): Person {
        treeService.requireReadableTree(treeId)
        return people.findByIdAndTreeId(personId, treeId)
            ?: throw NotFoundException("Person $personId was not found in tree $treeId", "PERSON_NOT_IN_TREE")
    }

    private fun validateDates(request: PersonRequest) {
        if (request.birthDate != null && request.deathDate != null && request.deathDate.isBefore(request.birthDate)) {
            throw BusinessRuleException("Death date cannot be before birth date", "INVALID_PERSON_DATES")
        }
    }

    private fun validateBiologicalRelationships(treeId: UUID, personId: UUID, proposedBirthDate: LocalDate?) {
        if (proposedBirthDate == null) return
        val biologicalRelationships = parentChildren.findForPerson(treeId, personId)
            .filter { it.relationshipType == RelationshipType.BIOLOGICAL }
        val relativeIds = biologicalRelationships.map { if (it.parentId == personId) it.childId else it.parentId }.toSet()
        val relatives = people.findAllById(relativeIds).filter { it.treeId == treeId }.associateBy { it.id }
        val contradiction = biologicalRelationships.any { relationship ->
            val relativeId = if (relationship.parentId == personId) relationship.childId else relationship.parentId
            val relativeBirthDate = relatives[relativeId]?.birthDate ?: return@any false
            if (relationship.parentId == personId) proposedBirthDate.isAfter(relativeBirthDate)
            else relativeBirthDate.isAfter(proposedBirthDate)
        }
        if (contradiction) {
            throw BusinessRuleException(
                "This birth date contradicts an existing biological parent-child relationship",
                "INVALID_BIOLOGICAL_PARENT_DATES",
            )
        }
    }

    private fun Person.applyRequest(request: PersonRequest) = apply {
        firstName = request.firstName.trim()
        middleName = request.middleName.clean()
        lastName = request.lastName.clean()
        maidenName = request.maidenName.clean()
        gender = request.gender.clean()
        birthDate = request.birthDate
        deathDate = request.deathDate
        birthPlace = request.birthPlace.clean()
        deathPlace = request.deathPlace.clean()
        notes = request.notes.clean()
        photoUrl = request.photoUrl.clean()
    }

    private fun String?.clean(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
}
