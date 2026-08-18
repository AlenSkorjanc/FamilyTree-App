package com.familytree.service

import com.familytree.domain.ParentChildRelationship
import com.familytree.domain.Partnership
import com.familytree.dto.ParentChildRequest
import com.familytree.dto.ParentChildResponse
import com.familytree.dto.PartnershipRequest
import com.familytree.dto.PartnershipResponse
import com.familytree.exception.BusinessRuleException
import com.familytree.exception.ConflictException
import com.familytree.exception.NotFoundException
import com.familytree.mapper.toResponse
import com.familytree.repository.ParentChildRelationshipRepository
import com.familytree.repository.PartnershipRepository
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
        treeService.requireTree(treeId)
        if (request.parentId == request.childId) throw BusinessRuleException("A person cannot be their own parent")
        personService.requirePerson(treeId, request.parentId)
        personService.requirePerson(treeId, request.childId)
        val (firstPartner, secondPartner) = canonicalPair(request.parentId, request.childId)
        if (partnerships.existsByTreeIdAndPerson1IdAndPerson2Id(treeId, firstPartner, secondPartner)) {
            throw BusinessRuleException("Partners cannot also have a parent-child relationship with each other")
        }
        if (parentChildren.existsByTreeIdAndParentIdAndChildId(treeId, request.parentId, request.childId)) {
            throw ConflictException("This parent-child relationship already exists")
        }
        if (hasDescendant(treeId, request.childId, request.parentId)) {
            throw BusinessRuleException("This relationship would create an ancestry cycle")
        }
        return parentChildren.save(
            ParentChildRelationship(treeId = treeId, parentId = request.parentId, childId = request.childId, relationshipType = request.relationshipType),
        ).toResponse()
    }

    @Transactional(readOnly = true)
    fun listParentChild(treeId: UUID, personId: UUID? = null): List<ParentChildResponse> {
        treeService.requireTree(treeId)
        if (personId != null) personService.requirePerson(treeId, personId)
        val matches = if (personId == null) parentChildren.findByTreeId(treeId) else parentChildren.findForPerson(treeId, personId)
        return matches.map { it.toResponse() }
    }

    @Transactional
    fun deleteParentChild(treeId: UUID, relationshipId: UUID) {
        val relationship = parentChildren.findByIdAndTreeId(relationshipId, treeId)
            ?: throw NotFoundException("Parent-child relationship $relationshipId was not found")
        parentChildren.delete(relationship)
    }

    @Transactional
    fun createPartnership(treeId: UUID, request: PartnershipRequest): PartnershipResponse {
        treeService.requireTree(treeId)
        if (request.person1Id == request.person2Id) throw BusinessRuleException("A person cannot be partnered with themselves")
        if (request.startDate != null && request.endDate != null && request.endDate.isBefore(request.startDate)) {
            throw BusinessRuleException("Partnership end date cannot be before its start date")
        }
        if (request.sharedChildIds != null && request.copyChildrenFromPersonId == null) {
            throw BusinessRuleException("A source partner is required when selecting shared children")
        }
        personService.requirePerson(treeId, request.person1Id)
        personService.requirePerson(treeId, request.person2Id)
        if (hasAncestryRelationship(treeId, request.person1Id, request.person2Id)) {
            throw BusinessRuleException("Ancestors and descendants cannot also be partners")
        }
        val (first, second) = canonicalPair(request.person1Id, request.person2Id)
        if (partnerships.existsByTreeIdAndPerson1IdAndPerson2Id(treeId, first, second)) {
            throw ConflictException("A partnership between these people already exists")
        }
        val partnership = partnerships.save(
            Partnership(treeId = treeId, person1Id = first, person2Id = second, partnershipType = request.partnershipType, startDate = request.startDate, endDate = request.endDate),
        )
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
        val current = partnerships.findByIdAndTreeId(partnershipId, treeId)
            ?: throw NotFoundException("Partnership $partnershipId was not found")
        if (request.person1Id == request.person2Id) throw BusinessRuleException("A person cannot be partnered with themselves")
        personService.requirePerson(treeId, request.person1Id)
        personService.requirePerson(treeId, request.person2Id)
        if (hasAncestryRelationship(treeId, request.person1Id, request.person2Id)) {
            throw BusinessRuleException("Ancestors and descendants cannot also be partners")
        }
        if (request.startDate != null && request.endDate != null && request.endDate.isBefore(request.startDate)) {
            throw BusinessRuleException("Partnership end date cannot be before its start date")
        }
        if (request.copyChildrenFromPersonId != null) {
            throw BusinessRuleException("Children can only be copied while creating a partnership")
        }
        if (request.sharedChildIds != null) {
            throw BusinessRuleException("Shared children can only be selected while creating a partnership")
        }
        val (first, second) = canonicalPair(request.person1Id, request.person2Id)
        if ((first != current.person1Id || second != current.person2Id) && partnerships.existsByTreeIdAndPerson1IdAndPerson2Id(treeId, first, second)) {
            throw ConflictException("A partnership between these people already exists")
        }
        current.person1Id = first
        current.person2Id = second
        current.partnershipType = request.partnershipType
        current.startDate = request.startDate
        current.endDate = request.endDate
        return partnerships.save(current).toResponse()
    }

    @Transactional(readOnly = true)
    fun listPartnerships(treeId: UUID, personId: UUID? = null): List<PartnershipResponse> {
        treeService.requireTree(treeId)
        if (personId != null) personService.requirePerson(treeId, personId)
        val matches = if (personId == null) partnerships.findByTreeId(treeId) else partnerships.findForPerson(treeId, personId)
        return matches.map { it.toResponse() }
    }

    @Transactional
    fun deletePartnership(treeId: UUID, partnershipId: UUID) {
        val partnership = partnerships.findByIdAndTreeId(partnershipId, treeId)
            ?: throw NotFoundException("Partnership $partnershipId was not found")
        partnerships.delete(partnership)
    }

    private fun canonicalPair(a: UUID, b: UUID) = if (a.toString() < b.toString()) a to b else b to a

    private fun hasAncestryRelationship(treeId: UUID, first: UUID, second: UUID) =
        hasDescendant(treeId, first, second) || hasDescendant(treeId, second, first)

    private fun hasDescendant(treeId: UUID, ancestorId: UUID, soughtId: UUID): Boolean {
        var frontier = setOf(ancestorId)
        val visited = mutableSetOf<UUID>()
        while (frontier.isNotEmpty()) {
            if (soughtId in frontier) return true
            visited += frontier
            frontier = parentChildren.findChildIds(treeId, frontier).filterNot { it in visited }.toSet()
        }
        return false
    }
}
