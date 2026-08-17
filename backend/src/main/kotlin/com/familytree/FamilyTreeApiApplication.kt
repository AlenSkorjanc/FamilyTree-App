package com.familytree

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class FamilyTreeApiApplication

fun main(args: Array<String>) {
	runApplication<FamilyTreeApiApplication>(*args)
}
