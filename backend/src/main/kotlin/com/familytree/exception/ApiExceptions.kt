package com.familytree.exception

class NotFoundException(message: String, val code: String = "NOT_FOUND") : RuntimeException(message)
class ConflictException(message: String, val code: String = "CONFLICT") : RuntimeException(message)
class BusinessRuleException(message: String, val code: String = "BUSINESS_RULE") : RuntimeException(message)
class AuthenticationFailedException(message: String = "Invalid email or password") : RuntimeException(message)
class AuthenticationRequiredException(message: String = "Authentication is required") : RuntimeException(message)
class AccountLinkRequiredException(message: String) : RuntimeException(message)
