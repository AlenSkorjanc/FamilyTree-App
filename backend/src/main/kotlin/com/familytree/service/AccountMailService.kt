package com.familytree.service

import com.familytree.config.AccountMailProperties
import com.familytree.config.AuthProperties
import org.slf4j.LoggerFactory
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.stereotype.Service

@Service
class AccountMailService(
    private val mailSender: JavaMailSender,
    private val mailProperties: AccountMailProperties,
    private val authProperties: AuthProperties,
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    fun sendEmailVerification(email: String, token: String) = send(
        email,
        "Verify your Family Tree email",
        "Verify your email address by opening this link:\n\n${authProperties.frontendUrl}/verify-email?token=$token\n\nThis link expires in 24 hours.",
    )

    fun sendPasswordLink(email: String, token: String, requestedChange: Boolean) = send(
        email,
        if (requestedChange) "Confirm your Family Tree password change" else "Reset your Family Tree password",
        "Choose a new password by opening this link:\n\n${authProperties.frontendUrl}/reset-password?token=$token\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.",
    )

    private fun send(to: String, subject: String, body: String) {
        if (!mailProperties.enabled) {
            logger.warn("Account email delivery is disabled; no email was sent to {}", to)
            return
        }
        mailSender.send(SimpleMailMessage().apply {
            from = mailProperties.from
            setTo(to)
            this.subject = subject
            text = body
        })
    }
}
