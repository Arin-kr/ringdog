package com.ringdog.android.data.remote.dto

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DtoSerializationTest {

    private val gson = Gson()

    @Test
    fun `SignupResponse maps snake_case created_at`() {
        val json = """{"id":"u1","email":"a@b.com","role":"customer","created_at":"2026-01-01T00:00:00.000Z"}"""
        val result = gson.fromJson(json, SignupResponse::class.java)
        assertEquals("2026-01-01T00:00:00.000Z", result.createdAt)
    }

    @Test
    fun `LoginResponse maps snake_case expires_in`() {
        val json = """{"token":"jwt-abc","expires_in":"1h"}"""
        val result = gson.fromJson(json, LoginResponse::class.java)
        assertEquals("jwt-abc", result.token)
        assertEquals("1h", result.expiresIn)
    }

    @Test
    fun `ProductDto price is kept as a string to preserve Decimal precision`() {
        val json = """{"id":"p1","name":"Ring","description":"desc","price":"19.99","stock":5,"tags":["cute"],"imageUrl":null,"createdAt":"2026-01-01T00:00:00.000Z"}"""
        val result = gson.fromJson(json, ProductDto::class.java)
        assertEquals("19.99", result.price)
        assertNull(result.imageUrl)
    }

    @Test
    fun `AddCartItemRequest serializes to snake_case product_id`() {
        val json = gson.toJson(AddCartItemRequest(productId = "p1", quantity = 2))
        assertEquals(true, json.contains("\"product_id\":\"p1\""))
    }

    @Test
    fun `CartItemDto product is nullable because POST cart items does not include it`() {
        val json = """{"id":"c1","userId":"u1","productId":"p1","quantity":2,"createdAt":"2026-01-01T00:00:00.000Z"}"""
        val result = gson.fromJson(json, CartItemDto::class.java)
        assertNull(result.product)
    }

    @Test
    fun `CheckoutResponse maps snake_case order_id and numeric total_amount`() {
        val json = """{"order_id":"o1","status":"PENDING","total_amount":39.98}"""
        val result = gson.fromJson(json, CheckoutResponse::class.java)
        assertEquals("o1", result.orderId)
        assertEquals(39.98, result.totalAmount, 0.001)
    }

    @Test
    fun `OrderDto keeps totalAmount as a string like the GET endpoints return it`() {
        val json = """{"id":"o1","userId":"u1","totalAmount":"39.98","couponCode":null,"status":"PENDING","createdAt":"2026-01-01T00:00:00.000Z","items":[]}"""
        val result = gson.fromJson(json, OrderDto::class.java)
        assertEquals("39.98", result.totalAmount)
    }
}
