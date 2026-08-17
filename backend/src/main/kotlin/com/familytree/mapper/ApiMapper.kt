package com.familytree.mapper

import com.familytree.domain.FamilyTree
import com.familytree.domain.ParentChildRelationship
import com.familytree.domain.Partnership
import com.familytree.domain.Person
import com.familytree.dto.ParentChildResponse
import com.familytree.dto.PartnershipResponse
import com.familytree.dto.PersonResponse
import com.familytree.dto.TreeResponse

fun FamilyTree.toResponse() = TreeResponse(id, name, createdAt, updatedAt)
fun Person.toResponse() = PersonResponse(
    id, treeId, firstName, middleName, lastName, maidenName, gender, birthDate, deathDate,
    birthPlace, deathPlace, notes, photoUrl, createdAt, updatedAt,
)
fun ParentChildRelationship.toResponse() = ParentChildResponse(id, treeId, parentId, childId, relationshipType, createdAt)
fun Partnership.toResponse() = PartnershipResponse(id, treeId, person1Id, person2Id, partnershipType, startDate, endDate, createdAt)
