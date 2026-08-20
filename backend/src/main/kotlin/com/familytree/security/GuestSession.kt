package com.familytree.security

import com.familytree.config.AuthProperties
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import org.springframework.web.context.annotation.RequestScope
import java.time.Duration
import java.util.UUID

@Component
@RequestScope
class GuestSession(
    private val request: HttpServletRequest,
    private val properties: AuthProperties,
) {
    fun idOrNull(): UUID? = request.cookies
        ?.firstOrNull { it.name == COOKIE_NAME }
        ?.value
        ?.let { runCatching { UUID.fromString(it) }.getOrNull() }

    fun ensure(response: HttpServletResponse): UUID {
        val id = idOrNull() ?: UUID.randomUUID()
        if (idOrNull() == null) {
            response.addHeader(
                HttpHeaders.SET_COOKIE,
                ResponseCookie.from(COOKIE_NAME, id.toString())
                    .httpOnly(true)
                    .secure(properties.refreshCookieSecure)
                    .sameSite("Lax")
                    .path("/api")
                    .maxAge(Duration.ofDays(365))
                    .build()
                    .toString(),
            )
        }
        return id
    }

    companion object {
        const val COOKIE_NAME = "guest_session"
    }
}
