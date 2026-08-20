package com.familytree.config

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository

@Configuration
@ConditionalOnExpression(
    "T(org.springframework.util.StringUtils).hasText('\${app.auth.google.client-id:}') " +
        "&& T(org.springframework.util.StringUtils).hasText('\${app.auth.google.client-secret:}') " +
        "|| T(org.springframework.util.StringUtils).hasText('\${app.auth.facebook.client-id:}') " +
        "&& T(org.springframework.util.StringUtils).hasText('\${app.auth.facebook.client-secret:}')",
)
class OAuthClientConfig {
    @Bean
    fun clientRegistrationRepository(properties: AuthProperties): ClientRegistrationRepository {
        val registrations = buildList {
            if (properties.google.isConfigured()) add(google(properties))
            if (properties.facebook.isConfigured()) add(facebook(properties))
        }
        return InMemoryClientRegistrationRepository(registrations)
    }

    private fun google(properties: AuthProperties): ClientRegistration = CommonOAuth2Provider.GOOGLE
        .getBuilder("google")
        .clientId(requireNotNull(properties.google.clientId))
        .clientSecret(requireNotNull(properties.google.clientSecret))
        .scope("openid", "profile", "email")
        .build()

    private fun facebook(properties: AuthProperties): ClientRegistration = CommonOAuth2Provider.FACEBOOK
        .getBuilder("facebook")
        .clientId(requireNotNull(properties.facebook.clientId))
        .clientSecret(requireNotNull(properties.facebook.clientSecret))
        .scope("public_profile", "email")
        .build()
}
