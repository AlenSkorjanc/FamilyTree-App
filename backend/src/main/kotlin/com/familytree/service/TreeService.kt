package com.familytree.service

import com.familytree.domain.FamilyTree
import com.familytree.dto.CreateTreeRequest
import com.familytree.dto.TreeResponse
import com.familytree.dto.UpdateTreeRequest
import com.familytree.exception.NotFoundException
import com.familytree.mapper.toResponse
import com.familytree.repository.FamilyTreeRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
class TreeService(private val repository: FamilyTreeRepository) {
    @Transactional
    fun create(request: CreateTreeRequest): TreeResponse = repository.save(FamilyTree(name = request.name.trim())).toResponse()

    @Transactional(readOnly = true)
    fun list(): List<TreeResponse> = repository.findAll().sortedBy { it.createdAt }.map { it.toResponse() }

    @Transactional(readOnly = true)
    fun get(id: UUID): TreeResponse = requireTree(id).toResponse()

    @Transactional
    fun update(id: UUID, request: UpdateTreeRequest): TreeResponse {
        val tree = requireTree(id)
        tree.name = request.name.trim()
        tree.updatedAt = Instant.now()
        return repository.save(tree).toResponse()
    }

    @Transactional
    fun delete(id: UUID) {
        if (!repository.existsById(id)) throw NotFoundException("Family tree $id was not found")
        repository.deleteById(id)
    }

    fun requireTree(id: UUID): FamilyTree = repository.findById(id).orElseThrow { NotFoundException("Family tree $id was not found") }
}
