package com.familytree.controller

import com.familytree.dto.TreeSharingRequest
import com.familytree.dto.TreeSharingResponse
import com.familytree.service.TreeSharingService
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/trees/{treeId}/sharing")
class TreeSharingController(private val service: TreeSharingService) {
    @GetMapping
    fun get(@PathVariable treeId: UUID): TreeSharingResponse = service.get(treeId)

    @PutMapping
    fun update(@PathVariable treeId: UUID, @Valid @RequestBody request: TreeSharingRequest): TreeSharingResponse =
        service.update(treeId, request)
}
