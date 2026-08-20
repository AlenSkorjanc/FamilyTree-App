package com.familytree.repository

import com.familytree.domain.FamilyTree
import com.familytree.domain.ParentChildRelationship
import com.familytree.domain.Partnership
import com.familytree.domain.Person
import com.familytree.domain.AppUser
import com.familytree.domain.IdentityProvider
import com.familytree.domain.RefreshToken
import com.familytree.domain.UserIdentity
import com.familytree.domain.FamilyTreeUserAccess
import com.familytree.domain.TreeVisibility
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface FamilyTreeRepository : JpaRepository<FamilyTree, UUID> {
    fun findByOwnerUserIdOrderByCreatedAt(ownerUserId: UUID): List<FamilyTree>
    fun findByIdAndOwnerUserId(id: UUID, ownerUserId: UUID): FamilyTree?
    fun findByGuestOwnerIdOrderByCreatedAt(guestOwnerId: UUID): List<FamilyTree>
    fun findByIdAndGuestOwnerId(id: UUID, guestOwnerId: UUID): FamilyTree?
    fun findByIdAndVisibility(id: UUID, visibility: TreeVisibility): FamilyTree?
    fun findByPublicShareIdAndVisibility(publicShareId: UUID, visibility: TreeVisibility): FamilyTree?
}

interface FamilyTreeUserAccessRepository : JpaRepository<FamilyTreeUserAccess, UUID> {
    fun findByTreeIdOrderByCreatedAt(treeId: UUID): List<FamilyTreeUserAccess>
    fun findByUserId(userId: UUID): List<FamilyTreeUserAccess>
    fun existsByTreeIdAndUserId(treeId: UUID, userId: UUID): Boolean
    fun deleteByTreeId(treeId: UUID)
}

interface AppUserRepository : JpaRepository<AppUser, UUID> {
    fun findByNormalizedEmail(normalizedEmail: String): AppUser?
    fun existsByNormalizedEmail(normalizedEmail: String): Boolean
}

interface UserIdentityRepository : JpaRepository<UserIdentity, UUID> {
    fun findByProviderAndProviderUserId(provider: IdentityProvider, providerUserId: String): UserIdentity?
}

interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    fun findByTokenHash(tokenHash: String): RefreshToken?

    @Modifying
    @Query("update RefreshToken r set r.revokedAt = :revokedAt where r.familyId = :familyId and r.revokedAt is null")
    fun revokeFamily(@Param("familyId") familyId: UUID, @Param("revokedAt") revokedAt: java.time.Instant): Int

    @Modifying
    @Query("update RefreshToken r set r.revokedAt = :revokedAt where r.userId = :userId and r.revokedAt is null")
    fun revokeAllForUser(@Param("userId") userId: UUID, @Param("revokedAt") revokedAt: java.time.Instant): Int
}

interface PersonRepository : JpaRepository<Person, UUID> {
    fun findByTreeIdOrderByFirstNameAscLastNameAsc(treeId: UUID): List<Person>
    fun findByIdAndTreeId(id: UUID, treeId: UUID): Person?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Person p where p.id = :id and p.treeId = :treeId")
    fun findByIdAndTreeIdForUpdate(@Param("id") id: UUID, @Param("treeId") treeId: UUID): Person?

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
    fun findByTreeIdAndPerson1IdAndPerson2Id(treeId: UUID, person1Id: UUID, person2Id: UUID): Partnership?
    fun existsByTreeIdAndPerson1IdAndPerson2Id(treeId: UUID, person1Id: UUID, person2Id: UUID): Boolean

    @Query("select p from Partnership p where p.treeId = :treeId and (p.person1Id = :personId or p.person2Id = :personId)")
    fun findForPerson(@Param("treeId") treeId: UUID, @Param("personId") personId: UUID): List<Partnership>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Partnership p where p.treeId = :treeId and (p.person1Id in :personIds or p.person2Id in :personIds)")
    fun findForPeopleForUpdate(@Param("treeId") treeId: UUID, @Param("personIds") personIds: Collection<UUID>): List<Partnership>

    @Modifying
    @Query("delete from Partnership p where p.treeId = :treeId and (p.person1Id = :personId or p.person2Id = :personId)")
    fun deleteForPerson(@Param("treeId") treeId: UUID, @Param("personId") personId: UUID)
}
