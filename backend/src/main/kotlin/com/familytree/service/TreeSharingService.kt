package com.familytree.service

import com.familytree.domain.FamilyTreeUserAccess
import com.familytree.domain.TreeVisibility
import com.familytree.dto.TreeMemberResponse
import com.familytree.dto.TreeSharingRequest
import com.familytree.dto.TreeSharingResponse
import com.familytree.exception.BusinessRuleException
import com.familytree.repository.AppUserRepository
import com.familytree.repository.FamilyTreeRepository
import com.familytree.repository.FamilyTreeUserAccessRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
class TreeSharingService(
    private val treeService: TreeService,
    private val treeRepository: FamilyTreeRepository,
    private val accessRepository: FamilyTreeUserAccessRepository,
    private val userRepository: AppUserRepository,
    private val authService: AuthService,
) {
    @Transactional(readOnly = true)
    fun get(treeId: UUID): TreeSharingResponse {
        val tree = treeService.requireTree(treeId)
        if (tree.ownerUserId == null) throw BusinessRuleException("Sign in before sharing a family tree")
        return response(treeId, tree.visibility, tree.publicShareId)
    }

    @Transactional
    fun update(treeId: UUID, request: TreeSharingRequest): TreeSharingResponse {
        val tree = treeService.requireTree(treeId)
        val ownerId = tree.ownerUserId ?: throw BusinessRuleException("Sign in before sharing a family tree")
        accessRepository.deleteByTreeId(treeId)
        when (request.visibility) {
            TreeVisibility.PRIVATE -> tree.publicShareId = null
            TreeVisibility.PUBLIC -> tree.publicShareId = UUID.randomUUID()
            TreeVisibility.RESTRICTED -> {
                tree.publicShareId = null
                request.sharedWithEmails
                    .map { email ->
                        userRepository.findByNormalizedEmail(authService.normalizeEmail(email))
                            ?: throw BusinessRuleException("No account exists for $email")
                    }
                    .distinctBy { it.id }
                    .forEach { user ->
                        if (user.id == ownerId) throw BusinessRuleException("The owner already has access")
                        accessRepository.save(FamilyTreeUserAccess(treeId = treeId, userId = user.id))
                    }
            }
        }
        tree.visibility = request.visibility
        tree.updatedAt = Instant.now()
        treeRepository.save(tree)
        return response(treeId, tree.visibility, tree.publicShareId)
    }

    private fun response(treeId: UUID, visibility: TreeVisibility, publicShareId: UUID?): TreeSharingResponse {
        val members = accessRepository.findByTreeIdOrderByCreatedAt(treeId).mapNotNull { access ->
            userRepository.findById(access.userId).orElse(null)?.let {
                TreeMemberResponse(it.id, it.email, it.displayName)
            }
        }
        return TreeSharingResponse(visibility, publicShareId, members)
    }
}
