package com.familytree.config

import org.springframework.context.annotation.Configuration
import org.springframework.http.CacheControl
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.time.Duration

@Configuration
class StaticResourceConfig : WebMvcConfigurer {
    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        registry.addResourceHandler("/assets/**")
            .addResourceLocations("classpath:/static/assets/")
            .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
    }
}

@Controller
class SpaController {
    @GetMapping(
        "/",
        "/login",
        "/register",
        "/verify-email-sent",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/auth/callback",
        "/profile",
        "/trees",
        "/trees/{treeId}",
        "/shared/{shareId}",
    )
    fun frontend(): String = "forward:/index.html"
}
