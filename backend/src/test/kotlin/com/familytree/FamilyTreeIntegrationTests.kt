package com.familytree

import com.familytree.domain.PartnershipType
import com.familytree.domain.AppUser
import com.familytree.dto.CreateTreeRequest
import com.familytree.dto.CurrentPartnerRequest
import com.familytree.dto.ParentChildRequest
import com.familytree.dto.PartnershipRequest
import com.familytree.dto.PersonRequest
import com.familytree.exception.BusinessRuleException
import com.familytree.exception.ConflictException
import com.familytree.exception.NotFoundException
import com.familytree.repository.FamilyTreeRepository
import com.familytree.repository.AppUserRepository
import com.familytree.service.GraphService
import com.familytree.service.PersonService
import com.familytree.service.PhotoStorageService
import com.familytree.service.RelationshipService
import com.familytree.service.TreeService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer

@SpringBootTest
@Testcontainers
class FamilyTreeIntegrationTests @Autowired constructor(
    private val trees: TreeService,
    private val people: PersonService,
    private val relationships: RelationshipService,
    private val graph: GraphService,
    private val photos: PhotoStorageService,
    private val treeRepository: FamilyTreeRepository,
    private val userRepository: AppUserRepository,
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
            registry.add("app.photo-storage.path") { "${System.getProperty("java.io.tmpdir")}/family-tree-test-photos" }
        }
    }

    private lateinit var currentUser: AppUser

    @BeforeEach
    fun authenticate() {
        currentUser = userRepository.save(
            AppUser(email = "tests@example.com", normalizedEmail = "tests@example.com"),
        )
        val jwt = Jwt.withTokenValue("integration-test")
            .header("alg", "none")
            .subject(currentUser.id.toString())
            .build()
        SecurityContextHolder.getContext().authentication = JwtAuthenticationToken(jwt)
    }

    @AfterEach
    fun clean() {
        treeRepository.deleteAll()
        userRepository.deleteAll()
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `creates and renames a tree`() {
        val tree = trees.create(CreateTreeRequest("The Smiths"))
        assertEquals("The Smiths", trees.get(tree.id).name)
        assertEquals("Smith family", trees.update(tree.id, com.familytree.dto.UpdateTreeRequest("Smith family")).name)
    }

    @Test
    fun `creates edits searches and deletes a person`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val anna = people.create(tree.id, PersonRequest(firstName = "Anna"))
        val edited = people.update(tree.id, anna.id, PersonRequest(firstName = "Anna", lastName = "Novak", birthPlace = "Ljubljana"))
        assertEquals("Novak", edited.lastName)
        assertEquals(listOf(anna.id), people.list(tree.id, "nov").map { it.id })
        people.delete(tree.id, anna.id)
        assertThrows<NotFoundException> { people.get(tree.id, anna.id) }
    }

    @Test
    fun `links existing people as parent and child and rejects duplicate self and cycle`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val grandparent = people.create(tree.id, PersonRequest("Grandparent"))
        val parent = people.create(tree.id, PersonRequest("Parent"))
        val child = people.create(tree.id, PersonRequest("Child"))

        relationships.createParentChild(tree.id, ParentChildRequest(grandparent.id, parent.id))
        relationships.createParentChild(tree.id, ParentChildRequest(parent.id, child.id))
        assertEquals(2, relationships.listParentChild(tree.id).size)
        assertThrows<ConflictException> { relationships.createParentChild(tree.id, ParentChildRequest(parent.id, child.id)) }
        assertThrows<BusinessRuleException> { relationships.createParentChild(tree.id, ParentChildRequest(child.id, child.id)) }
        assertThrows<BusinessRuleException> { relationships.createParentChild(tree.id, ParentChildRequest(child.id, grandparent.id)) }
        assertThrows<BusinessRuleException> { relationships.createPartnership(tree.id, PartnershipRequest(grandparent.id, child.id)) }
    }

    @Test
    fun `a child can have at most two parents`() {
        val tree = trees.create(CreateTreeRequest("Two parents"))
        val firstParent = people.create(tree.id, PersonRequest("First parent"))
        val secondParent = people.create(tree.id, PersonRequest("Second parent"))
        val thirdParent = people.create(tree.id, PersonRequest("Third parent"))
        val child = people.create(tree.id, PersonRequest("Child"))

        relationships.createParentChild(tree.id, ParentChildRequest(firstParent.id, child.id))
        val secondRelationship = relationships.createParentChild(tree.id, ParentChildRequest(secondParent.id, child.id))

        val error = assertThrows<BusinessRuleException> {
            relationships.createParentChild(tree.id, ParentChildRequest(thirdParent.id, child.id))
        }
        assertEquals("A child can have at most two parents", error.message)
        assertEquals(2, relationships.listParentChild(tree.id).count { it.childId == child.id })

        relationships.deleteParentChild(tree.id, secondRelationship.id)
        relationships.createParentChild(tree.id, ParentChildRequest(thirdParent.id, child.id))
        assertEquals(2, relationships.listParentChild(tree.id).count { it.childId == child.id })
    }

    @Test
    fun `creates partnership and prevents equivalent duplicate`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val one = people.create(tree.id, PersonRequest("One"))
        val two = people.create(tree.id, PersonRequest("Two"))
        relationships.createPartnership(tree.id, PartnershipRequest(one.id, two.id, PartnershipType.MARRIAGE))
        assertThrows<ConflictException> {
            relationships.createPartnership(tree.id, PartnershipRequest(two.id, one.id, PartnershipType.OTHER))
        }
    }

    @Test
    fun `partnerships have zero or one symmetric current relationship and can be cleared`() {
        val tree = trees.create(CreateTreeRequest("Current partners"))
        val person = people.create(tree.id, PersonRequest("Person"))
        val firstPartner = people.create(tree.id, PersonRequest("First"))
        val secondPartner = people.create(tree.id, PersonRequest("Second"))

        val former = relationships.createPartnership(tree.id, PartnershipRequest(person.id, firstPartner.id))
        assertFalse(former.isCurrent)
        assertTrue(relationships.listPartnerships(tree.id, person.id).none { it.isCurrent })

        relationships.setCurrentPartner(tree.id, person.id, CurrentPartnerRequest(firstPartner.id))
        assertTrue(relationships.listPartnerships(tree.id, person.id).single().isCurrent)
        assertTrue(relationships.listPartnerships(tree.id, firstPartner.id).single().isCurrent)

        relationships.createPartnership(tree.id, PartnershipRequest(person.id, secondPartner.id, isCurrent = true))
        val afterChange = relationships.listPartnerships(tree.id, person.id)
        assertEquals(1, afterChange.count { it.isCurrent })
        assertEquals(secondPartner.id, afterChange.single { it.isCurrent }.let { if (it.person1Id == person.id) it.person2Id else it.person1Id })
        assertFalse(relationships.listPartnerships(tree.id, firstPartner.id).single().isCurrent)

        relationships.setCurrentPartner(tree.id, person.id, CurrentPartnerRequest(null))
        assertTrue(relationships.listPartnerships(tree.id, person.id).none { it.isCurrent })
        assertFalse(relationships.listPartnerships(tree.id, secondPartner.id).single().isCurrent)
    }

    @Test
    fun `current partner must be an existing partnership in the same tree`() {
        val firstTree = trees.create(CreateTreeRequest("One"))
        val secondTree = trees.create(CreateTreeRequest("Two"))
        val person = people.create(firstTree.id, PersonRequest("Person"))
        val unrelated = people.create(firstTree.id, PersonRequest("Unrelated"))
        val otherTreePerson = people.create(secondTree.id, PersonRequest("Other tree"))

        assertThrows<BusinessRuleException> {
            relationships.setCurrentPartner(firstTree.id, person.id, CurrentPartnerRequest(unrelated.id))
        }
        assertThrows<NotFoundException> {
            relationships.setCurrentPartner(firstTree.id, person.id, CurrentPartnerRequest(otherTreePerson.id))
        }
    }

    @Test
    fun `creates a partner as parent of the same children in one operation`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val parent = people.create(tree.id, PersonRequest("Parent"))
        val partner = people.create(tree.id, PersonRequest("Partner"))
        val biologicalChild = people.create(tree.id, PersonRequest("Biological child"))
        val adoptedChild = people.create(tree.id, PersonRequest("Adopted child"))
        relationships.createParentChild(tree.id, ParentChildRequest(parent.id, biologicalChild.id))
        relationships.createParentChild(tree.id, ParentChildRequest(parent.id, adoptedChild.id, com.familytree.domain.RelationshipType.ADOPTIVE))

        relationships.createPartnership(
            tree.id,
            PartnershipRequest(parent.id, partner.id, copyChildrenFromPersonId = parent.id),
        )

        val partnerChildren = relationships.listParentChild(tree.id, partner.id).filter { it.parentId == partner.id }
        assertEquals(setOf(biologicalChild.id, adoptedChild.id), partnerChildren.map { it.childId }.toSet())
        assertEquals(
            setOf(com.familytree.domain.RelationshipType.BIOLOGICAL, com.familytree.domain.RelationshipType.ADOPTIVE),
            partnerChildren.map { it.relationshipType }.toSet(),
        )
    }

    @Test
    fun `creates a partner as parent of only selected children`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val parent = people.create(tree.id, PersonRequest("Parent"))
        val partner = people.create(tree.id, PersonRequest("Partner"))
        val selectedChild = people.create(tree.id, PersonRequest("Selected child"))
        val unselectedChild = people.create(tree.id, PersonRequest("Unselected child"))
        relationships.createParentChild(tree.id, ParentChildRequest(parent.id, selectedChild.id))
        relationships.createParentChild(tree.id, ParentChildRequest(parent.id, unselectedChild.id))

        relationships.createPartnership(
            tree.id,
            PartnershipRequest(
                parent.id,
                partner.id,
                copyChildrenFromPersonId = parent.id,
                sharedChildIds = setOf(selectedChild.id),
            ),
        )

        val partnerChildIds = relationships.listParentChild(tree.id, partner.id)
            .filter { it.parentId == partner.id }
            .map { it.childId }
        assertEquals(listOf(selectedChild.id), partnerChildIds)
    }

    @Test
    fun `partners cannot also become parent and child`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val one = people.create(tree.id, PersonRequest("One"))
        val two = people.create(tree.id, PersonRequest("Two"))
        relationships.createPartnership(tree.id, PartnershipRequest(one.id, two.id))
        assertThrows<BusinessRuleException> {
            relationships.createParentChild(tree.id, ParentChildRequest(one.id, two.id))
        }
    }

    @Test
    fun `parent and child cannot also become partners`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val parent = people.create(tree.id, PersonRequest("Parent"))
        val child = people.create(tree.id, PersonRequest("Child"))
        relationships.createParentChild(tree.id, ParentChildRequest(parent.id, child.id))
        assertThrows<BusinessRuleException> {
            relationships.createPartnership(tree.id, PartnershipRequest(parent.id, child.id))
        }
    }

    @Test
    fun `relationships cannot cross trees`() {
        val firstTree = trees.create(CreateTreeRequest("One"))
        val secondTree = trees.create(CreateTreeRequest("Two"))
        val first = people.create(firstTree.id, PersonRequest("First"))
        val second = people.create(secondTree.id, PersonRequest("Second"))
        assertThrows<NotFoundException> { relationships.createParentChild(firstTree.id, ParentChildRequest(first.id, second.id)) }
        assertThrows<NotFoundException> { relationships.createPartnership(firstTree.id, PartnershipRequest(first.id, second.id)) }
    }

    @Test
    fun `deleting a person removes relationships without deleting relatives`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val one = people.create(tree.id, PersonRequest("One"))
        val two = people.create(tree.id, PersonRequest("Two"))
        val three = people.create(tree.id, PersonRequest("Three"))
        relationships.createParentChild(tree.id, ParentChildRequest(one.id, two.id))
        relationships.createPartnership(tree.id, PartnershipRequest(one.id, three.id))

        people.delete(tree.id, one.id)

        val result = graph.get(tree.id)
        assertEquals(setOf(two.id, three.id), result.people.map { it.id }.toSet())
        assertTrue(result.parentChildRelationships.isEmpty())
        assertTrue(result.partnerships.isEmpty())
    }

    @Test
    fun `uploads and serves a validated profile image`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val pngHeader = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0)
        val uploaded = photos.store(tree.id, MockMultipartFile("file", "portrait.png", "image/png", pngHeader))
        val stored = photos.load(uploaded.photoUrl.substringAfterLast('/'))
        assertTrue(stored.resource.exists())
        assertEquals("image/png", stored.mediaType.toString())
        assertThrows<BusinessRuleException> {
            photos.store(tree.id, MockMultipartFile("file", "notes.txt", "text/plain", "not an image".toByteArray()))
        }
    }
}
