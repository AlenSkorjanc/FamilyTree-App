package com.familytree

import com.familytree.config.AuthProperties
import com.familytree.domain.AppUser
import com.familytree.domain.IdentityProvider
import com.familytree.domain.RefreshToken
import com.familytree.exception.AccountLinkRequiredException
import com.familytree.dto.AccessTokenResponse
import com.familytree.dto.LoginRequest
import com.familytree.dto.CompletePasswordRequest
import com.familytree.domain.AccountTokenType
import com.familytree.repository.AppUserRepository
import com.familytree.repository.AccountActionTokenRepository
import com.familytree.repository.FamilyTreeRepository
import com.familytree.repository.RefreshTokenRepository
import com.familytree.repository.UserIdentityRepository
import com.familytree.service.OAuthIdentityService
import com.familytree.service.OAuthProfile
import com.familytree.service.AccountTokenService
import jakarta.servlet.http.Cookie
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
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
    private val accountActionTokens: AccountActionTokenRepository,
    private val identities: UserIdentityRepository,
    private val refreshTokens: RefreshTokenRepository,
    private val trees: FamilyTreeRepository,
    private val jwtEncoder: JwtEncoder,
    private val authProperties: AuthProperties,
    private val oauthIdentities: OAuthIdentityService,
    private val accountTokenService: AccountTokenService,
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
            registry.add("app.mail.enabled") { false }
        }
    }

    @AfterEach
    fun clean() {
        trees.deleteAll()
        refreshTokens.deleteAll()
        identities.deleteAll()
        accountActionTokens.deleteAll()
        users.deleteAll()
    }

    @Test
    fun `registration validates uniqueness and hashes the password`() {
        registerUnverified("person@example.com", "long-password")
            .andExpect(status().isAccepted)
            .andExpect(jsonPath("$.message").value("Check your email to verify your account"))

        val stored = users.findByNormalizedEmail("person@example.com")!!
        assertNotEquals("long-password", stored.passwordHash)
        assertTrue(stored.passwordHash!!.startsWith("\$argon2id\$"))
        assertFalse(stored.emailVerified)
        assertEquals(1, accountActionTokens.count())
        login("person@example.com", "long-password").andExpect(status().isUnauthorized)

        val verificationToken = accountTokenService.issue(stored, AccountTokenType.EMAIL_VERIFICATION)
        mockMvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON).content("""{"token":"$verificationToken"}"""))
            .andExpect(status().isOk)
        login("person@example.com", "long-password").andExpect(status().isOk)

        registerUnverified("PERSON@example.com", "another-password").andExpect(status().isConflict)
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
        assertTrue("new-secret-password" !in CompletePasswordRequest("raw-token", "new-secret-password").toString())
        assertTrue("raw-jwt-value" !in AccessTokenResponse("raw-jwt-value", expiresIn = 600).toString())
    }

    @Test
    fun `resource server accepts valid JWT and rejects missing expired or tampered JWT`() {
        val token = accessToken(register("jwt@example.com", "correct-password").andReturn())
        mockMvc.perform(get("/api/auth/me").bearer(token)).andExpect(status().isOk)
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/auth/me").bearer(expiredToken(users.findByNormalizedEmail("jwt@example.com")!!.id)))
            .andExpect(status().isUnauthorized)
        val tokenParts = token.split('.').toMutableList()
        tokenParts[2] = (if (tokenParts[2].first() == 'a') "b" else "a") + tokenParts[2].drop(1)
        val tampered = tokenParts.joinToString(".")
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
    fun `profile uses person fields and can be updated`() {
        val registration = register("profile@example.com", "correct-password").andReturn()
        val token = accessToken(registration)
        mockMvc.perform(
            patch("/api/auth/me").bearer(token).contentType(MediaType.APPLICATION_JSON).content(
                """{
                  "email":"updated@example.com","firstName":"Updated","middleName":"Middle","lastName":"Person",
                  "maidenName":"Original","gender":"FEMALE","birthDate":"1990-04-03","birthPlace":"Ljubljana",
                  "notes":"Profile notes","photoUrl":"/api/photos/00000000-0000-0000-0000-000000000000.png"
                }""",
            ),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.email").value("updated@example.com"))
            .andExpect(jsonPath("$.middleName").value("Middle"))
            .andExpect(jsonPath("$.maidenName").value("Original"))
            .andExpect(jsonPath("$.birthDate").value("1990-04-03"))
            .andExpect(jsonPath("$.photoUrl").isNotEmpty)

        val stored = users.findByNormalizedEmail("updated@example.com")!!
        assertEquals("Middle", stored.middleName)
        assertEquals("Ljubljana", stored.birthPlace)
        assertEquals("Updated Person", stored.displayName)
    }

    @Test
    fun `user can change password only after confirming the current password`() {
        val registration = register("change-password@example.com", "current-password").andReturn()
        val token = accessToken(registration)

        mockMvc.perform(
            post("/api/auth/me/password-change-request").bearer(token).contentType(MediaType.APPLICATION_JSON)
                .content("""{"currentPassword":"wrong-password"}"""),
        ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.message").value("Current password is incorrect"))

        mockMvc.perform(
            post("/api/auth/me/password-change-request").bearer(token).contentType(MediaType.APPLICATION_JSON)
                .content("""{"currentPassword":"current-password"}"""),
        ).andExpect(status().isOk)

        val rawToken = accountTokenService.issue(users.findByNormalizedEmail("change-password@example.com")!!, AccountTokenType.PASSWORD_CHANGE)
        mockMvc.perform(
            post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("""{"token":"$rawToken","newPassword":"replacement-password"}"""),
        ).andExpect(status().isOk)

        login("change-password@example.com", "current-password").andExpect(status().isUnauthorized)
        login("change-password@example.com", "replacement-password").andExpect(status().isOk)
    }

    @Test
    fun `forgot password response is generic and a valid email token resets the password`() {
        register("forgot@example.com", "current-password")
        mockMvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content("""{"email":"missing@example.com"}"""))
            .andExpect(status().isOk)
        mockMvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content("""{"email":"forgot@example.com"}"""))
            .andExpect(status().isOk)

        val rawToken = accountTokenService.issue(users.findByNormalizedEmail("forgot@example.com")!!, AccountTokenType.PASSWORD_RESET)
        mockMvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON).content("""{"token":"$rawToken","newPassword":"reset-password"}"""))
            .andExpect(status().isOk)
        mockMvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON).content("""{"token":"$rawToken","newPassword":"another-password"}"""))
            .andExpect(status().isUnauthorized)
        login("forgot@example.com", "current-password").andExpect(status().isUnauthorized)
        login("forgot@example.com", "reset-password").andExpect(status().isOk)
    }

    @Test
    fun `deleting a profile removes owned trees and refresh sessions`() {
        val registration = register("delete-profile@example.com", "correct-password").andReturn()
        val token = accessToken(registration)
        val refreshCookie = refreshCookie(registration)
        val treeResult = mockMvc.perform(
            post("/api/trees").bearer(token).contentType(MediaType.APPLICATION_JSON).content("""{"name":"Delete me"}"""),
        ).andExpect(status().isCreated).andReturn()
        val treeId = UUID.fromString(objectMapper.readTree(treeResult.response.contentAsString)["id"].asText())

        mockMvc.perform(delete("/api/auth/me").bearer(token))
            .andExpect(status().isNoContent)
            .andExpect(cookie().maxAge("refresh_token", 0))

        assertNull(users.findByNormalizedEmail("delete-profile@example.com"))
        assertFalse(trees.existsById(treeId))
        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie)).andExpect(status().isUnauthorized)
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
    fun `owner can combine public link and per-user view or edit access then revoke each independently`() {
        val ownerToken = accessToken(register("share-owner@example.com", "correct-password").andReturn())
        val viewerToken = accessToken(register("viewer@example.com", "correct-password").andReturn())
        val editorToken = accessToken(register("editor@example.com", "correct-password").andReturn())
        val created = mockMvc.perform(
            post("/api/trees").bearer(ownerToken).contentType(MediaType.APPLICATION_JSON).content("""{"name":"Shared family"}"""),
        ).andExpect(status().isCreated).andReturn()
        val treeId = objectMapper.readTree(created.response.contentAsString)["id"].asText()

        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(viewerToken)).andExpect(status().isNotFound)
        val published = mockMvc.perform(
            put("/api/trees/$treeId/sharing").bearer(ownerToken).contentType(MediaType.APPLICATION_JSON)
                .content("""{"publicPermission":"EDIT","members":[{"email":"viewer@example.com","permission":"VIEW"},{"email":"editor@example.com","permission":"EDIT"}]}"""),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.publicShareId").isNotEmpty)
            .andExpect(jsonPath("$.publicPermission").value("EDIT"))
            .andExpect(jsonPath("$.members.length()").value(2))
            .andReturn()
        val publicShareId = objectMapper.readTree(published.response.contentAsString)["publicShareId"].asText()

        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(viewerToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tree.access").value("VIEWER"))
        mockMvc.perform(post("/api/trees/$treeId/people").bearer(viewerToken).contentType(MediaType.APPLICATION_JSON).content("""{"firstName":"Blocked"}"""))
            .andExpect(status().isNotFound)

        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(editorToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tree.access").value("EDITOR"))
        mockMvc.perform(post("/api/trees/$treeId/people").bearer(editorToken).contentType(MediaType.APPLICATION_JSON).content("""{"firstName":"Editor person"}"""))
            .andExpect(status().isCreated)

        mockMvc.perform(get("/api/public/trees/$publicShareId/graph"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.tree.access").value("EDITOR"))
        mockMvc.perform(
            post("/api/trees/$treeId/people").header("X-Public-Share-Id", publicShareId)
                .contentType(MediaType.APPLICATION_JSON).content("""{"firstName":"Link editor"}"""),
        ).andExpect(status().isCreated)

        mockMvc.perform(
            delete("/api/trees/$treeId/sharing/public-link").bearer(ownerToken),
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.publicShareId").doesNotExist())
            .andExpect(jsonPath("$.members.length()").value(2))
        mockMvc.perform(get("/api/public/trees/$publicShareId/graph")).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(editorToken)).andExpect(status().isOk)

        mockMvc.perform(
            put("/api/trees/$treeId/sharing").bearer(ownerToken).contentType(MediaType.APPLICATION_JSON)
                .content("""{"publicPermission":null,"members":[]}"""),
        ).andExpect(status().isOk).andExpect(jsonPath("$.visibility").value("PRIVATE"))
        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(viewerToken)).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/trees/$treeId/graph").bearer(editorToken)).andExpect(status().isNotFound)
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

    private fun register(email: String, password: String): org.springframework.test.web.servlet.ResultActions {
        registerUnverified(email, password).andExpect(status().isAccepted)
        val user = users.findByNormalizedEmail(email.lowercase())!!
        user.emailVerified = true
        users.save(user)
        return login(email, password)
    }

    private fun registerUnverified(email: String, password: String) = mockMvc.perform(
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
