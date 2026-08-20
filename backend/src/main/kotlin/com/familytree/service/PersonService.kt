package com.familytree.service

import com.familytree.domain.Person
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
        treeService.requireTree(treeId)
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
        validateDates(request)
        val person = requirePerson(treeId, personId).applyRequest(request)
        person.updatedAt = Instant.now()
        return people.save(person).toResponse()
    }

    @Transactional
    fun delete(treeId: UUID, personId: UUID) {
        val person = requirePerson(treeId, personId)
        parentChildren.deleteForPerson(treeId, personId)
        partnerships.deleteForPerson(treeId, personId)
        people.delete(person)
    }

    fun requirePerson(treeId: UUID, personId: UUID): Person {
        treeService.requireTree(treeId)
        return people.findByIdAndTreeId(personId, treeId)
            ?: throw NotFoundException("Person $personId was not found in tree $treeId")
    }

    fun requirePersonForUpdate(treeId: UUID, personId: UUID): Person = people.findByIdAndTreeIdForUpdate(personId, treeId)
        ?: throw NotFoundException("Person $personId was not found in family tree $treeId")

    private fun requireReadablePerson(treeId: UUID, personId: UUID): Person {
        treeService.requireReadableTree(treeId)
        return people.findByIdAndTreeId(personId, treeId)
            ?: throw NotFoundException("Person $personId was not found in tree $treeId")
    }

    private fun validateDates(request: PersonRequest) {
        if (request.birthDate != null && request.deathDate != null && request.deathDate.isBefore(request.birthDate)) {
            throw BusinessRuleException("Death date cannot be before birth date")
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
