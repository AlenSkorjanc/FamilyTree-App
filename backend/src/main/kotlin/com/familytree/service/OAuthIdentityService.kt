package com.familytree.service

import com.familytree.domain.AppUser
import com.familytree.domain.IdentityProvider
import com.familytree.domain.UserIdentity
import com.familytree.exception.AccountLinkRequiredException
import com.familytree.exception.AuthenticationFailedException
import com.familytree.repository.AppUserRepository
import com.familytree.repository.UserIdentityRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

data class OAuthProfile(
    val provider: IdentityProvider,
    val providerUserId: String,
    val email: String?,
    val firstName: String?,
    val lastName: String?,
    val displayName: String?,
    val profilePictureUrl: String?,
)

@Service
class OAuthIdentityService(
    private val identityRepository: UserIdentityRepository,
    private val userRepository: AppUserRepository,
    private val authService: AuthService,
) {
    @Transactional
    fun resolve(profile: OAuthProfile): AppUser {
        val existingIdentity = identityRepository.findByProviderAndProviderUserId(profile.provider, profile.providerUserId)
        if (existingIdentity != null) {
            return userRepository.findById(existingIdentity.userId)
                .filter { it.enabled }
                .orElseThrow { AuthenticationFailedException("User account is unavailable") }
        }

        val email = profile.email?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw AuthenticationFailedException("The provider did not return an email address")
        val normalizedEmail = authService.normalizeEmail(email)
        if (userRepository.existsByNormalizedEmail(normalizedEmail)) {
            throw AccountLinkRequiredException("Sign in to the existing account before linking this provider")
        }

        val user = userRepository.save(
            AppUser(
                email = email,
                normalizedEmail = normalizedEmail,
                firstName = profile.firstName?.trim()?.takeIf { it.isNotEmpty() },
                lastName = profile.lastName?.trim()?.takeIf { it.isNotEmpty() },
                displayName = profile.displayName?.trim()?.takeIf { it.isNotEmpty() },
                profilePictureUrl = profile.profilePictureUrl,
            ),
        )
        identityRepository.save(
            UserIdentity(
                userId = user.id,
                provider = profile.provider,
                providerUserId = profile.providerUserId,
                providerEmail = email,
            ),
        )
        return user
    }
}
