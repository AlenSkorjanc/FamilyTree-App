package com.familytree.controller

import com.familytree.dto.PhotoUploadResponse
import com.familytree.service.PhotoStorageService
import com.familytree.security.AuthenticatedUser
import org.springframework.core.io.Resource
import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.time.Duration
import java.util.UUID

@RestController
class PhotoController(private val photoStorage: PhotoStorageService, private val authenticatedUser: AuthenticatedUser) {
    @PostMapping("/api/trees/{treeId}/photos")
    fun upload(@PathVariable treeId: UUID, @RequestParam("file") file: MultipartFile): PhotoUploadResponse = photoStorage.store(treeId, file)

    @PostMapping("/api/auth/me/photo")
    fun uploadProfile(@RequestParam("file") file: MultipartFile): PhotoUploadResponse {
        authenticatedUser.id()
        return photoStorage.storeProfile(file)
    }

    @GetMapping("/api/photos/{filename}")
    fun get(@PathVariable filename: String): ResponseEntity<Resource> {
        val photo = photoStorage.load(filename)
        return ResponseEntity.ok()
            .contentType(photo.mediaType)
            .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
            .body(photo.resource)
    }
}
