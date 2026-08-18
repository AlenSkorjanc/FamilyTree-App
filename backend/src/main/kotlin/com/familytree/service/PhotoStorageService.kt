package com.familytree.service

import com.familytree.dto.PhotoUploadResponse
import com.familytree.exception.BusinessRuleException
import com.familytree.exception.NotFoundException
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.io.FileSystemResource
import org.springframework.core.io.Resource
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.UUID

data class StoredPhoto(val resource: Resource, val mediaType: MediaType)

@Service
class PhotoStorageService(
    private val treeService: TreeService,
    @Value("\${app.photo-storage.path}") storagePath: String,
) {
    private val root: Path = Path.of(storagePath).toAbsolutePath().normalize()
    private val allowedTypes = mapOf(
        MediaType.IMAGE_JPEG_VALUE to "jpg",
        MediaType.IMAGE_PNG_VALUE to "png",
        "image/webp" to "webp",
        MediaType.IMAGE_GIF_VALUE to "gif",
    )

    fun store(treeId: UUID, file: MultipartFile): PhotoUploadResponse {
        treeService.requireTree(treeId)
        if (file.isEmpty) throw BusinessRuleException("Photo file cannot be empty")
        val extension = allowedTypes[file.contentType]
            ?: throw BusinessRuleException("Only JPEG, PNG, WebP, and GIF images are supported")
        if (!hasValidSignature(file, extension)) throw BusinessRuleException("File content does not match a supported image type")
        val filename = "${UUID.randomUUID()}.$extension"
        try {
            Files.createDirectories(root)
            file.inputStream.use { input -> Files.copy(input, root.resolve(filename), StandardCopyOption.REPLACE_EXISTING) }
        } catch (exception: Exception) {
            throw BusinessRuleException("Photo could not be stored")
        }
        return PhotoUploadResponse("/api/photos/$filename")
    }

    fun load(filename: String): StoredPhoto {
        if (!filename.matches(Regex("^[a-f0-9-]+\\.(jpg|png|webp|gif)$"))) throw BusinessRuleException("Invalid photo filename")
        val path = root.resolve(filename).normalize()
        if (!path.startsWith(root) || !Files.isRegularFile(path)) throw NotFoundException("Photo was not found")
        val mediaType = when (path.fileName.toString().substringAfterLast('.')) {
            "jpg" -> MediaType.IMAGE_JPEG
            "png" -> MediaType.IMAGE_PNG
            "gif" -> MediaType.IMAGE_GIF
            else -> MediaType.parseMediaType("image/webp")
        }
        return StoredPhoto(FileSystemResource(path), mediaType)
    }

    private fun hasValidSignature(file: MultipartFile, extension: String): Boolean {
        val header = ByteArray(12)
        val size = file.inputStream.use { it.read(header) }
        if (size < 6) return false
        return when (extension) {
            "jpg" -> header[0] == 0xFF.toByte() && header[1] == 0xD8.toByte() && header[2] == 0xFF.toByte()
            "png" -> header.sliceArray(0..7).contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
            "gif" -> String(header, 0, 6, Charsets.US_ASCII) in setOf("GIF87a", "GIF89a")
            "webp" -> size >= 12 && String(header, 0, 4, Charsets.US_ASCII) == "RIFF" && String(header, 8, 4, Charsets.US_ASCII) == "WEBP"
            else -> false
        }
    }
}
