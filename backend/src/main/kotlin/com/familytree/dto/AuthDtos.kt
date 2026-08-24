package com.familytree.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.util.UUID

data class RegisterRequest(
    @field:NotBlank @field:Email @field:Size(max = 320) val email: String = "",
    @field:NotBlank @field:Size(min = 8, max = 1024) val password: String = "",
    @field:NotBlank @field:Size(max = 120) val firstName: String = "",
    @field:NotBlank @field:Size(max = 120) val lastName: String = "",
) {
    override fun toString(): String = "RegisterRequest(email=$email, password=[REDACTED], firstName=$firstName, lastName=$lastName)"
}

data class LoginRequest(
    @field:NotBlank @field:Email @field:Size(max = 320) val email: String = "",
    @field:NotBlank @field:Size(max = 1024) val password: String = "",
) {
    override fun toString(): String = "LoginRequest(email=$email, password=[REDACTED])"
}

data class EmailRequest(@field:NotBlank @field:Email @field:Size(max = 320) val email: String = "")
data class TokenRequest(@field:NotBlank @field:Size(max = 500) val token: String = "") {
    override fun toString(): String = "TokenRequest(token=[REDACTED])"
}
data class RequestPasswordChangeRequest(@field:Size(max = 1024) val currentPassword: String? = null) {
    override fun toString(): String = "RequestPasswordChangeRequest(currentPassword=[REDACTED])"
}
data class CompletePasswordRequest(
    @field:NotBlank @field:Size(max = 500) val token: String = "",
    @field:NotBlank @field:Size(min = 8, max = 1024) val newPassword: String = "",
) {
    override fun toString(): String = "CompletePasswordRequest(token=[REDACTED], newPassword=[REDACTED])"
}

data class AuthUserResponse(
    val id: UUID,
    val email: String,
    val firstName: String?,
    val middleName: String?,
    val lastName: String?,
    val maidenName: String?,
    val gender: String?,
    val birthDate: LocalDate?,
    val deathDate: LocalDate?,
    val birthPlace: String?,
    val deathPlace: String?,
    val notes: String?,
    val displayName: String?,
    val photoUrl: String?,
    val hasPassword: Boolean,
    val emailVerified: Boolean,
)

data class UpdateProfileRequest(
    @field:NotBlank @field:Email @field:Size(max = 320) val email: String,
    @field:NotBlank @field:Size(max = 120) val firstName: String,
    @field:Size(max = 120) val middleName: String? = null,
    @field:Size(max = 120) val lastName: String? = null,
    @field:Size(max = 120) val maidenName: String? = null,
    @field:Size(max = 50) val gender: String? = null,
    val birthDate: LocalDate? = null,
    val deathDate: LocalDate? = null,
    @field:Size(max = 250) val birthPlace: String? = null,
    @field:Size(max = 250) val deathPlace: String? = null,
    val notes: String? = null,
    @field:Size(max = 2000) val photoUrl: String? = null,
)

data class AccessTokenResponse(
    val accessToken: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long,
) {
    override fun toString(): String = "AccessTokenResponse(accessToken=[REDACTED], tokenType=$tokenType, expiresIn=$expiresIn)"
}

data class AuthenticationResponse(
    val accessToken: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long,
    val user: AuthUserResponse,
) {
    override fun toString(): String = "AuthenticationResponse(accessToken=[REDACTED], tokenType=$tokenType, expiresIn=$expiresIn, user=$user)"
}

data class AuthProvidersResponse(
    val password: Boolean = true,
    val google: Boolean,
    val facebook: Boolean,
)

data class MessageResponse(val message: String)
