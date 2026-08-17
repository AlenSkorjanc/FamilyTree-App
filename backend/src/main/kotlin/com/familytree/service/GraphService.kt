package com.familytree.service

import com.familytree.dto.GraphResponse
import com.familytree.mapper.toResponse
import com.familytree.repository.ParentChildRelationshipRepository
import com.familytree.repository.PartnershipRepository
import com.familytree.repository.PersonRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class GraphService(
    private val treeService: TreeService,
    private val people: PersonRepository,
    private val parentChildren: ParentChildRelationshipRepository,
    private val partnerships: PartnershipRepository,
) {
    @Transactional(readOnly = true)
    fun get(treeId: UUID): GraphResponse {
        val tree = treeService.requireTree(treeId)
        return GraphResponse(
            tree.toResponse(),
            people.findByTreeIdOrderByFirstNameAscLastNameAsc(treeId).map { it.toResponse() },
            parentChildren.findByTreeId(treeId).map { it.toResponse() },
            partnerships.findByTreeId(treeId).map { it.toResponse() },
        )
    }
}
