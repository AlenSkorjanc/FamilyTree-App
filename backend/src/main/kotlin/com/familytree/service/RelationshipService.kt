package com.familytree.service

import com.familytree.domain.ParentChildRelationship
import com.familytree.domain.Partnership
import com.familytree.domain.RelationshipType
import com.familytree.dto.ParentChildRequest
import com.familytree.dto.ParentChildResponse
import com.familytree.dto.PartnershipRequest
import com.familytree.dto.PartnershipResponse
import com.familytree.dto.CurrentPartnerRequest
import com.familytree.exception.BusinessRuleException
import com.familytree.exception.ConflictException
import com.familytree.exception.NotFoundException
import com.familytree.mapper.toResponse
import com.familytree.repository.ParentChildRelationshipRepository
import com.familytree.repository.PartnershipRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class RelationshipService(
    private val treeService: TreeService,
    private val personService: PersonService,
    private val parentChildren: ParentChildRelationshipRepository,
    private val partnerships: PartnershipRepository,
) {
    @Transactional
    fun createParentChild(treeId: UUID, request: ParentChildRequest): ParentChildResponse {
        treeService.requireEditableTree(treeId)
        treeService.lockForAncestryMutation(treeId)
        if (request.parentId == request.childId) {
            throw BusinessRuleException("A person cannot be their own parent or child", "SELF_PARENT_RELATIONSHIP")
        }
        val parent = personService.requirePerson(treeId, request.parentId)
        val child = personService.requirePerson(treeId, request.childId)
        val parentBirthDate = parent.birthDate
        val childBirthDate = child.birthDate
        if (request.relationshipType == RelationshipType.BIOLOGICAL && parentBirthDate != null && childBirthDate != null && parentBirthDate.isAfter(childBirthDate)) {
            throw BusinessRuleException(
                "A biological parent cannot be born after their child",
                "INVALID_BIOLOGICAL_PARENT_DATES",
            )
        }
        val existing = parentChildren.findByTreeIdAndParentIdAndChildId(treeId, request.parentId, request.childId)
        if (existing != null) {
            if (existing.relationshipType == request.relationshipType) {
                throw ConflictException("This parent-child relationship already exists", "DUPLICATE_PARENT_CHILD_RELATIONSHIP")
            }
            existing.relationshipType = request.relationshipType
            return parentChildren.save(existing).toResponse()
        }
        if (parentChildren.wouldCreateCycle(treeId, request.parentId, request.childId)) {
            throw BusinessRuleException(
                "This relationship cannot be created because it would make the parent a descendant of the child",
                "ANCESTRY_CYCLE",
            )
        }
        return try {
            parentChildren.saveAndFlush(
                ParentChildRelationship(treeId = treeId, parentId = request.parentId, childId = request.childId, relationshipType = request.relationshipType),
            ).toResponse()
        } catch (_: DataIntegrityViolationException) {
            throw ConflictException("This parent-child relationship already exists", "DUPLICATE_PARENT_CHILD_RELATIONSHIP")
        }
    }

    @Transactional(readOnly = true)
    fun listParentChild(treeId: UUID, personId: UUID? = null): List<ParentChildResponse> {
        treeService.requireReadableTree(treeId)
        if (personId != null) personService.get(treeId, personId)
        val matches = if (personId == null) parentChildren.findByTreeId(treeId) else parentChildren.findForPerson(treeId, personId)
        return matches.map { it.toResponse() }
    }

    @Transactional
    fun deleteParentChild(treeId: UUID, relationshipId: UUID) {
        treeService.requireEditableTree(treeId)
        val relationship = parentChildren.findByIdAndTreeId(relationshipId, treeId)
            ?: throw NotFoundException("Parent-child relationship $relationshipId was not found")
        parentChildren.delete(relationship)
    }

    @Transactional
    fun createPartnership(treeId: UUID, request: PartnershipRequest): PartnershipResponse {
        treeService.requireEditableTree(treeId)
        validatePartnership(request)
        if (request.sharedChildIds != null && request.copyChildrenFromPersonId == null) {
            throw BusinessRuleException("A source partner is required when selecting shared children")
        }
        personService.requirePerson(treeId, request.person1Id)
        personService.requirePerson(treeId, request.person2Id)
        val (first, second) = canonicalPair(request.person1Id, request.person2Id)
        if (hasSemanticDuplicatePartnership(treeId, first, second, request)) {
            throw ConflictException("This partnership already exists", "DUPLICATE_PARTNERSHIP")
        }
        if (request.isCurrent) prepareCurrentPartnership(treeId, first, second)
        val partnership = try {
            partnerships.saveAndFlush(
                Partnership(
                    treeId = treeId,
                    person1Id = first,
                    person2Id = second,
                    partnershipType = request.partnershipType,
                    startDate = request.startDate,
                    endDate = request.endDate,
                    isCurrent = request.isCurrent,
                ),
            )
        } catch (_: DataIntegrityViolationException) {
            throw ConflictException("This partnership already exists", "DUPLICATE_PARTNERSHIP")
        }
        request.copyChildrenFromPersonId?.let { sourceParentId ->
            if (sourceParentId != request.person1Id && sourceParentId != request.person2Id) {
                throw BusinessRuleException("Children can only be copied from one of the new partners")
            }
            val newParentId = if (sourceParentId == request.person1Id) request.person2Id else request.person1Id
            val sourceChildren = parentChildren.findForPerson(treeId, sourceParentId)
                .filter { it.parentId == sourceParentId }
            request.sharedChildIds?.let { requestedChildIds ->
                val sourceChildIds = sourceChildren.map { it.childId }.toSet()
                if (!sourceChildIds.containsAll(requestedChildIds)) {
                    throw BusinessRuleException("Only existing children of the selected partner can be shared")
                }
            }
            sourceChildren
                .filter { request.sharedChildIds == null || it.childId in request.sharedChildIds }
                .forEach { existing ->
                    if (!parentChildren.existsByTreeIdAndParentIdAndChildId(treeId, newParentId, existing.childId)) {
                        createParentChild(treeId, ParentChildRequest(newParentId, existing.childId, existing.relationshipType))
                    }
                }
        }
        return partnership.toResponse()
    }

    @Transactional
    fun updatePartnership(treeId: UUID, partnershipId: UUID, request: PartnershipRequest): PartnershipResponse {
        treeService.requireEditableTree(treeId)
        val current = partnerships.findByIdAndTreeId(partnershipId, treeId)
            ?: throw NotFoundException("Partnership $partnershipId was not found")
        validatePartnership(request)
        personService.requirePerson(treeId, request.person1Id)
        personService.requirePerson(treeId, request.person2Id)
        if (request.copyChildrenFromPersonId != null) {
            throw BusinessRuleException("Children can only be copied while creating a partnership")
        }
        if (request.sharedChildIds != null) {
            throw BusinessRuleException("Shared children can only be selected while creating a partnership")
        }
        val (first, second) = canonicalPair(request.person1Id, request.person2Id)
        if (hasSemanticDuplicatePartnership(treeId, first, second, request, current.id)) {
            throw ConflictException("This partnership already exists", "DUPLICATE_PARTNERSHIP")
        }
        if (current.isCurrent || request.isCurrent) {
            lockPeople(treeId, setOf(current.person1Id, current.person2Id, first, second))
        }
        if (request.isCurrent) prepareCurrentPartnership(treeId, first, second, current.id)
        current.person1Id = first
        current.person2Id = second
        current.partnershipType = request.partnershipType
        current.startDate = request.startDate
        current.endDate = request.endDate
        current.isCurrent = request.isCurrent
        return try {
            partnerships.saveAndFlush(current).toResponse()
        } catch (_: DataIntegrityViolationException) {
            throw ConflictException("This partnership already exists", "DUPLICATE_PARTNERSHIP")
        }
    }

    @Transactional
    fun setCurrentPartner(treeId: UUID, personId: UUID, request: CurrentPartnerRequest): List<PartnershipResponse> {
        treeService.requireEditableTree(treeId)
        val personIds = setOfNotNull(personId, request.partnerId)
        lockPeople(treeId, personIds)
        val selected = request.partnerId?.let { partnerId ->
            val (first, second) = canonicalPair(personId, partnerId)
            partnerships.findByTreeIdAndPerson1IdAndPerson2Id(treeId, first, second)
                .let { matches -> matches.firstOrNull { it.isCurrent } ?: matches.maxByOrNull { it.createdAt } }
                ?: throw BusinessRuleException("The selected person is not a partner of this person")
        }
        val affected = partnerships.findForPeopleForUpdate(treeId, personIds)
        affected.forEach { it.isCurrent = it.id == selected?.id }
        partnerships.saveAll(affected)
        return partnerships.findForPerson(treeId, personId).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun listPartnerships(treeId: UUID, personId: UUID? = null): List<PartnershipResponse> {
        treeService.requireReadableTree(treeId)
        if (personId != null) personService.get(treeId, personId)
        val matches = if (personId == null) partnerships.findByTreeId(treeId) else partnerships.findForPerson(treeId, personId)
        return matches.map { it.toResponse() }
    }

    @Transactional
    fun deletePartnership(treeId: UUID, partnershipId: UUID) {
        treeService.requireEditableTree(treeId)
        val partnership = partnerships.findByIdAndTreeId(partnershipId, treeId)
            ?: throw NotFoundException("Partnership $partnershipId was not found")
        partnerships.delete(partnership)
    }

    private fun canonicalPair(a: UUID, b: UUID) = if (a.toString() < b.toString()) a to b else b to a

    private fun prepareCurrentPartnership(treeId: UUID, first: UUID, second: UUID, selectedId: UUID? = null) {
        lockPeople(treeId, setOf(first, second))
        partnerships.findForPeopleForUpdate(treeId, setOf(first, second)).forEach { partnership ->
            if (partnership.id != selectedId) partnership.isCurrent = false
        }
    }

    private fun lockPeople(treeId: UUID, personIds: Collection<UUID>) {
        personIds.sortedBy(UUID::toString).forEach { personService.requirePersonForUpdate(treeId, it) }
    }

    private fun validatePartnership(request: PartnershipRequest) {
        if (request.person1Id == request.person2Id) {
            throw BusinessRuleException("A person cannot be partnered with themselves", "SELF_PARTNERSHIP")
        }
        if (request.startDate != null && request.endDate != null && request.endDate.isBefore(request.startDate)) {
            throw BusinessRuleException("Partnership end date cannot be before its start date", "INVALID_PARTNERSHIP_DATES")
        }
    }

    private fun hasSemanticDuplicatePartnership(
        treeId: UUID,
        first: UUID,
        second: UUID,
        request: PartnershipRequest,
        excludedId: UUID? = null,
    ): Boolean = partnerships.findByTreeIdAndPerson1IdAndPerson2Id(treeId, first, second).any { existing ->
        existing.id != excludedId &&
            existing.partnershipType == request.partnershipType &&
            existing.startDate == request.startDate &&
            existing.endDate == request.endDate
    }
}
