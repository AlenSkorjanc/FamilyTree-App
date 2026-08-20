package com.familytree.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
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

data class AuthUserResponse(
    val id: UUID,
    val email: String,
    val firstName: String?,
    val lastName: String?,
    val displayName: String?,
    val profilePictureUrl: String?,
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
