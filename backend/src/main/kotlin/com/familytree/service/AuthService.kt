package com.familytree.service

import com.familytree.domain.AppUser
import com.familytree.domain.AccountTokenType
import com.familytree.dto.LoginRequest
import com.familytree.dto.RegisterRequest
import com.familytree.dto.UpdateProfileRequest
import com.familytree.dto.CompletePasswordRequest
import com.familytree.dto.RequestPasswordChangeRequest
import com.familytree.exception.BusinessRuleException
import com.familytree.exception.AuthenticationFailedException
import com.familytree.exception.ConflictException
import com.familytree.repository.AppUserRepository
import com.familytree.repository.RefreshTokenRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Locale
import java.time.Instant
import java.util.UUID

@Service
class AuthService(
    private val userRepository: AppUserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val accountTokens: AccountTokenService,
    private val accountMail: AccountMailService,
    private val refreshTokens: RefreshTokenRepository,
) {
    private val dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString())

    @Transactional
    fun register(request: RegisterRequest): AppUser {
        val normalizedEmail = normalizeEmail(request.email)
        if (userRepository.existsByNormalizedEmail(normalizedEmail)) throw ConflictException("An account with this email already exists")
        val firstName = request.firstName.trim()
        val lastName = request.lastName.trim()
        val user = try {
            userRepository.saveAndFlush(
                AppUser(
                    email = request.email.trim(),
                    normalizedEmail = normalizedEmail,
                    passwordHash = passwordEncoder.encode(request.password),
                    emailVerified = false,
                    firstName = firstName,
                    lastName = lastName,
                    displayName = "$firstName $lastName",
                ),
            )
        } catch (_: DataIntegrityViolationException) {
            throw ConflictException("An account with this email already exists")
        }
        accountMail.sendEmailVerification(user.email, accountTokens.issue(user, AccountTokenType.EMAIL_VERIFICATION))
        return user
    }

    @Transactional(readOnly = true)
    fun login(request: LoginRequest): AppUser {
        val user = userRepository.findByNormalizedEmail(normalizeEmail(request.email))
        val hash = user?.passwordHash ?: dummyPasswordHash
        val passwordMatches = passwordEncoder.matches(request.password, hash)
        if (user == null || user.passwordHash == null || !user.enabled || !passwordMatches) {
            throw AuthenticationFailedException()
        }
        if (!user.emailVerified) throw AuthenticationFailedException("Verify your email address before signing in")
        return user
    }

    @Transactional(readOnly = true)
    fun requireUser(userId: UUID): AppUser = userRepository.findById(userId)
        .filter { it.enabled }
        .orElseThrow { AuthenticationFailedException("User account is unavailable") }

    @Transactional
    fun updateProfile(userId: UUID, request: UpdateProfileRequest): AppUser {
        if (request.birthDate != null && request.deathDate != null && request.deathDate.isBefore(request.birthDate)) {
            throw BusinessRuleException("Death date cannot be before birth date", "INVALID_PERSON_DATES")
        }
        val user = requireUser(userId)
        val normalizedEmail = normalizeEmail(request.email)
        if (normalizedEmail != user.normalizedEmail && userRepository.existsByNormalizedEmail(normalizedEmail)) {
            throw ConflictException("An account with this email already exists")
        }
        val emailChanged = normalizedEmail != user.normalizedEmail
        user.email = request.email.trim()
        user.normalizedEmail = normalizedEmail
        if (emailChanged) user.emailVerified = false
        user.firstName = request.firstName.trim()
        user.middleName = request.middleName.clean()
        user.lastName = request.lastName.clean()
        user.maidenName = request.maidenName.clean()
        user.gender = request.gender.clean()
        user.birthDate = request.birthDate
        user.deathDate = request.deathDate
        user.birthPlace = request.birthPlace.clean()
        user.deathPlace = request.deathPlace.clean()
        user.notes = request.notes.clean()
        user.profilePictureUrl = request.photoUrl.clean()
        user.displayName = listOfNotNull(user.firstName, user.lastName).joinToString(" ")
        user.updatedAt = Instant.now()
        val saved = try {
            userRepository.saveAndFlush(user)
        } catch (_: DataIntegrityViolationException) {
            throw ConflictException("An account with this email already exists")
        }
        if (emailChanged) accountMail.sendEmailVerification(saved.email, accountTokens.issue(saved, AccountTokenType.EMAIL_VERIFICATION))
        return saved
    }

    @Transactional
    fun verifyEmail(rawToken: String) {
        val user = accountTokens.consume(rawToken, setOf(AccountTokenType.EMAIL_VERIFICATION)).first
        user.emailVerified = true
        user.updatedAt = Instant.now()
        userRepository.save(user)
    }

    @Transactional
    fun resendVerification(email: String) {
        val user = userRepository.findByNormalizedEmail(normalizeEmail(email))?.takeIf { it.enabled && !it.emailVerified } ?: return
        accountMail.sendEmailVerification(user.email, accountTokens.issue(user, AccountTokenType.EMAIL_VERIFICATION))
    }

    @Transactional
    fun requestPasswordReset(email: String) {
        val user = userRepository.findByNormalizedEmail(normalizeEmail(email))?.takeIf { it.enabled && it.emailVerified } ?: return
        accountMail.sendPasswordLink(user.email, accountTokens.issue(user, AccountTokenType.PASSWORD_RESET), requestedChange = false)
    }

    @Transactional
    fun requestPasswordChange(userId: UUID, request: RequestPasswordChangeRequest) {
        val user = requireUser(userId)
        val existingHash = user.passwordHash
        if (existingHash != null && (request.currentPassword == null || !passwordEncoder.matches(request.currentPassword, existingHash))) {
            throw AuthenticationFailedException("Current password is incorrect")
        }
        accountMail.sendPasswordLink(user.email, accountTokens.issue(user, AccountTokenType.PASSWORD_CHANGE), requestedChange = true)
    }

    @Transactional
    fun completePassword(request: CompletePasswordRequest) {
        val user = accountTokens.consume(request.token, setOf(AccountTokenType.PASSWORD_RESET, AccountTokenType.PASSWORD_CHANGE)).first
        val existingHash = user.passwordHash
        if (existingHash != null && passwordEncoder.matches(request.newPassword, existingHash)) {
            throw BusinessRuleException("New password must be different from the current password")
        }
        user.passwordHash = passwordEncoder.encode(request.newPassword)
        user.updatedAt = Instant.now()
        userRepository.save(user)
        refreshTokens.revokeAllForUser(user.id, Instant.now())
    }

    @Transactional
    fun deleteProfile(userId: UUID) {
        userRepository.delete(requireUser(userId))
    }

    fun normalizeEmail(email: String): String = email.trim().lowercase(Locale.ROOT)

    private fun String?.clean(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
}
