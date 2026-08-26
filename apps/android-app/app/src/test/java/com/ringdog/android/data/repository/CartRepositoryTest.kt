package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.CartApi
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class CartRepositoryTest {

    private val api = mockk<CartApi>()
    private val repository = CartRepository(api)

    @Test
    fun `getCart returns the items from a successful response`() = runTest {
        val item = CartItemDto(id = "c1", userId = "u1", productId = "p1", quantity = 2, createdAt = "2026-01-01")
        coEvery { api.getCart() } returns Response.success(CartListResponse(listOf(item)))

        val result = repository.getCart()

        assertTrue(result is ApiResult.Success)
        assertEquals(1, (result as ApiResult.Success).data.items.size)
    }

    @Test
    fun `addItem forwards product id and quantity`() = runTest {
        val item = CartItemDto(id = "c1", userId = "u1", productId = "p1", quantity = 3, createdAt = "2026-01-01")
        coEvery { api.addItem(any()) } returns Response.success(item)

        val result = repository.addItem("p1", 3)

        assertTrue(result is ApiResult.Success)
        assertEquals(3, (result as ApiResult.Success).data.quantity)
    }

    @Test
    fun `removeItem returns Success on 204`() = runTest {
        coEvery { api.removeItem("c1") } returns Response.success(null)

        val result = repository.removeItem("c1")

        assertTrue(result is ApiResult.Success)
    }
}
