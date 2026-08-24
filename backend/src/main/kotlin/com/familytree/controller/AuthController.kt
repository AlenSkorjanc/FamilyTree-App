package com.familytree.controller

import com.familytree.config.AuthProperties
import com.familytree.dto.AccessTokenResponse
import com.familytree.dto.AuthProvidersResponse
import com.familytree.dto.AuthUserResponse
import com.familytree.dto.AuthenticationResponse
import com.familytree.dto.LoginRequest
import com.familytree.dto.MessageResponse
import com.familytree.dto.RegisterRequest
import com.familytree.dto.UpdateProfileRequest
import com.familytree.dto.CompletePasswordRequest
import com.familytree.dto.EmailRequest
import com.familytree.dto.RequestPasswordChangeRequest
import com.familytree.dto.TokenRequest
import com.familytree.exception.AuthenticationFailedException
import com.familytree.mapper.toAuthResponse
import com.familytree.security.AuthenticatedUser
import com.familytree.service.AuthService
import com.familytree.service.JwtTokenService
import com.familytree.service.RefreshRotationResult
import com.familytree.service.RefreshTokenService
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.http.HttpStatus

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val jwtTokenService: JwtTokenService,
    private val refreshTokenService: RefreshTokenService,
    private val authenticatedUser: AuthenticatedUser,
    private val properties: AuthProperties,
) {
    @PostMapping("/register")
    fun register(
        @Valid @RequestBody body: RegisterRequest,
    ): ResponseEntity<MessageResponse> {
        authService.register(body)
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(MessageResponse("Check your email to verify your account"))
    }

    @PostMapping("/login")
    fun login(
        @Valid @RequestBody body: LoginRequest,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<AuthenticationResponse> = authenticate(authService.login(body), request, response)

    @PostMapping("/refresh")
    fun refresh(
        @CookieValue(name = REFRESH_COOKIE, required = false) rawToken: String?,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): AccessTokenResponse {
        return when (val result = refreshTokenService.rotate(rawToken, request.getHeader("User-Agent"), request.remoteAddr)) {
            is RefreshRotationResult.Success -> {
                response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie(result.credential.rawToken).toString())
                val accessToken = jwtTokenService.issue(result.credential.user)
                AccessTokenResponse(accessToken.value, expiresIn = accessToken.expiresInSeconds)
            }
            RefreshRotationResult.Invalid, RefreshRotationResult.Reused -> {
                response.addHeader(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                throw AuthenticationFailedException("Refresh session is invalid or expired")
            }
        }
    }

    @PostMapping("/logout")
    fun logout(
        @CookieValue(name = REFRESH_COOKIE, required = false) rawToken: String?,
        response: HttpServletResponse,
    ): MessageResponse {
        refreshTokenService.logout(rawToken)
        response.addHeader(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
        return MessageResponse("Logged out")
    }

    @PostMapping("/logout-all")
    fun logoutAll(response: HttpServletResponse): MessageResponse {
        refreshTokenService.logoutAll(authenticatedUser.id())
        response.addHeader(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
        return MessageResponse("Logged out from all sessions")
    }

    @GetMapping("/me")
    fun me(): AuthUserResponse = authService.requireUser(authenticatedUser.id()).toAuthResponse()

    @PatchMapping("/me")
    fun updateProfile(@Valid @RequestBody body: UpdateProfileRequest): AuthUserResponse =
        authService.updateProfile(authenticatedUser.id(), body).toAuthResponse()

    @PostMapping("/verify-email")
    fun verifyEmail(@Valid @RequestBody body: TokenRequest): MessageResponse {
        authService.verifyEmail(body.token)
        return MessageResponse("Email verified")
    }

    @PostMapping("/verification/resend")
    fun resendVerification(@Valid @RequestBody body: EmailRequest): MessageResponse {
        authService.resendVerification(body.email)
        return MessageResponse("If the account requires verification, an email has been sent")
    }

    @PostMapping("/password/forgot")
    fun forgotPassword(@Valid @RequestBody body: EmailRequest): MessageResponse {
        authService.requestPasswordReset(body.email)
        return MessageResponse("If an account exists, a password reset email has been sent")
    }

    @PostMapping("/me/password-change-request")
    fun requestPasswordChange(@Valid @RequestBody body: RequestPasswordChangeRequest): MessageResponse {
        authService.requestPasswordChange(authenticatedUser.id(), body)
        return MessageResponse("Check your email to continue changing your password")
    }

    @PostMapping("/password/reset")
    fun resetPassword(@Valid @RequestBody body: CompletePasswordRequest): MessageResponse {
        authService.completePassword(body)
        return MessageResponse("Password changed")
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteProfile(response: HttpServletResponse) {
        authService.deleteProfile(authenticatedUser.id())
        response.addHeader(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
    }

    @GetMapping("/providers")
    fun providers() = AuthProvidersResponse(
        google = properties.google.isConfigured(),
        facebook = properties.facebook.isConfigured(),
    )

    private fun authenticate(
        user: com.familytree.domain.AppUser,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<AuthenticationResponse> {
        val refresh = refreshTokenService.create(user, request.getHeader("User-Agent"), request.remoteAddr)
        val access = jwtTokenService.issue(user)
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie(refresh.rawToken).toString())
        return ResponseEntity.ok(AuthenticationResponse(access.value, expiresIn = access.expiresInSeconds, user = user.toAuthResponse()))
    }

    private fun refreshCookie(value: String): ResponseCookie = ResponseCookie.from(REFRESH_COOKIE, value)
        .httpOnly(true)
        .secure(properties.refreshCookieSecure)
        .sameSite("Lax")
        .path("/api/auth")
        .maxAge(properties.refreshTokenTtl)
        .build()

    private fun clearRefreshCookie(): ResponseCookie = ResponseCookie.from(REFRESH_COOKIE, "")
        .httpOnly(true)
        .secure(properties.refreshCookieSecure)
        .sameSite("Lax")
        .path("/api/auth")
        .maxAge(0)
        .build()

    companion object {
        const val REFRESH_COOKIE = "refresh_token"
    }
}
