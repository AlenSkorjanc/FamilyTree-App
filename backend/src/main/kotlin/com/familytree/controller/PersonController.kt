package com.familytree.controller

import com.familytree.dto.PersonRequest
import com.familytree.dto.PersonResponse
import com.familytree.service.PersonService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/trees/{treeId}/people")
class PersonController(private val service: PersonService) {
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@PathVariable treeId: UUID, @Valid @RequestBody request: PersonRequest): PersonResponse = service.create(treeId, request)

    @GetMapping
    fun list(@PathVariable treeId: UUID, @RequestParam(required = false) search: String?): List<PersonResponse> = service.list(treeId, search)

    @GetMapping("/{personId}")
    fun get(@PathVariable treeId: UUID, @PathVariable personId: UUID): PersonResponse = service.get(treeId, personId)

    @PatchMapping("/{personId}")
    fun update(@PathVariable treeId: UUID, @PathVariable personId: UUID, @Valid @RequestBody request: PersonRequest): PersonResponse =
        service.update(treeId, personId, request)

    @DeleteMapping("/{personId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable treeId: UUID, @PathVariable personId: UUID) = service.delete(treeId, personId)
}
