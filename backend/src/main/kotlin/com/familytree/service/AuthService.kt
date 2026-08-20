package com.familytree.service

import com.familytree.domain.AppUser
import com.familytree.dto.LoginRequest
import com.familytree.dto.RegisterRequest
import com.familytree.exception.AuthenticationFailedException
import com.familytree.exception.ConflictException
import com.familytree.repository.AppUserRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Locale
import java.util.UUID

@Service
class AuthService(
    private val userRepository: AppUserRepository,
    private val passwordEncoder: PasswordEncoder,
) {
    private val dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString())

    @Transactional
    fun register(request: RegisterRequest): AppUser {
        val normalizedEmail = normalizeEmail(request.email)
        if (userRepository.existsByNormalizedEmail(normalizedEmail)) throw ConflictException("An account with this email already exists")
        val firstName = request.firstName.trim()
        val lastName = request.lastName.trim()
        return try {
            userRepository.saveAndFlush(
                AppUser(
                    email = request.email.trim(),
                    normalizedEmail = normalizedEmail,
                    passwordHash = passwordEncoder.encode(request.password),
                    firstName = firstName,
                    lastName = lastName,
                    displayName = "$firstName $lastName",
                ),
            )
        } catch (_: DataIntegrityViolationException) {
            throw ConflictException("An account with this email already exists")
        }
    }

    @Transactional(readOnly = true)
    fun login(request: LoginRequest): AppUser {
        val user = userRepository.findByNormalizedEmail(normalizeEmail(request.email))
        val hash = user?.passwordHash ?: dummyPasswordHash
        val passwordMatches = passwordEncoder.matches(request.password, hash)
        if (user == null || user.passwordHash == null || !user.enabled || !passwordMatches) {
            throw AuthenticationFailedException()
        }
        return user
    }

    @Transactional(readOnly = true)
    fun requireUser(userId: UUID): AppUser = userRepository.findById(userId)
        .filter { it.enabled }
        .orElseThrow { AuthenticationFailedException("User account is unavailable") }

    fun normalizeEmail(email: String): String = email.trim().lowercase(Locale.ROOT)
}
