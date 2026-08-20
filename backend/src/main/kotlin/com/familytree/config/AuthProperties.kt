package com.familytree.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties("app.auth")
data class AuthProperties(
    val jwtSecret: String,
    val issuer: String = "family-tree-api",
    val audience: String = "family-tree-web",
    val accessTokenTtl: Duration = Duration.ofMinutes(10),
    val refreshTokenTtl: Duration = Duration.ofDays(30),
    val refreshCookieSecure: Boolean = false,
    val frontendUrl: String = "http://localhost:5173",
    val google: OAuthProviderProperties = OAuthProviderProperties(),
    val facebook: OAuthProviderProperties = OAuthProviderProperties(),
)

data class OAuthProviderProperties(
    val clientId: String? = null,
    val clientSecret: String? = null,
) {
    fun isConfigured(): Boolean = !clientId.isNullOrBlank() && !clientSecret.isNullOrBlank()
}

@ConfigurationProperties("app.cors")
data class CorsProperties(
    val allowedOrigins: List<String> = listOf("http://localhost:5173"),
)
