package com.familytree.exception

class NotFoundException(message: String) : RuntimeException(message)
class ConflictException(message: String) : RuntimeException(message)
class BusinessRuleException(message: String) : RuntimeException(message)
class AuthenticationFailedException(message: String = "Invalid email or password") : RuntimeException(message)
class AuthenticationRequiredException(message: String = "Authentication is required") : RuntimeException(message)
class AccountLinkRequiredException(message: String) : RuntimeException(message)
