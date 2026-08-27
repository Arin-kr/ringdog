package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.OrderApi
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

private fun order(id: String) = OrderDto(
    id = id,
    userId = "u1",
    totalAmount = "19.99",
    couponCode = null,
    status = "PENDING",
    createdAt = "2026-01-01",
    items = emptyList(),
)

class OrderRepositoryTest {

    private val api = mockk<OrderApi>()
    private val repository = OrderRepository(api)

    @Test
    fun `checkout returns the created order id`() = runTest {
        coEvery { api.checkout(any()) } returns Response.success(CheckoutResponse("o1", "PENDING", 19.99))

        val result = repository.checkout()

        assertTrue(result is ApiResult.Success)
        assertEquals("o1", (result as ApiResult.Success).data.orderId)
    }

    @Test
    fun `getOrders returns the order list`() = runTest {
        coEvery { api.getOrders() } returns Response.success(OrderListResponse(listOf(order("o1"))))

        val result = repository.getOrders()

        assertTrue(result is ApiResult.Success)
        assertEquals(1, (result as ApiResult.Success).data.items.size)
    }

    @Test
    fun `cancelOrder returns the updated order`() = runTest {
        coEvery { api.cancelOrder("o1") } returns Response.success(order("o1").copy(status = "CANCELLED"))

        val result = repository.cancelOrder("o1")

        assertTrue(result is ApiResult.Success)
        assertEquals("CANCELLED", (result as ApiResult.Success).data.status)
    }
}
