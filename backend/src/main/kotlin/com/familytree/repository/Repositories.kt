package com.familytree.repository

import com.familytree.domain.FamilyTree
import com.familytree.domain.ParentChildRelationship
import com.familytree.domain.Partnership
import com.familytree.domain.Person
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface FamilyTreeRepository : JpaRepository<FamilyTree, UUID>

interface PersonRepository : JpaRepository<Person, UUID> {
    fun findByTreeIdOrderByFirstNameAscLastNameAsc(treeId: UUID): List<Person>
    fun findByIdAndTreeId(id: UUID, treeId: UUID): Person?

    @Query("""
        select p from Person p where p.treeId = :treeId and (
          lower(p.firstName) like lower(concat('%', :search, '%')) or
          lower(coalesce(p.middleName, '')) like lower(concat('%', :search, '%')) or
          lower(coalesce(p.lastName, '')) like lower(concat('%', :search, '%')) or
          lower(coalesce(p.maidenName, '')) like lower(concat('%', :search, '%'))
        ) order by p.firstName, p.lastName
    """)
    fun search(@Param("treeId") treeId: UUID, @Param("search") search: String): List<Person>
}

interface ParentChildRelationshipRepository : JpaRepository<ParentChildRelationship, UUID> {
    fun findByTreeId(treeId: UUID): List<ParentChildRelationship>
    fun findByIdAndTreeId(id: UUID, treeId: UUID): ParentChildRelationship?
    fun existsByTreeIdAndParentIdAndChildId(treeId: UUID, parentId: UUID, childId: UUID): Boolean

    @Query("select r from ParentChildRelationship r where r.treeId = :treeId and (r.parentId = :personId or r.childId = :personId)")
    fun findForPerson(@Param("treeId") treeId: UUID, @Param("personId") personId: UUID): List<ParentChildRelationship>

    @Query("select r.childId from ParentChildRelationship r where r.treeId = :treeId and r.parentId in :parentIds")
    fun findChildIds(@Param("treeId") treeId: UUID, @Param("parentIds") parentIds: Collection<UUID>): List<UUID>

    @Modifying
    @Query("delete from ParentChildRelationship r where r.treeId = :treeId and (r.parentId = :personId or r.childId = :personId)")
    fun deleteForPerson(@Param("treeId") treeId: UUID, @Param("personId") personId: UUID)
}

interface PartnershipRepository : JpaRepository<Partnership, UUID> {
    fun findByTreeId(treeId: UUID): List<Partnership>
    fun findByIdAndTreeId(id: UUID, treeId: UUID): Partnership?
    fun existsByTreeIdAndPerson1IdAndPerson2Id(treeId: UUID, person1Id: UUID, person2Id: UUID): Boolean

    @Query("select p from Partnership p where p.treeId = :treeId and (p.person1Id = :personId or p.person2Id = :personId)")
    fun findForPerson(@Param("treeId") treeId: UUID, @Param("personId") personId: UUID): List<Partnership>

    @Modifying
    @Query("delete from Partnership p where p.treeId = :treeId and (p.person1Id = :personId or p.person2Id = :personId)")
    fun deleteForPerson(@Param("treeId") treeId: UUID, @Param("personId") personId: UUID)
}
