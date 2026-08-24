package com.familytree.mapper

import com.familytree.domain.AppUser
import com.familytree.dto.AuthUserResponse

fun AppUser.toAuthResponse() = AuthUserResponse(
    id = id,
    email = email,
    firstName = firstName,
    middleName = middleName,
    lastName = lastName,
    maidenName = maidenName,
    gender = gender,
    birthDate = birthDate,
    deathDate = deathDate,
    birthPlace = birthPlace,
    deathPlace = deathPlace,
    notes = notes,
    displayName = displayName,
    photoUrl = profilePictureUrl,
    hasPassword = passwordHash != null,
    emailVerified = emailVerified,
)
