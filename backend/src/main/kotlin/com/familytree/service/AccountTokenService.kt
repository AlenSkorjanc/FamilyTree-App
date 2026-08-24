package com.familytree.service

import com.familytree.config.AccountMailProperties
import com.familytree.domain.AccountActionToken
import com.familytree.domain.AccountTokenType
import com.familytree.domain.AppUser
import com.familytree.exception.AuthenticationFailedException
import com.familytree.repository.AccountActionTokenRepository
import com.familytree.repository.AppUserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.Base64

@Service
class AccountTokenService(
    private val tokens: AccountActionTokenRepository,
    private val users: AppUserRepository,
    private val properties: AccountMailProperties,
) {
    private val secureRandom = SecureRandom()

    @Transactional
    fun issue(user: AppUser, type: AccountTokenType): String {
        tokens.deleteByUserIdAndTokenType(user.id, type)
        val raw = ByteArray(32).also(secureRandom::nextBytes).let(Base64.getUrlEncoder().withoutPadding()::encodeToString)
        val ttl = if (type == AccountTokenType.EMAIL_VERIFICATION) properties.verificationTokenTtl else properties.passwordTokenTtl
        tokens.save(AccountActionToken(userId = user.id, tokenType = type, tokenHash = hash(raw), expiresAt = Instant.now().plus(ttl)))
        return raw
    }

    @Transactional
    fun consume(rawToken: String, allowedTypes: Set<AccountTokenType>): Pair<AppUser, AccountTokenType> {
        val token = tokens.findByTokenHash(hash(rawToken))
            ?.takeIf { it.tokenType in allowedTypes && it.usedAt == null && it.expiresAt.isAfter(Instant.now()) }
            ?: throw AuthenticationFailedException("This verification link is invalid or has expired")
        token.usedAt = Instant.now()
        tokens.save(token)
        val user = users.findById(token.userId).filter { it.enabled }.orElseThrow {
            AuthenticationFailedException("User account is unavailable")
        }
        return user to token.tokenType
    }

    private fun hash(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
}
