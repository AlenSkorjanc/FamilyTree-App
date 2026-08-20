package com.familytree.exception

import com.familytree.dto.ApiError
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(NotFoundException::class)
    fun notFound(ex: NotFoundException, request: HttpServletRequest) = response(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.message, request)

    @ExceptionHandler(ConflictException::class)
    fun conflict(ex: ConflictException, request: HttpServletRequest) = response(HttpStatus.CONFLICT, "CONFLICT", ex.message, request)

    @ExceptionHandler(BusinessRuleException::class)
    fun invalid(ex: BusinessRuleException, request: HttpServletRequest) = response(HttpStatus.UNPROCESSABLE_ENTITY, "BUSINESS_RULE", ex.message, request)

    @ExceptionHandler(AuthenticationFailedException::class, AuthenticationRequiredException::class)
    fun unauthorized(ex: RuntimeException, request: HttpServletRequest) = response(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", ex.message, request)

    @ExceptionHandler(AccountLinkRequiredException::class)
    fun accountLinkRequired(ex: AccountLinkRequiredException, request: HttpServletRequest) =
        response(HttpStatus.CONFLICT, "ACCOUNT_LINK_REQUIRED", ex.message, request)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validation(ex: MethodArgumentNotValidException, request: HttpServletRequest): ResponseEntity<ApiError> {
        val fields = ex.bindingResult.fieldErrors.associate { it.field to (it.defaultMessage ?: "Invalid value") }
        return ResponseEntity.badRequest().body(ApiError(400, "VALIDATION_ERROR", "Request validation failed", request.requestURI, fieldErrors = fields))
    }

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun uploadTooLarge(ex: MaxUploadSizeExceededException, request: HttpServletRequest) =
        response(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Photo must be no larger than 5 MB", request)

    private fun response(status: HttpStatus, code: String, message: String?, request: HttpServletRequest) =
        ResponseEntity.status(status).body(ApiError(status.value(), code, message ?: status.reasonPhrase, request.requestURI))
}
