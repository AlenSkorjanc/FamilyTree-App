package com.familytree.service

import com.familytree.config.AuthProperties
import com.familytree.domain.AppUser
import com.familytree.domain.RefreshToken
import com.familytree.repository.AppUserRepository
import com.familytree.repository.RefreshTokenRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.Base64
import java.util.UUID

data class RefreshCredential(val rawToken: String, val user: AppUser) {
    override fun toString(): String = "RefreshCredential(rawToken=[REDACTED], userId=${user.id})"
}

sealed interface RefreshRotationResult {
    data class Success(val credential: RefreshCredential) : RefreshRotationResult
    data object Invalid : RefreshRotationResult
    data object Reused : RefreshRotationResult
}

@Service
class RefreshTokenService(
    private val repository: RefreshTokenRepository,
    private val userRepository: AppUserRepository,
    private val properties: AuthProperties,
) {
    private val secureRandom = SecureRandom()

    @Transactional
    fun create(user: AppUser, userAgent: String?, ipAddress: String?, familyId: UUID = UUID.randomUUID()): RefreshCredential {
        val rawToken = generateToken()
        repository.save(newRecord(user.id, rawToken, familyId, userAgent, ipAddress))
        return RefreshCredential(rawToken, user)
    }

    @Transactional
    fun rotate(rawToken: String?, userAgent: String?, ipAddress: String?): RefreshRotationResult {
        if (rawToken.isNullOrBlank()) return RefreshRotationResult.Invalid
        val current = repository.findByTokenHash(hash(rawToken)) ?: return RefreshRotationResult.Invalid
        val now = Instant.now()
        if (current.revokedAt != null) {
            repository.revokeFamily(current.familyId, now)
            return RefreshRotationResult.Reused
        }
        if (!current.expiresAt.isAfter(now)) {
            current.revokedAt = now
            repository.save(current)
            return RefreshRotationResult.Invalid
        }
        val user = userRepository.findById(current.userId).orElse(null)
        if (user == null || !user.enabled) {
            repository.revokeFamily(current.familyId, now)
            return RefreshRotationResult.Invalid
        }

        val replacementRaw = generateToken()
        val replacement = repository.save(newRecord(user.id, replacementRaw, current.familyId, userAgent, ipAddress))
        current.revokedAt = now
        current.replacedByTokenId = replacement.id
        repository.save(current)
        return RefreshRotationResult.Success(RefreshCredential(replacementRaw, user))
    }

    @Transactional
    fun logout(rawToken: String?) {
        if (rawToken.isNullOrBlank()) return
        repository.findByTokenHash(hash(rawToken))?.let {
            if (it.revokedAt == null) {
                it.revokedAt = Instant.now()
                repository.save(it)
            }
        }
    }

    @Transactional
    fun logoutAll(userId: UUID) {
        repository.revokeAllForUser(userId, Instant.now())
    }

    private fun newRecord(userId: UUID, rawToken: String, familyId: UUID, userAgent: String?, ipAddress: String?) = RefreshToken(
        userId = userId,
        tokenHash = hash(rawToken),
        familyId = familyId,
        expiresAt = Instant.now().plus(properties.refreshTokenTtl),
        userAgent = userAgent?.take(500),
        ipAddress = ipAddress?.take(64),
    )

    private fun generateToken(): String {
        val bytes = ByteArray(48)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun hash(rawToken: String): String = MessageDigest.getInstance("SHA-256")
        .digest(rawToken.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
