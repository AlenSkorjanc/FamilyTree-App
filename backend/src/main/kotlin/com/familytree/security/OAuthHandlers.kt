package com.familytree.security

import com.familytree.config.AuthProperties
import com.familytree.controller.AuthController
import com.familytree.domain.IdentityProvider
import com.familytree.exception.AccountLinkRequiredException
import com.familytree.service.OAuthIdentityService
import com.familytree.service.OAuthProfile
import com.familytree.service.RefreshTokenService
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.security.web.authentication.AuthenticationFailureHandler
import org.springframework.security.web.authentication.AuthenticationSuccessHandler
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder
import org.slf4j.LoggerFactory

@Component
class OAuthLoginSuccessHandler(
    private val identityService: OAuthIdentityService,
    private val refreshTokenService: RefreshTokenService,
    private val properties: AuthProperties,
) : AuthenticationSuccessHandler {
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun onAuthenticationSuccess(request: HttpServletRequest, response: HttpServletResponse, authentication: Authentication) {
        try {
            val oauth = authentication as OAuth2AuthenticationToken
            val profile = profile(oauth.authorizedClientRegistrationId, oauth.principal)
            val user = identityService.resolve(profile)
            val refresh = refreshTokenService.create(user, request.getHeader("User-Agent"), request.remoteAddr)
            response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie(refresh.rawToken).toString())
            clearTemporarySession(request)
            response.sendRedirect("${properties.frontendUrl.trimEnd('/')}/auth/callback")
        } catch (_: AccountLinkRequiredException) {
            logger.info("OAuth login requires explicit account linking")
            clearTemporarySession(request)
            response.sendRedirect(loginErrorUrl("account_link_required"))
        } catch (exception: Exception) {
            logger.warn("OAuth login failed while resolving the local account: {}", exception.javaClass.simpleName)
            clearTemporarySession(request)
            response.sendRedirect(loginErrorUrl("true"))
        }
    }

    private fun profile(registrationId: String, principal: OAuth2User): OAuthProfile {
        val provider = when (registrationId) {
            "google" -> IdentityProvider.GOOGLE
            "facebook" -> IdentityProvider.FACEBOOK
            else -> throw IllegalArgumentException("Unsupported identity provider")
        }
        val idAttribute = if (provider == IdentityProvider.GOOGLE) "sub" else "id"
        val providerUserId = principal.getAttribute<Any>(idAttribute)?.toString()
            ?: throw IllegalArgumentException("Provider identity is missing")
        return OAuthProfile(
            provider = provider,
            providerUserId = providerUserId,
            email = principal.getAttribute("email"),
            firstName = principal.getAttribute("given_name") ?: principal.getAttribute("first_name"),
            lastName = principal.getAttribute("family_name") ?: principal.getAttribute("last_name"),
            displayName = principal.getAttribute("name"),
            profilePictureUrl = principal.getAttribute("picture"),
        )
    }

    private fun refreshCookie(value: String): ResponseCookie = ResponseCookie.from(AuthController.REFRESH_COOKIE, value)
        .httpOnly(true)
        .secure(properties.refreshCookieSecure)
        .sameSite("Lax")
        .path("/api/auth")
        .maxAge(properties.refreshTokenTtl)
        .build()

    private fun loginErrorUrl(error: String): String = UriComponentsBuilder
        .fromUriString("${properties.frontendUrl.trimEnd('/')}/login")
        .queryParam("oauthError", error)
        .build()
        .toUriString()

    private fun clearTemporarySession(request: HttpServletRequest) {
        request.getSession(false)?.invalidate()
        SecurityContextHolder.clearContext()
    }
}

@Component
class OAuthLoginFailureHandler(private val properties: AuthProperties) : AuthenticationFailureHandler {
    private val logger = LoggerFactory.getLogger(javaClass)

    override fun onAuthenticationFailure(request: HttpServletRequest, response: HttpServletResponse, exception: org.springframework.security.core.AuthenticationException) {
        logger.warn("OAuth authorization failed: {}", exception.javaClass.simpleName)
        request.getSession(false)?.invalidate()
        SecurityContextHolder.clearContext()
        response.sendRedirect("${properties.frontendUrl.trimEnd('/')}/login?oauthError=true")
    }
}
