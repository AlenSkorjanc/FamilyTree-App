package com.familytree.exception

class NotFoundException(message: String) : RuntimeException(message)
class ConflictException(message: String) : RuntimeException(message)
class BusinessRuleException(message: String) : RuntimeException(message)
