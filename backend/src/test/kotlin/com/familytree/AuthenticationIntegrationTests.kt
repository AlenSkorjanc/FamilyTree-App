package com.familytree

import com.familytree.config.AuthProperties
import com.familytree.domain.AppUser
import com.familytree.domain.IdentityProvider
import com.familytree.domain.RefreshToken
import com.familytree.exception.AccountLinkRequiredException
import com.familytree.dto.AccessTokenResponse
import com.familytree.dto.LoginRequest
import com.familytree.repository.AppUserRepository
import com.familytree.repository.FamilyTreeRepository
import com.familytree.repository.RefreshTokenRepository
import com.familytree.repository.UserIdentityRepository
import com.familytree.service.OAuthIdentityService
import com.familytree.service.OAuthProfile
import jakarta.servlet.http.Cookie
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthenticationIntegrationTests @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
    private val users: AppUserRepository,
    private val identities: UserIdentityRepository,
    private val refreshTokens: RefreshTokenRepository,
    private val trees: FamilyTreeRepository,
    private val jwtEncoder: JwtEncoder,
    private val authProperties: AuthProperties,
    private val oauthIdentities: OAuthIdentityService,
) {
    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:17-alpine")

        @DynamicPropertySource
        @JvmStatic
        fun databaseProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
        }
    }

    @AfterEach
    fun clean() {
        trees.deleteAll()
        refreshTokens.deleteAll()
        identities.deleteAll()
        users.deleteAll()
    }

    @Test
    fun `registration validates uniqueness and hashes the password`() {
        val registered = register("person@example.com", "long-password")
        registered.andExpect(status().isOk)
            .andExpect(cookie().httpOnly("refresh_token", true))
            .andExpect(jsonPath("$.accessToken").isNotEmpty)
            .andExpect(jsonPath("$.expiresIn").value(600))
            .andExpect(jsonPath("$.user.email").value("person@example.com"))

        val stored = users.findByNormalizedEmail("person@example.com")!!
        assertNotEquals("long-password", stored.passwordHash)
        assertTrue(stored.passwordHash!!.startsWith("\$argon2id\$"))

        register("PERSON@example.com", "another-password").andExpect(status().isConflict)
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
    }

    @Test
    fun `login succeeds while all invalid credential cases stay generic`() {
        register("login@example.com", "correct-password")
        login("login@example.com", "correct-password").andExpect(status().isOk)
            .andExpect(jsonPath("$.user.email").value("login@example.com"))

        login("login@example.com", "wrong-password").andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.message").value("Invalid email or password"))
        login("missing@example.com", "wrong-password").andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.message").value("Invalid email or password"))

        val user = users.findByNormalizedEmail("login@example.com")!!
        user.enabled = false
        users.save(user)
        login("login@example.com", "correct-password").andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.message").value("Invalid email or password"))

        val longPassword = "a".repeat(80) + "first-ending"
        register("long@example.com", longPassword).andExpect(status().isOk)
        login("long@example.com", longPassword).andExpect(status().isOk)
        login("long@example.com", "a".repeat(80) + "other-ending").andExpect(status().isUnauthorized)
    }

    @Test
    fun `authentication values are redacted from diagnostic strings`() {
        assertTrue("top-secret-password" !in LoginRequest("person@example.com", "top-secret-password").toString())
        assertTrue("raw-jwt-value" !in AccessTokenResponse("raw-jwt-value", expiresIn = 600).toString())
    }

    @Test
    fun `resource server accepts valid JWT and rejects missing expired or tampered JWT`() {
        val token = accessToken(register("jwt@example.com", "correct-password").andReturn())
        mockMvc.perform(get("/api/auth/me").bearer(token)).andExpect(status().isOk)
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/auth/me").bearer(expiredToken(users.findByNormalizedEmail("jwt@example.com")!!.id)))
            .andExpect(status().isUnauthorized)
        val tampered = token.dropLast(1) + if (token.last() == 'a') "b" else "a"
        mockMvc.perform(get("/api/auth/me").bearer(tampered)).andExpect(status().isUnauthorized)
    }

    @Test
    fun `refresh rotates and reuse revokes the whole token family`() {
        val registration = register("rotate@example.com", "correct-password").andReturn()
        val original = refreshCookie(registration)
        val firstRefresh = mockMvc.perform(post("/api/auth/refresh").cookie(original))
            .andExpect(status().isOk)
            .andReturn()
        val replacement = refreshCookie(firstRefresh)
        assertNotEquals(original.value, replacement.value)
        assertEquals(2, refreshTokens.count())

        mockMvc.perform(post("/api/auth/refresh").cookie(original)).andExpect(status().isUnauthorized)
        mockMvc.perform(post("/api/auth/refresh").cookie(replacement)).andExpect(status().isUnauthorized)
        assertTrue(refreshTokens.findAll().all { it.revokedAt != null })
    }

    @Test
    fun `expired and revoked refresh tokens fail and logout clears the cookie`() {
        val user = users.save(AppUser(email = "expired@example.com", normalizedEmail = "expired@example.com"))
        val expiredRaw = "expired-opaque-token"
        refreshTokens.save(
            RefreshToken(userId = user.id, tokenHash = sha256(expiredRaw), expiresAt = Instant.now().minusSeconds(1)),
        )
        mockMvc.perform(post("/api/auth/refresh").cookie(Cookie("refresh_token", expiredRaw)))
            .andExpect(status().isUnauthorized)

        val registration = register("logout@example.com", "correct-password").andReturn()
        val cookieValue = refreshCookie(registration)
        mockMvc.perform(post("/api/auth/logout").cookie(cookieValue))
            .andExpect(status().isOk)
            .andExpect(cookie().maxAge("refresh_token", 0))
        mockMvc.perform(post("/api/auth/refresh").cookie(cookieValue)).andExpect(status().isUnauthorized)
    }

    @Test
    fun `logout all revokes every refresh session for the authenticated user`() {
        val first = register("devices@example.com", "correct-password").andReturn()
        val second = login("devices@example.com", "correct-password").andReturn()
        val accessToken = accessToken(second)
        val firstCookie = refreshCookie(first)
        val secondCookie = refreshCookie(second)

        mockMvc.perform(post("/api/auth/logout-all").bearer(accessToken)).andExpect(status().isOk)
        mockMvc.perform(post("/api/auth/refresh").cookie(firstCookie)).andExpect(status().isUnauthorized)
        mockMvc.perform(post("/api/auth/refresh").cookie(secondCookie)).andExpect(status().isUnauthorized)
    }

    @Test
    fun `another user receives not found for every operation on an owned tree`() {
        val userA = register("owner@example.com", "correct-password").andReturn()
        val tokenA = accessToken(userA)
        val treeResult = mockMvc.perform(
            post("/api/trees").bearer(tokenA).contentType(MediaType.APPLICATION_JSON).content("""{"name":"Private"}"""),
        ).andExpect(status().isCreated).andReturn()
        val treeId = objectMapper.readTree(treeResult.response.contentAsString)["id"].asText()
        val personResult = mockMvc.perform(
            post("/api/trees/$treeId/people").bearer(tokenA).contentType(MediaType.APPLICATION_JSON).content("""{"firstName":"Owner"}"""),
        ).andExpect(status().isCreated).andReturn()
        val personId = objectMapper.readTree(personResult.response.contentAsString)["id"].asText()

        val tokenB = accessToken(register("other@example.com", "correct-password").andReturn())
        mockMvc.perform(get("/api/trees/$treeId").bearer(tokenB)).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(tokenB)).andExpect(status().isNotFound)
        mockMvc.perform(patch("/api/trees/$treeId").bearer(tokenB).contentType(MediaType.APPLICATION_JSON).content("""{"name":"Stolen"}"""))
            .andExpect(status().isNotFound)
        mockMvc.perform(post("/api/trees/$treeId/people").bearer(tokenB).contentType(MediaType.APPLICATION_JSON).content("""{"firstName":"Intruder"}"""))
            .andExpect(status().isNotFound)
        mockMvc.perform(patch("/api/trees/$treeId/people/$personId").bearer(tokenB).contentType(MediaType.APPLICATION_JSON).content("""{"firstName":"Changed"}"""))
            .andExpect(status().isNotFound)
        mockMvc.perform(post("/api/trees/$treeId/parent-child-relationships").bearer(tokenB).contentType(MediaType.APPLICATION_JSON).content("""{"parentId":"$personId","childId":"${UUID.randomUUID()}"}"""))
            .andExpect(status().isNotFound)
        mockMvc.perform(delete("/api/trees/$treeId/people/$personId").bearer(tokenB)).andExpect(status().isNotFound)
        mockMvc.perform(
            patch("/api/trees/$treeId/people/$personId/current-partner").bearer(tokenB)
                .contentType(MediaType.APPLICATION_JSON).content("""{"partnerId":null}"""),
        ).andExpect(status().isNotFound)
        mockMvc.perform(delete("/api/trees/$treeId").bearer(tokenB)).andExpect(status().isNotFound)
    }

    @Test
    fun `guest tree stays in the database and can only be claimed by its guest session`() {
        val created = mockMvc.perform(
            post("/api/trees").contentType(MediaType.APPLICATION_JSON).content("""{"name":"Guest family"}"""),
        ).andExpect(status().isCreated)
            .andExpect(cookie().httpOnly("guest_session", true))
            .andExpect(cookie().path("guest_session", "/api"))
            .andExpect(jsonPath("$.access").value("GUEST_OWNER"))
            .andReturn()
        val treeId = objectMapper.readTree(created.response.contentAsString)["id"].asText()
        val guestCookie = requireNotNull(created.response.getCookie("guest_session"))

        assertTrue(trees.findById(UUID.fromString(treeId)).isPresent)
        mockMvc.perform(get("/api/trees/$treeId")).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/trees/$treeId").cookie(guestCookie))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.name").value("Guest family"))

        val registration = register("guest-owner@example.com", "correct-password").andReturn()
        val token = accessToken(registration)
        val claimBody = """{"treeIds":["$treeId"]}"""
        mockMvc.perform(
            post("/api/trees/claim-preview").bearer(token).cookie(guestCookie)
                .contentType(MediaType.APPLICATION_JSON).content(claimBody),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$[0].id").value(treeId))

        mockMvc.perform(
            post("/api/trees/claim").bearer(token).cookie(guestCookie)
                .contentType(MediaType.APPLICATION_JSON).content(claimBody),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$[0].access").value("OWNER"))

        mockMvc.perform(get("/api/trees/$treeId").cookie(guestCookie)).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/trees/$treeId").bearer(token))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.access").value("OWNER"))
    }

    @Test
    fun `owner can grant view access publish a link and revoke both`() {
        val ownerToken = accessToken(register("share-owner@example.com", "correct-password").andReturn())
        val viewerToken = accessToken(register("viewer@example.com", "correct-password").andReturn())
        val created = mockMvc.perform(
            post("/api/trees").bearer(ownerToken).contentType(MediaType.APPLICATION_JSON).content("""{"name":"Shared family"}"""),
        ).andExpect(status().isCreated).andReturn()
        val treeId = objectMapper.readTree(created.response.contentAsString)["id"].asText()

        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(viewerToken)).andExpect(status().isNotFound)
        mockMvc.perform(
            put("/api/trees/$treeId/sharing").bearer(ownerToken).contentType(MediaType.APPLICATION_JSON)
                .content("""{"visibility":"RESTRICTED","sharedWithEmails":["viewer@example.com"]}"""),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.members[0].email").value("viewer@example.com"))

        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(viewerToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tree.access").value("VIEWER"))
        mockMvc.perform(
            patch("/api/trees/$treeId").bearer(viewerToken).contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":"Changed by viewer"}"""),
        ).andExpect(status().isNotFound)

        val published = mockMvc.perform(
            put("/api/trees/$treeId/sharing").bearer(ownerToken).contentType(MediaType.APPLICATION_JSON)
                .content("""{"visibility":"PUBLIC"}"""),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.publicShareId").isNotEmpty)
            .andReturn()
        val publicShareId = objectMapper.readTree(published.response.contentAsString)["publicShareId"].asText()
        mockMvc.perform(get("/api/public/trees/$publicShareId/graph"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tree.access").value("VIEWER"))
        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(viewerToken)).andExpect(status().isNotFound)

        mockMvc.perform(
            put("/api/trees/$treeId/sharing").bearer(ownerToken).contentType(MediaType.APPLICATION_JSON)
                .content("""{"visibility":"PRIVATE"}"""),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.publicShareId").doesNotExist())
        mockMvc.perform(get("/api/public/trees/$publicShareId/graph")).andExpect(status().isNotFound)
    }

    @Test
    fun `OAuth identity resolution is stable and never auto-links by email`() {
        val profile = OAuthProfile(IdentityProvider.GOOGLE, "google-123", "social@example.com", "Social", "User", "Social User", null)
        val created = oauthIdentities.resolve(profile)
        val existing = oauthIdentities.resolve(profile)
        assertEquals(created.id, existing.id)
        assertEquals(1, identities.count())

        users.save(AppUser(email = "password@example.com", normalizedEmail = "password@example.com", passwordHash = "encoded"))
        assertThrows<AccountLinkRequiredException> {
            oauthIdentities.resolve(profile.copy(providerUserId = "google-456", email = "PASSWORD@example.com"))
        }
        assertNull(identities.findByProviderAndProviderUserId(IdentityProvider.GOOGLE, "google-456"))
        assertNotNull(users.findByNormalizedEmail("password@example.com"))
    }

    private fun register(email: String, password: String) = mockMvc.perform(
        post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("""{"email":"$email","password":"$password","firstName":"Test","lastName":"User"}"""),
    )

    private fun login(email: String, password: String) = mockMvc.perform(
        post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("""{"email":"$email","password":"$password"}"""),
    )

    private fun accessToken(result: MvcResult): String = objectMapper.readTree(result.response.contentAsString)["accessToken"].asText()

    private fun refreshCookie(result: MvcResult): Cookie = requireNotNull(result.response.getCookie("refresh_token"))

    private fun expiredToken(userId: UUID): String {
        val claims = JwtClaimsSet.builder()
            .issuer(authProperties.issuer)
            .audience(listOf(authProperties.audience))
            .subject(userId.toString())
            .issuedAt(Instant.now().minusSeconds(3600))
            .expiresAt(Instant.now().minusSeconds(1800))
            .id(UUID.randomUUID().toString())
            .build()
        return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).tokenValue
    }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray())
        .joinToString("") { "%02x".format(it) }

    private fun org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder.bearer(token: String) =
        header("Authorization", "Bearer $token")
}
