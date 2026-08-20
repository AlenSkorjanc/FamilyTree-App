package com.familytree.controller

import com.familytree.config.AuthProperties
import com.familytree.dto.AccessTokenResponse
import com.familytree.dto.AuthProvidersResponse
import com.familytree.dto.AuthUserResponse
import com.familytree.dto.AuthenticationResponse
import com.familytree.dto.LoginRequest
import com.familytree.dto.MessageResponse
import com.familytree.dto.RegisterRequest
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
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

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
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): ResponseEntity<AuthenticationResponse> = authenticate(authService.register(body), request, response)

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
