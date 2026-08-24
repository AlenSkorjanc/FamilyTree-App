package com.familytree.security

import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Component
import org.springframework.web.context.annotation.RequestScope
import java.util.UUID

@Component
@RequestScope
class PublicShareRequest(private val request: HttpServletRequest) {
    fun idOrNull(): UUID? = request.getHeader(HEADER_NAME)?.let { value ->
        runCatching { UUID.fromString(value) }.getOrNull()
    }

    companion object {
        const val HEADER_NAME = "X-Public-Share-Id"
    }
}
