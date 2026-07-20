/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
/*
 * SDKS-5217 Option C-alt PoC — TEMPORARY, not for merge.
 *
 * Minimal HttpClient/HttpRequest/HttpResponse implementation backed by OkHttp
 * (already on the classpath via com.facebook.react:react-android), to test
 * whether injecting a non-Ktor httpClient avoids the runtime break found with
 * Option C's ktor-downgrade path, per the plan's Option C-alt checklist.
 * Shared in rn-core so every affected package's factory can inject it.
 */

package com.pingidentity.rncore.network

import com.pingidentity.network.HttpClient
import com.pingidentity.network.HttpRequest
import com.pingidentity.network.HttpResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request as OkRequest
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response as OkResponse
import java.util.concurrent.TimeUnit

fun okHttpClient(): HttpClient = OkHttpAdapter()

private class OkHttpAdapter : HttpClient {

    private val client = OkHttpClient.Builder()
        .followRedirects(false)
        .callTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun request(): HttpRequest = OkHttpRequest()

    override suspend fun request(request: HttpRequest): HttpResponse {
        require(request is OkHttpRequest)
        val okRequest = request.build()
        val call: Call = client.newCall(okRequest)
        val response = withContext(Dispatchers.IO) { call.execute() }
        return OkHttpResponse(request, response)
    }

    override suspend fun request(requestBuilder: HttpRequest.() -> Unit): HttpResponse {
        val request = OkHttpRequest().apply(requestBuilder)
        return request(request)
    }

    override fun close() {
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }
}

private class OkHttpRequest : HttpRequest {
    override var url: String = ""
    private var method = "GET"
    private var contentType = "application/json"
    private var body: String? = null
    private val headers = mutableMapOf<String, String>()
    private val params = mutableMapOf<String, String>()
    private val cookieValues = mutableListOf<String>()

    override fun parameter(name: String, value: String) {
        params[name] = value
    }

    override fun header(name: String, value: String) {
        headers[name] = value
    }

    override fun cookies(cookies: List<String>) {
        cookieValues.addAll(cookies)
    }

    override fun cookie(cookie: String) {
        cookieValues.add(cookie)
    }

    override fun post(body: JsonObject) {
        method = "POST"
        contentType = "application/json"
        this.body = body.toString()
    }

    override fun post(contentType: String, body: String) {
        method = "POST"
        this.contentType = contentType
        this.body = body
    }

    override fun form(formBuilder: MutableMap<String, String>.() -> Unit) {
        method = "POST"
        contentType = "application/x-www-form-urlencoded"
        val form = mutableMapOf<String, String>().apply(formBuilder)
        body = form.entries.joinToString("&") { "${it.key}=${it.value}" }
    }

    override fun delete(body: JsonObject) {
        method = "DELETE"
        this.body = body.toString()
    }

    override fun delete(contentType: String, body: String) {
        method = "DELETE"
        this.contentType = contentType
        this.body = body
    }

    override fun put(body: JsonObject) {
        method = "PUT"
        this.body = body.toString()
    }

    override fun put(contentType: String, body: String) {
        method = "PUT"
        this.contentType = contentType
        this.body = body
    }

    override fun method(): String = method

    override fun header(name: String): String? = headers[name]

    fun build(): OkRequest {
        val urlWithParams = if (params.isEmpty()) {
            url
        } else {
            val sep = if (url.contains("?")) "&" else "?"
            url + sep + params.entries.joinToString("&") { "${it.key}=${it.value}" }
        }
        val builder = OkRequest.Builder().url(urlWithParams)
        headers.forEach { (name, value) -> builder.header(name, value) }
        if (cookieValues.isNotEmpty()) {
            builder.header("Cookie", cookieValues.joinToString("; "))
        }
        val requestBody = body?.toRequestBody(contentType.toMediaType())
        when (method) {
            "POST" -> builder.post(requestBody ?: "".toRequestBody(contentType.toMediaType()))
            "PUT" -> builder.put(requestBody ?: "".toRequestBody(contentType.toMediaType()))
            "DELETE" -> if (requestBody != null) builder.delete(requestBody) else builder.delete()
            else -> builder.get()
        }
        return builder.build()
    }
}

private class OkHttpResponse(
    override val request: HttpRequest,
    private val response: OkResponse,
) : HttpResponse {
    override val status: Int = response.code

    override suspend fun body(): String = withContext(Dispatchers.IO) {
        response.body?.string() ?: ""
    }

    override fun cookies(): List<String> = response.headers("Set-Cookie")

    override fun header(name: String): String? = response.header(name)

    override fun headers(): Set<Map.Entry<String, List<String>>> =
        response.headers.toMultimap().entries
}
