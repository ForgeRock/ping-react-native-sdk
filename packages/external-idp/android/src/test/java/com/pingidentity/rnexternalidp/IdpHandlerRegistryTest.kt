/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import com.pingidentity.idp.IdpClient
import com.pingidentity.idp.IdpHandler
import com.pingidentity.idp.IdpResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for the custom IdP handler registry.
 */
class IdpHandlerRegistryTest {

    /**
     * Handler test double carrying only the identity used for registry assertions.
     */
    private class StubHandler(override var tokenType: String = "id_token") : IdpHandler {
        override suspend fun authorize(idpClient: IdpClient): IdpResult {
            return IdpResult("token", emptyMap())
        }
    }

    @Before
    fun setUp() {
        IdpHandlerRegistry.clear()
    }

    @After
    fun tearDown() {
        IdpHandlerRegistry.clear()
    }

    /**
     * Ensures a registered provider resolves to the same handler instance.
     */
    @Test
    fun registeredProviderResolvesToSameInstance() {
        val handler = StubHandler()

        IdpHandlerRegistry.register("line", handler)

        assertSame(handler, IdpHandlerRegistry.resolve("line"))
    }

    /**
     * Ensures an unregistered provider resolves to null so the authorize path keeps
     * using the native built-in resolution.
     */
    @Test
    fun unregisteredProviderResolvesToNull() {
        assertNull(IdpHandlerRegistry.resolve("twitter"))
    }

    /**
     * Ensures each reserved built-in token is rejected at registration time.
     */
    @Test
    fun reservedTokensAreRejected() {
        val tokens = listOf("apple", "siwa", "google", "facebook", "fb-limited")

        for (token in tokens) {
            assertThrows(IllegalArgumentException::class.java) {
                IdpHandlerRegistry.register(token, StubHandler())
            }
            assertNull(IdpHandlerRegistry.resolve(token))
        }
    }

    /**
     * Ensures reserved-token matching is case-insensitive.
     */
    @Test
    fun reservedTokensAreRejectedCaseInsensitively() {
        val variants = listOf("Apple", "SIWA", "Google", "FACEBOOK", "FB-Limited")

        for (variant in variants) {
            assertThrows(IllegalArgumentException::class.java) {
                IdpHandlerRegistry.register(variant, StubHandler())
            }
        }
    }

    /**
     * Ensures names containing a reserved token are rejected, mirroring how the native
     * built-ins route provider names via substring matching.
     */
    @Test
    fun namesContainingReservedTokensAreRejected() {
        val names = listOf("pineapple-sso", "my-google-button", "facebooker", "x-apple-y")

        for (name in names) {
            assertThrows(IllegalArgumentException::class.java) {
                IdpHandlerRegistry.register(name, StubHandler())
            }
            assertNull(IdpHandlerRegistry.resolve(name))
        }
    }

    /**
     * Ensures a blank provider name is rejected.
     */
    @Test
    fun blankProviderNameIsRejected() {
        for (name in listOf("", "   ")) {
            assertThrows(IllegalArgumentException::class.java) {
                IdpHandlerRegistry.register(name, StubHandler())
            }
        }
        assertNull(IdpHandlerRegistry.resolve("   "))
    }

    /**
     * Ensures registration and resolution normalize names to trimmed lowercase.
     */
    @Test
    fun namesAreNormalizedOnRegisterAndResolve() {
        val handler = StubHandler()

        IdpHandlerRegistry.register("  LINE  ", handler)

        assertSame(handler, IdpHandlerRegistry.resolve("line"))
        assertSame(handler, IdpHandlerRegistry.resolve(" LINE "))
        assertSame(handler, IdpHandlerRegistry.resolve("LiNe"))
    }

    /**
     * Ensures re-registering a custom name replaces the previous handler.
     */
    @Test
    fun reRegistrationReplacesPreviousHandler() {
        val first = StubHandler()
        val second = StubHandler()

        IdpHandlerRegistry.register("line", first)
        IdpHandlerRegistry.register("line", second)

        assertSame(second, IdpHandlerRegistry.resolve("line"))
    }

    /**
     * Ensures clear() removes all registrations.
     */
    @Test
    fun clearRemovesAllRegistrations() {
        IdpHandlerRegistry.register("line", StubHandler())
        IdpHandlerRegistry.register("wechat", StubHandler())

        IdpHandlerRegistry.clear()

        assertNull(IdpHandlerRegistry.resolve("line"))
        assertNull(IdpHandlerRegistry.resolve("wechat"))
    }

    /**
     * Ensures the registry survives a real module cleanup pass: `cleanup()` cancels and
     * recreates the shared coroutine scope and resets the configured flag, but the
     * process-scoped registry is exempt so app registrations survive dev reloads and
     * catalyst restarts. The precondition assertion makes sure the cleanup actually ran
     * instead of returning early as a no-op.
     */
    @Test
    fun registrySurvivesModuleCleanup() {
        val originalScope = readScope()
        val started = CompletableDeferred<Unit>()
        val scopeJob = originalScope.launch {
            started.complete(Unit)
            awaitCancellation()
        }
        runBlocking { started.await() }

        setConfigured(true)
        assertTrue(readConfigured())

        val handler = StubHandler()
        IdpHandlerRegistry.register("line", handler)

        RNPingExternalIdpCommon.cleanup()
        assertFalse(readConfigured())
        assertTrue(scopeJob.isCancelled)
        assertTrue(originalScope.coroutineContext[Job]?.isCancelled == true)

        assertSame(handler, IdpHandlerRegistry.resolve("line"))
    }

    /**
     * Reflectively reads the private shared coroutine scope.
     */
    private fun readScope(): CoroutineScope = CommonTestSeams.readScope()

    /**
     * Reflectively reads the private configured flag.
     */
    private fun readConfigured(): Boolean = CommonTestSeams.readConfigured()

    /**
     * Reflectively sets the private configured flag.
     */
    private fun setConfigured(value: Boolean) = CommonTestSeams.setConfigured(value)
}
