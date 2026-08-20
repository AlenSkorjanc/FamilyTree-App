package com.familytree.security

import com.familytree.exception.AuthenticationRequiredException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class AuthenticatedUser {
    fun idOrNull(): UUID? {
        val authentication = SecurityContextHolder.getContext().authentication
        val subject = (authentication as? JwtAuthenticationToken)?.token?.subject
            ?: return null
        return runCatching { UUID.fromString(subject) }.getOrNull()
    }

    fun id(): UUID = idOrNull() ?: throw AuthenticationRequiredException()
}
