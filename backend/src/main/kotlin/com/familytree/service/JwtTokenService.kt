package com.familytree.service

import com.familytree.config.AuthProperties
import com.familytree.domain.AppUser
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

data class IssuedAccessToken(val value: String, val expiresInSeconds: Long) {
    override fun toString(): String = "IssuedAccessToken(value=[REDACTED], expiresInSeconds=$expiresInSeconds)"
}

@Service
class JwtTokenService(
    private val encoder: JwtEncoder,
    private val properties: AuthProperties,
) {
    fun issue(user: AppUser): IssuedAccessToken {
        val now = Instant.now()
        val claims = JwtClaimsSet.builder()
            .issuer(properties.issuer)
            .audience(listOf(properties.audience))
            .issuedAt(now)
            .expiresAt(now.plus(properties.accessTokenTtl))
            .subject(user.id.toString())
            .id(UUID.randomUUID().toString())
            .claim("email", user.email)
            .build()
        val header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build()
        return IssuedAccessToken(
            encoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue,
            properties.accessTokenTtl.seconds,
        )
    }
}
