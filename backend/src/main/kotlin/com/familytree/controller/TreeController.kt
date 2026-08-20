package com.familytree.controller

import com.familytree.dto.CreateTreeRequest
import com.familytree.dto.TreeResponse
import com.familytree.dto.UpdateTreeRequest
import com.familytree.dto.ClaimGuestTreesRequest
import com.familytree.security.AuthenticatedUser
import com.familytree.security.GuestSession
import jakarta.servlet.http.HttpServletResponse
import com.familytree.service.TreeService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/trees")
class TreeController(
    private val service: TreeService,
    private val authenticatedUser: AuthenticatedUser,
    private val guestSession: GuestSession,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody request: CreateTreeRequest, response: HttpServletResponse): TreeResponse {
        val guestOwnerId = if (authenticatedUser.idOrNull() == null) guestSession.ensure(response) else null
        return service.create(request, guestOwnerId)
    }

    @PostMapping("/claim-preview")
    fun previewClaim(@Valid @RequestBody request: ClaimGuestTreesRequest): List<TreeResponse> = service.previewGuestTrees(request)

    @PostMapping("/claim")
    fun claim(@Valid @RequestBody request: ClaimGuestTreesRequest): List<TreeResponse> = service.claimGuestTrees(request)

    @GetMapping
    fun list(): List<TreeResponse> = service.list()

    @GetMapping("/{treeId}")
    fun get(@PathVariable treeId: UUID): TreeResponse = service.get(treeId)

    @PatchMapping("/{treeId}")
    fun update(@PathVariable treeId: UUID, @Valid @RequestBody request: UpdateTreeRequest): TreeResponse = service.update(treeId, request)

    @DeleteMapping("/{treeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable treeId: UUID) = service.delete(treeId)
}
