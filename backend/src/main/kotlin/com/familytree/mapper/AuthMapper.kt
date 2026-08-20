package com.familytree.mapper

import com.familytree.domain.AppUser
import com.familytree.dto.AuthUserResponse

fun AppUser.toAuthResponse() = AuthUserResponse(
    id = id,
    email = email,
    firstName = firstName,
    lastName = lastName,
    displayName = displayName,
    profilePictureUrl = profilePictureUrl,
)
