package com.familytree

import com.familytree.domain.PartnershipType
import com.familytree.domain.RelationshipType
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
import java.time.LocalDate
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

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
        assertEquals("DUPLICATE_PARENT_CHILD_RELATIONSHIP", assertThrows<ConflictException> {
            relationships.createParentChild(tree.id, ParentChildRequest(parent.id, child.id))
        }.code)
        val changedType = relationships.createParentChild(tree.id, ParentChildRequest(parent.id, child.id, RelationshipType.ADOPTIVE))
        assertEquals(RelationshipType.ADOPTIVE, changedType.relationshipType)
        assertEquals(2, relationships.listParentChild(tree.id).size)
        assertEquals("SELF_PARENT_RELATIONSHIP", assertThrows<BusinessRuleException> {
            relationships.createParentChild(tree.id, ParentChildRequest(child.id, child.id))
        }.code)
        assertEquals("ANCESTRY_CYCLE", assertThrows<BusinessRuleException> {
            relationships.createParentChild(tree.id, ParentChildRequest(child.id, grandparent.id))
        }.code)
        assertEquals(2, relationships.listParentChild(tree.id).size)
    }

    @Test
    fun `each child has at most two parents including any biological adoptive combination`() {
        val cases = listOf(
            RelationshipType.BIOLOGICAL to RelationshipType.BIOLOGICAL,
            RelationshipType.ADOPTIVE to RelationshipType.ADOPTIVE,
            RelationshipType.BIOLOGICAL to RelationshipType.ADOPTIVE,
        )
        cases.forEachIndexed { index, (firstType, secondType) ->
            val tree = trees.create(CreateTreeRequest("Two parents case $index"))
            val firstParent = people.create(tree.id, PersonRequest("First parent"))
            val secondParent = people.create(tree.id, PersonRequest("Second parent"))
            val thirdParent = people.create(tree.id, PersonRequest("Third parent"))
            val child = people.create(tree.id, PersonRequest("Child"))

            val firstRelationship = relationships.createParentChild(
                tree.id, ParentChildRequest(firstParent.id, child.id, firstType),
            )
            relationships.createParentChild(tree.id, ParentChildRequest(secondParent.id, child.id, secondType))

            assertEquals("MAX_PARENTS_REACHED", assertThrows<BusinessRuleException> {
                relationships.createParentChild(tree.id, ParentChildRequest(thirdParent.id, child.id, RelationshipType.BIOLOGICAL))
            }.code)
            assertEquals("MAX_PARENTS_REACHED", assertThrows<BusinessRuleException> {
                relationships.createParentChild(tree.id, ParentChildRequest(thirdParent.id, child.id, RelationshipType.ADOPTIVE))
            }.code)
            assertEquals(2, relationships.listParentChild(tree.id).count { it.childId == child.id })
            assertEquals(2, graph.get(tree.id).parentChildRelationships.count { it.childId == child.id })

            val editedType = if (firstType == RelationshipType.BIOLOGICAL) RelationshipType.ADOPTIVE else RelationshipType.BIOLOGICAL
            val edited = relationships.createParentChild(
                tree.id, ParentChildRequest(firstParent.id, child.id, editedType),
            )
            assertEquals(firstRelationship.id, edited.id)
            assertEquals(editedType, edited.relationshipType)
            assertEquals(2, relationships.listParentChild(tree.id).count { it.childId == child.id })

            relationships.deleteParentChild(tree.id, firstRelationship.id)
            relationships.createParentChild(tree.id, ParentChildRequest(thirdParent.id, child.id))
            assertEquals(2, relationships.listParentChild(tree.id).count { it.childId == child.id })
        }
    }

    @Test
    fun `step and other parent relationship writes are explicitly rejected`() {
        val tree = trees.create(CreateTreeRequest("Supported parent types"))
        val parent = people.create(tree.id, PersonRequest("Parent"))
        val child = people.create(tree.id, PersonRequest("Child"))
        for (type in listOf(RelationshipType.STEP, RelationshipType.OTHER)) {
            assertEquals("UNSUPPORTED_PARENT_RELATIONSHIP_TYPE", assertThrows<BusinessRuleException> {
                relationships.createParentChild(tree.id, ParentChildRequest(parent.id, child.id, type))
            }.code)
        }
        assertTrue(relationships.listParentChild(tree.id).isEmpty())
    }

    @Test
    fun `copying shared children to a new partner is atomic when any child has two parents`() {
        val tree = trees.create(CreateTreeRequest("Atomic shared children"))
        val first = people.create(tree.id, PersonRequest("First"))
        val second = people.create(tree.id, PersonRequest("Second"))
        val newPartner = people.create(tree.id, PersonRequest("New partner"))
        val available = people.create(tree.id, PersonRequest("Available child"))
        val full = people.create(tree.id, PersonRequest("Full child"))
        relationships.createParentChild(tree.id, ParentChildRequest(first.id, available.id))
        relationships.createParentChild(tree.id, ParentChildRequest(first.id, full.id))
        relationships.createParentChild(tree.id, ParentChildRequest(second.id, full.id, RelationshipType.ADOPTIVE))

        assertEquals("MAX_PARENTS_REACHED", assertThrows<BusinessRuleException> {
            relationships.createPartnership(
                tree.id,
                PartnershipRequest(
                    first.id,
                    newPartner.id,
                    copyChildrenFromPersonId = first.id,
                    sharedChildIds = setOf(available.id, full.id),
                ),
            )
        }.code)
        assertTrue(relationships.listPartnerships(tree.id).isEmpty())
        assertEquals(0, relationships.listParentChild(tree.id).count { it.parentId == newPartner.id })
        assertEquals(1, relationships.listParentChild(tree.id).count { it.childId == available.id })
        assertEquals(2, relationships.listParentChild(tree.id).count { it.childId == full.id })
    }

    @Test
    fun `concurrent attempts for last parent slot allow exactly one relationship`() {
        val tree = trees.create(CreateTreeRequest("Concurrent last parent slot"))
        val initial = people.create(tree.id, PersonRequest("Existing parent"))
        val first = people.create(tree.id, PersonRequest("First candidate"))
        val second = people.create(tree.id, PersonRequest("Second candidate"))
        val child = people.create(tree.id, PersonRequest("Child"))
        relationships.createParentChild(tree.id, ParentChildRequest(initial.id, child.id))

        val authentication = SecurityContextHolder.getContext().authentication
        val ready = CountDownLatch(2)
        val start = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)
        fun mutation(parentId: java.util.UUID, type: RelationshipType) = Callable {
            SecurityContextHolder.getContext().authentication = authentication
            try {
                ready.countDown()
                start.await(5, TimeUnit.SECONDS)
                runCatching { relationships.createParentChild(tree.id, ParentChildRequest(parentId, child.id, type)) }
            } finally {
                SecurityContextHolder.clearContext()
            }
        }

        try {
            val results = listOf(
                executor.submit(mutation(first.id, RelationshipType.BIOLOGICAL)),
                executor.submit(mutation(second.id, RelationshipType.ADOPTIVE)),
            )
            assertTrue(ready.await(5, TimeUnit.SECONDS))
            start.countDown()
            val outcomes = results.map { it.get(15, TimeUnit.SECONDS) }
            assertEquals(1, outcomes.count { it.isSuccess })
            assertEquals("MAX_PARENTS_REACHED", (outcomes.single { it.isFailure }.exceptionOrNull() as BusinessRuleException).code)
            assertEquals(2, relationships.listParentChild(tree.id).count { it.childId == child.id })
        } finally {
            executor.shutdownNow()
        }
    }

    @Test
    fun `creates partnership and prevents equivalent duplicate`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val one = people.create(tree.id, PersonRequest("One"))
        val two = people.create(tree.id, PersonRequest("Two"))
        assertEquals("SELF_PARTNERSHIP", assertThrows<BusinessRuleException> {
            relationships.createPartnership(tree.id, PartnershipRequest(one.id, one.id))
        }.code)
        relationships.createPartnership(tree.id, PartnershipRequest(one.id, two.id, PartnershipType.MARRIAGE))
        assertEquals("DUPLICATE_PARTNERSHIP", assertThrows<ConflictException> {
            relationships.createPartnership(tree.id, PartnershipRequest(two.id, one.id, PartnershipType.MARRIAGE))
        }.code)
        relationships.createPartnership(tree.id, PartnershipRequest(two.id, one.id, PartnershipType.OTHER))
    }

    @Test
    fun `same people can have distinct historical partnership periods`() {
        val tree = trees.create(CreateTreeRequest("Historical partnerships"))
        val one = people.create(tree.id, PersonRequest("One"))
        val two = people.create(tree.id, PersonRequest("Two"))
        val first = PartnershipRequest(one.id, two.id, PartnershipType.MARRIAGE, LocalDate.parse("2000-01-01"), LocalDate.parse("2005-12-31"))
        val second = PartnershipRequest(one.id, two.id, PartnershipType.MARRIAGE, LocalDate.parse("2010-01-01"), LocalDate.parse("2018-12-31"))

        relationships.createPartnership(tree.id, first)
        relationships.createPartnership(tree.id, second)

        assertEquals(2, relationships.listPartnerships(tree.id, one.id).size)
        assertEquals("DUPLICATE_PARTNERSHIP", assertThrows<ConflictException> {
            relationships.createPartnership(tree.id, first)
        }.code)
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
    fun `partnership policy remains separate from ancestry integrity`() {
        val tree = trees.create(CreateTreeRequest("Test"))
        val one = people.create(tree.id, PersonRequest("One"))
        val two = people.create(tree.id, PersonRequest("Two"))
        relationships.createPartnership(tree.id, PartnershipRequest(one.id, two.id))
        relationships.createParentChild(tree.id, ParentChildRequest(one.id, two.id))
        assertEquals(1, relationships.listPartnerships(tree.id).size)
        assertEquals(1, relationships.listParentChild(tree.id).size)
    }

    @Test
    fun `relationships cannot cross trees`() {
        val firstTree = trees.create(CreateTreeRequest("One"))
        val secondTree = trees.create(CreateTreeRequest("Two"))
        val first = people.create(firstTree.id, PersonRequest("First"))
        val second = people.create(secondTree.id, PersonRequest("Second"))
        assertEquals("PERSON_NOT_IN_TREE", assertThrows<NotFoundException> {
            relationships.createParentChild(firstTree.id, ParentChildRequest(first.id, second.id))
        }.code)
        assertEquals("PERSON_NOT_IN_TREE", assertThrows<NotFoundException> {
            relationships.createPartnership(firstTree.id, PartnershipRequest(first.id, second.id))
        }.code)
    }

    @Test
    fun `arbitrary depth cycles are rejected while valid branches remain allowed`() {
        val tree = trees.create(CreateTreeRequest("DAG"))
        val peter = people.create(tree.id, PersonRequest("Peter"))
        val john = people.create(tree.id, PersonRequest("John"))
        val mark = people.create(tree.id, PersonRequest("Mark"))
        val david = people.create(tree.id, PersonRequest("David"))
        val fifth = people.create(tree.id, PersonRequest("Fifth"))
        val anna = people.create(tree.id, PersonRequest("Anna"))
        val sarah = people.create(tree.id, PersonRequest("Sarah"))
        val newPerson = people.create(tree.id, PersonRequest("New person"))

        relationships.createParentChild(tree.id, ParentChildRequest(peter.id, john.id))
        relationships.createParentChild(tree.id, ParentChildRequest(john.id, mark.id))
        relationships.createParentChild(tree.id, ParentChildRequest(mark.id, david.id))
        relationships.createParentChild(tree.id, ParentChildRequest(david.id, fifth.id))

        listOf(
            ParentChildRequest(peter.id, peter.id) to "SELF_PARENT_RELATIONSHIP",
            ParentChildRequest(david.id, peter.id) to "ANCESTRY_CYCLE",
            ParentChildRequest(mark.id, john.id) to "ANCESTRY_CYCLE",
            ParentChildRequest(john.id, peter.id) to "ANCESTRY_CYCLE",
            ParentChildRequest(fifth.id, peter.id) to "ANCESTRY_CYCLE",
            ParentChildRequest(david.id, john.id) to "ANCESTRY_CYCLE",
        ).forEach { (request, code) ->
            assertEquals(code, assertThrows<BusinessRuleException> {
                relationships.createParentChild(tree.id, request)
            }.code)
        }

        relationships.createParentChild(tree.id, ParentChildRequest(anna.id, john.id))
        relationships.createParentChild(tree.id, ParentChildRequest(sarah.id, mark.id))
        relationships.createParentChild(tree.id, ParentChildRequest(fifth.id, newPerson.id))
        assertEquals(7, relationships.listParentChild(tree.id).size)
    }

    @Test
    fun `person and relationship dates preserve biological consistency without restricting other parent types`() {
        val tree = trees.create(CreateTreeRequest("Dates"))
        assertEquals("INVALID_PERSON_DATES", assertThrows<BusinessRuleException> {
            people.create(tree.id, PersonRequest("Invalid", birthDate = LocalDate.parse("2000-01-01"), deathDate = LocalDate.parse("1999-12-31")))
        }.code)
        val youngParent = people.create(tree.id, PersonRequest("Young parent", birthDate = LocalDate.parse("2010-01-01")))
        val child = people.create(tree.id, PersonRequest("Child", birthDate = LocalDate.parse("2000-01-01")))

        assertEquals("INVALID_BIOLOGICAL_PARENT_DATES", assertThrows<BusinessRuleException> {
            relationships.createParentChild(tree.id, ParentChildRequest(youngParent.id, child.id))
        }.code)
        relationships.createParentChild(tree.id, ParentChildRequest(youngParent.id, child.id, RelationshipType.ADOPTIVE))

        val biologicalParent = people.create(tree.id, PersonRequest("Biological parent", birthDate = LocalDate.parse("1970-01-01")))
        relationships.createParentChild(tree.id, ParentChildRequest(biologicalParent.id, child.id))
        assertEquals("INVALID_BIOLOGICAL_PARENT_DATES", assertThrows<BusinessRuleException> {
            people.update(tree.id, biologicalParent.id, PersonRequest("Biological parent", birthDate = LocalDate.parse("2015-01-01")))
        }.code)

        assertEquals("INVALID_PARTNERSHIP_DATES", assertThrows<BusinessRuleException> {
            relationships.createPartnership(tree.id, PartnershipRequest(youngParent.id, biologicalParent.id, startDate = LocalDate.parse("2020-01-02"), endDate = LocalDate.parse("2020-01-01")))
        }.code)
        relationships.createPartnership(tree.id, PartnershipRequest(youngParent.id, biologicalParent.id, startDate = LocalDate.parse("2020-01-01"), endDate = LocalDate.parse("2020-01-01")))
    }

    @Test
    fun `concurrent reverse ancestry writes cannot create a cycle`() {
        val tree = trees.create(CreateTreeRequest("Concurrent DAG"))
        val first = people.create(tree.id, PersonRequest("First"))
        val second = people.create(tree.id, PersonRequest("Second"))
        val authentication = SecurityContextHolder.getContext().authentication
        val ready = CountDownLatch(2)
        val start = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)
        fun mutation(parentId: java.util.UUID, childId: java.util.UUID) = Callable {
            SecurityContextHolder.getContext().authentication = authentication
            try {
                ready.countDown()
                start.await(5, TimeUnit.SECONDS)
                runCatching { relationships.createParentChild(tree.id, ParentChildRequest(parentId, childId)) }
            } finally {
                SecurityContextHolder.clearContext()
            }
        }

        try {
            val results = listOf(
                executor.submit(mutation(first.id, second.id)),
                executor.submit(mutation(second.id, first.id)),
            )
            assertTrue(ready.await(5, TimeUnit.SECONDS))
            start.countDown()
            val outcomes = results.map { it.get(15, TimeUnit.SECONDS) }
            assertEquals(1, outcomes.count { it.isSuccess })
            assertEquals("ANCESTRY_CYCLE", (outcomes.single { it.isFailure }.exceptionOrNull() as BusinessRuleException).code)
            assertEquals(1, relationships.listParentChild(tree.id).size)
        } finally {
            executor.shutdownNow()
        }
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
