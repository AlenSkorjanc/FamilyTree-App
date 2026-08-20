package com.familytree.service

import com.familytree.domain.FamilyTree
import com.familytree.domain.TreeVisibility
import com.familytree.dto.ClaimGuestTreesRequest
import com.familytree.dto.CreateTreeRequest
import com.familytree.dto.TreeAccess
import com.familytree.dto.TreeResponse
import com.familytree.dto.UpdateTreeRequest
import com.familytree.exception.AuthenticationRequiredException
import com.familytree.exception.NotFoundException
import com.familytree.mapper.toResponse
import com.familytree.repository.FamilyTreeRepository
import com.familytree.repository.FamilyTreeUserAccessRepository
import com.familytree.security.AuthenticatedUser
import com.familytree.security.GuestSession
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class AccessibleTree(val tree: FamilyTree, val access: TreeAccess)

@Service
class TreeService(
    private val repository: FamilyTreeRepository,
    private val userAccessRepository: FamilyTreeUserAccessRepository,
    private val authenticatedUser: AuthenticatedUser,
    private val guestSession: GuestSession,
) {
    @Transactional
    fun create(request: CreateTreeRequest, guestOwnerId: UUID? = null): TreeResponse {
        val userId = authenticatedUser.idOrNull()
        if (userId == null && guestOwnerId == null) throw AuthenticationRequiredException()
        val tree = repository.save(
            FamilyTree(
                ownerUserId = userId,
                guestOwnerId = if (userId == null) guestOwnerId else null,
                name = request.name.trim(),
            ),
        )
        return tree.toResponse(if (userId == null) TreeAccess.GUEST_OWNER else TreeAccess.OWNER)
    }

    @Transactional(readOnly = true)
    fun list(): List<TreeResponse> {
        val userId = authenticatedUser.idOrNull()
        if (userId != null) {
            val owned = repository.findByOwnerUserIdOrderByCreatedAt(userId).map { it.toResponse(TreeAccess.OWNER) }
            val ownedIds = owned.map { it.id }.toSet()
            val sharedIds = userAccessRepository.findByUserId(userId).map { it.treeId }.filterNot { it in ownedIds }
            val shared = repository.findAllById(sharedIds)
                .filter { it.visibility != TreeVisibility.PRIVATE }
                .map { it.toResponse(TreeAccess.VIEWER) }
            return (owned + shared).sortedBy { it.createdAt }
        }
        val guestId = guestSession.idOrNull() ?: return emptyList()
        return repository.findByGuestOwnerIdOrderByCreatedAt(guestId).map { it.toResponse(TreeAccess.GUEST_OWNER) }
    }

    @Transactional(readOnly = true)
    fun get(id: UUID): TreeResponse {
        val accessible = requireReadableTree(id)
        return accessible.tree.toResponse(accessible.access)
    }

    @Transactional
    fun update(id: UUID, request: UpdateTreeRequest): TreeResponse {
        val tree = requireTree(id)
        tree.name = request.name.trim()
        tree.updatedAt = Instant.now()
        return repository.save(tree).toResponse(ownerAccess(tree))
    }

    @Transactional
    fun delete(id: UUID) {
        repository.delete(requireTree(id))
    }

    @Transactional(readOnly = true)
    fun previewGuestTrees(request: ClaimGuestTreesRequest): List<TreeResponse> {
        val guestId = guestSession.idOrNull() ?: return emptyList()
        return request.treeIds.mapNotNull { repository.findByIdAndGuestOwnerId(it, guestId) }
            .sortedBy { it.createdAt }
            .map { it.toResponse(TreeAccess.GUEST_OWNER) }
    }

    @Transactional
    fun claimGuestTrees(request: ClaimGuestTreesRequest): List<TreeResponse> {
        val userId = authenticatedUser.id()
        val guestId = guestSession.idOrNull() ?: throw NotFoundException("Guest trees were not found")
        val trees = request.treeIds.map { id ->
            repository.findByIdAndGuestOwnerId(id, guestId)
                ?: throw NotFoundException("Guest family tree $id was not found")
        }
        return trees.map { tree ->
            tree.ownerUserId = userId
            tree.guestOwnerId = null
            tree.updatedAt = Instant.now()
            repository.save(tree).toResponse(TreeAccess.OWNER)
        }
    }

    fun requireTree(id: UUID): FamilyTree {
        val userId = authenticatedUser.idOrNull()
        if (userId != null) {
            return repository.findByIdAndOwnerUserId(id, userId)
                ?: throw NotFoundException("Family tree $id was not found")
        }
        val guestId = guestSession.idOrNull()
        return guestId?.let { repository.findByIdAndGuestOwnerId(id, it) }
            ?: throw NotFoundException("Family tree $id was not found")
    }

    fun requireReadableTree(id: UUID): AccessibleTree {
        val userId = authenticatedUser.idOrNull()
        if (userId != null) {
            repository.findByIdAndOwnerUserId(id, userId)?.let { return AccessibleTree(it, TreeAccess.OWNER) }
            val shared = repository.findById(id).orElse(null)
            if (shared != null && shared.visibility != TreeVisibility.PRIVATE && userAccessRepository.existsByTreeIdAndUserId(id, userId)) {
                return AccessibleTree(shared, TreeAccess.VIEWER)
            }
            throw NotFoundException("Family tree $id was not found")
        }
        val guestId = guestSession.idOrNull()
        val guestTree = guestId?.let { repository.findByIdAndGuestOwnerId(id, it) }
            ?: throw NotFoundException("Family tree $id was not found")
        return AccessibleTree(guestTree, TreeAccess.GUEST_OWNER)
    }

    fun requirePublicTree(publicShareId: UUID): AccessibleTree {
        val tree = repository.findByPublicShareIdAndVisibility(publicShareId, TreeVisibility.PUBLIC)
            ?: throw NotFoundException("Shared family tree was not found")
        return AccessibleTree(tree, TreeAccess.VIEWER)
    }

    private fun ownerAccess(tree: FamilyTree) = if (tree.ownerUserId == null) TreeAccess.GUEST_OWNER else TreeAccess.OWNER
}
