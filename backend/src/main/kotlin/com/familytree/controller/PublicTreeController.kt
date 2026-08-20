package com.familytree.controller

import com.familytree.dto.GraphResponse
import com.familytree.service.GraphService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/public/trees")
class PublicTreeController(private val graphService: GraphService) {
    @GetMapping("/{publicShareId}/graph")
    fun graph(@PathVariable publicShareId: UUID): GraphResponse = graphService.getPublic(publicShareId)
}
