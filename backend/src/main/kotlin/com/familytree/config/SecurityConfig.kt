package com.familytree.config

import tools.jackson.databind.ObjectMapper
import com.familytree.dto.ApiError
import com.familytree.security.OriginValidationFilter
import com.nimbusds.jose.jwk.source.ImmutableSecret
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.security.config.Customizer.withDefaults
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.csrf.CsrfFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import javax.crypto.spec.SecretKeySpec
import javax.crypto.SecretKey
import org.springframework.beans.factory.ObjectProvider
import com.familytree.security.OAuthLoginFailureHandler
import com.familytree.security.OAuthLoginSuccessHandler

@Configuration
@EnableConfigurationProperties(AuthProperties::class, CorsProperties::class)
class SecurityConfig {
    @Bean
    fun passwordEncoder(): PasswordEncoder = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8()

    @Bean
    fun jwtSecretKey(properties: AuthProperties): SecretKey {
        require(properties.jwtSecret.toByteArray().size >= 32) { "JWT_SECRET must contain at least 32 bytes" }
        return SecretKeySpec(properties.jwtSecret.toByteArray(), "HmacSHA256")
    }

    @Bean
    fun jwtEncoder(secretKey: SecretKey): JwtEncoder = NimbusJwtEncoder(ImmutableSecret(secretKey))

    @Bean
    fun jwtDecoder(secretKey: SecretKey, properties: AuthProperties): JwtDecoder {
        val decoder = NimbusJwtDecoder.withSecretKey(secretKey).macAlgorithm(MacAlgorithm.HS256).build()
        val issuerValidator = JwtValidators.createDefaultWithIssuer(properties.issuer)
        val audienceValidator = OAuth2TokenValidator<Jwt> { jwt ->
            if (jwt.audience?.contains(properties.audience) == true) OAuth2TokenValidatorResult.success()
            else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "Required audience is missing", null))
        }
        decoder.setJwtValidator(DelegatingOAuth2TokenValidator(issuerValidator, audienceValidator))
        return decoder
    }

    @Bean
    fun corsConfigurationSource(properties: CorsProperties): CorsConfigurationSource {
        val configuration = CorsConfiguration().apply {
            allowedOrigins = properties.allowedOrigins
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("Authorization", "Content-Type", "Accept")
            allowCredentials = true
            maxAge = 3600
        }
        return UrlBasedCorsConfigurationSource().also { it.registerCorsConfiguration("/api/**", configuration) }
    }

    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        corsProperties: CorsProperties,
        objectMapper: ObjectMapper,
        clientRegistrations: ObjectProvider<ClientRegistrationRepository>,
        oauthSuccessHandler: OAuthLoginSuccessHandler,
        oauthFailureHandler: OAuthLoginFailureHandler,
    ): SecurityFilterChain {
        http
            .cors(withDefaults())
            .csrf { it.ignoringRequestMatchers("/api/**") }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED) }
            .authorizeHttpRequests {
                it.requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/auth/providers", "/api/photos/**").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/trees/claim", "/api/trees/claim-preview").authenticated()
                    .requestMatchers("/api/trees/*/sharing", "/api/trees/*/sharing/**").authenticated()
                    .requestMatchers("/api/trees/**", "/api/public/trees/**").permitAll()
                    .requestMatchers("/oauth2/**", "/login/oauth2/**", "/error").permitAll()
                    .requestMatchers("/api/**").authenticated()
                    .anyRequest().permitAll()
            }
            .oauth2ResourceServer { it.jwt(withDefaults()) }
            .exceptionHandling {
                it.authenticationEntryPoint { request, response, _ ->
                    writeSecurityError(response, objectMapper, 401, "UNAUTHORIZED", "Authentication is required", request.requestURI)
                }
                it.accessDeniedHandler { request, response, _ ->
                    writeSecurityError(response, objectMapper, 403, "FORBIDDEN", "Access is denied", request.requestURI)
                }
            }
            .addFilterBefore(OriginValidationFilter(corsProperties, objectMapper), CsrfFilter::class.java)
        if (clientRegistrations.ifAvailable != null) {
            http.oauth2Login {
                it.successHandler(oauthSuccessHandler)
                it.failureHandler(oauthFailureHandler)
            }
        }
        return http.build()
    }

    private fun writeSecurityError(
        response: HttpServletResponse,
        objectMapper: ObjectMapper,
        status: Int,
        code: String,
        message: String,
        path: String,
    ) {
        response.status = status
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        objectMapper.writeValue(response.outputStream, ApiError(status, code, message, path))
    }
}
