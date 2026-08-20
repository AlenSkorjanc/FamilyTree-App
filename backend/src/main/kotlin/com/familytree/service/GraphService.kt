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
        val accessible = treeService.requireReadableTree(treeId)
        return graph(accessible)
    }

    @Transactional(readOnly = true)
    fun getPublic(publicShareId: UUID): GraphResponse = graph(treeService.requirePublicTree(publicShareId))

    private fun graph(accessible: AccessibleTree): GraphResponse {
        val tree = accessible.tree
        return GraphResponse(
            tree.toResponse(accessible.access),
            people.findByTreeIdOrderByFirstNameAscLastNameAsc(tree.id).map { it.toResponse() },
            parentChildren.findByTreeId(tree.id).map { it.toResponse() },
            partnerships.findByTreeId(tree.id).map { it.toResponse() },
        )
    }
}
