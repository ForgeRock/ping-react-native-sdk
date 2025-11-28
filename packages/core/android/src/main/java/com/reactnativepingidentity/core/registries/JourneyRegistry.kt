package com.reactnativepingidentity.core.registries

import com.pingidentity.journey.*
import java.util.UUID

object JourneyRegistry {
    private val instances = mutableMapOf<String, Journey>()

    fun create(config: Journey): String {
        val id = java.util.UUID.randomUUID().toString()
        instances[id] = config
        return id
    }

    fun get(id: String): Journey? = instances[id]

    fun remove(id: String) {
        instances.remove(id)
    }

    fun listIds(): Set<String> = instances.keys
}
