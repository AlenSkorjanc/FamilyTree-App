package com.familytree.controller

import com.familytree.dto.ParentChildRequest
import com.familytree.dto.ParentChildResponse
import com.familytree.dto.PartnershipRequest
import com.familytree.dto.PartnershipResponse
import com.familytree.dto.CurrentPartnerRequest
import com.familytree.service.RelationshipService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/trees/{treeId}")
class RelationshipController(private val service: RelationshipService) {
    @PostMapping("/parent-child-relationships")
    @ResponseStatus(HttpStatus.CREATED)
    fun createParentChild(@PathVariable treeId: UUID, @RequestBody request: ParentChildRequest): ParentChildResponse = service.createParentChild(treeId, request)

    @GetMapping("/parent-child-relationships")
    fun listParentChild(@PathVariable treeId: UUID, @RequestParam(required = false) personId: UUID?): List<ParentChildResponse> = service.listParentChild(treeId, personId)

    @DeleteMapping("/parent-child-relationships/{relationshipId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteParentChild(@PathVariable treeId: UUID, @PathVariable relationshipId: UUID) = service.deleteParentChild(treeId, relationshipId)

    @PostMapping("/partnerships")
    @ResponseStatus(HttpStatus.CREATED)
    fun createPartnership(@PathVariable treeId: UUID, @RequestBody request: PartnershipRequest): PartnershipResponse = service.createPartnership(treeId, request)

    @GetMapping("/partnerships")
    fun listPartnerships(@PathVariable treeId: UUID, @RequestParam(required = false) personId: UUID?): List<PartnershipResponse> = service.listPartnerships(treeId, personId)

    @PatchMapping("/partnerships/{partnershipId}")
    fun updatePartnership(@PathVariable treeId: UUID, @PathVariable partnershipId: UUID, @RequestBody request: PartnershipRequest): PartnershipResponse =
        service.updatePartnership(treeId, partnershipId, request)

    @PatchMapping("/people/{personId}/current-partner")
    fun setCurrentPartner(
        @PathVariable treeId: UUID,
        @PathVariable personId: UUID,
        @RequestBody request: CurrentPartnerRequest,
    ): List<PartnershipResponse> = service.setCurrentPartner(treeId, personId, request)

    @DeleteMapping("/partnerships/{partnershipId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deletePartnership(@PathVariable treeId: UUID, @PathVariable partnershipId: UUID) = service.deletePartnership(treeId, partnershipId)
}
