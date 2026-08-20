package com.familytree.security

import tools.jackson.databind.ObjectMapper
import com.familytree.config.CorsProperties
import com.familytree.dto.ApiError
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.MediaType
import org.springframework.web.filter.OncePerRequestFilter

class OriginValidationFilter(
    private val corsProperties: CorsProperties,
    private val objectMapper: ObjectMapper,
) : OncePerRequestFilter() {
    private val guardedAuthPaths = setOf("/api/auth/refresh", "/api/auth/logout")
    private val safeMethods = setOf("GET", "HEAD", "OPTIONS")

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        request.method in safeMethods || (request.requestURI !in guardedAuthPaths && !request.requestURI.startsWith("/api/trees"))

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val origin = request.getHeader("Origin")
        if (origin != null && origin !in corsProperties.allowedOrigins) {
            response.status = HttpServletResponse.SC_FORBIDDEN
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            objectMapper.writeValue(
                response.outputStream,
                ApiError(403, "INVALID_ORIGIN", "Request origin is not allowed", request.requestURI),
            )
            return
        }
        filterChain.doFilter(request, response)
    }
}
