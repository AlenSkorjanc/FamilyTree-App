package com.familytree

import com.familytree.domain.PartnershipType
import com.familytree.dto.CreateTreeRequest
import com.familytree.dto.ParentChildRequest
import com.familytree.dto.PartnershipRequest
import com.familytree.dto.PersonRequest
import com.familytree.exception.BusinessRuleException
import com.familytree.exception.ConflictException
import com.familytree.exception.NotFoundException
import com.familytree.repository.FamilyTreeRepository
import com.familytree.service.GraphService
import com.familytree.service.PersonService
import com.familytree.service.RelationshipService
import com.familytree.service.TreeService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
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
    private val treeRepository: FamilyTreeRepository,
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
    fun clean() = treeRepository.deleteAll()

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
        relationships.createParentChild(tree.id, ParentChildRequest(one.id, two.id))
        relationships.createPartnership(tree.id, PartnershipRequest(one.id, two.id))

        people.delete(tree.id, one.id)

        val result = graph.get(tree.id)
        assertEquals(listOf(two.id), result.people.map { it.id })
        assertTrue(result.parentChildRelationships.isEmpty())
        assertTrue(result.partnerships.isEmpty())
    }
}
