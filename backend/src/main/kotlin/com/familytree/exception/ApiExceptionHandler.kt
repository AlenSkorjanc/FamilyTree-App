package com.familytree.exception

import com.familytree.dto.ApiError
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(NotFoundException::class)
    fun notFound(ex: NotFoundException, request: HttpServletRequest) = response(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.message, request)

    @ExceptionHandler(ConflictException::class)
    fun conflict(ex: ConflictException, request: HttpServletRequest) = response(HttpStatus.CONFLICT, "CONFLICT", ex.message, request)

    @ExceptionHandler(BusinessRuleException::class)
    fun invalid(ex: BusinessRuleException, request: HttpServletRequest) = response(HttpStatus.UNPROCESSABLE_ENTITY, "BUSINESS_RULE", ex.message, request)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validation(ex: MethodArgumentNotValidException, request: HttpServletRequest): ResponseEntity<ApiError> {
        val fields = ex.bindingResult.fieldErrors.associate { it.field to (it.defaultMessage ?: "Invalid value") }
        return ResponseEntity.badRequest().body(ApiError(400, "VALIDATION_ERROR", "Request validation failed", request.requestURI, fieldErrors = fields))
    }

    private fun response(status: HttpStatus, code: String, message: String?, request: HttpServletRequest) =
        ResponseEntity.status(status).body(ApiError(status.value(), code, message ?: status.reasonPhrase, request.requestURI))
}
