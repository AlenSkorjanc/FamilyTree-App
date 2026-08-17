package com.familytree.controller

import com.familytree.dto.GraphResponse
import com.familytree.service.GraphService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/trees/{treeId}/graph")
class GraphController(private val service: GraphService) {
    @GetMapping
    fun get(@PathVariable treeId: UUID): GraphResponse = service.get(treeId)
}
