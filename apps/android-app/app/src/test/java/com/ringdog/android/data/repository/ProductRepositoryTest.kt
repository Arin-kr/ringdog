package com.ringdog.android.data.repository

import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.api.ProductApi
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

private fun product(id: String) = ProductDto(
    id = id,
    name = "Ring $id",
    description = "desc",
    price = "19.99",
    stock = 5,
    tags = listOf("cute"),
    imageUrl = null,
    createdAt = "2026-01-01",
)

class ProductRepositoryTest {

    private val api = mockk<ProductApi>()
    private val repository = ProductRepository(api)

    @Test
    fun `getProducts returns the paginated list`() = runTest {
        coEvery { api.getProducts(1, 20) } returns Response.success(
            ProductListResponse(items = listOf(product("p1")), page = 1, limit = 20, total = 1),
        )

        val result = repository.getProducts(1, 20)

        assertTrue(result is ApiResult.Success)
        assertEquals(1, (result as ApiResult.Success).data.items.size)
    }

    @Test
    fun `getProduct returns a single product`() = runTest {
        coEvery { api.getProduct("p1") } returns Response.success(product("p1"))

        val result = repository.getProduct("p1")

        assertTrue(result is ApiResult.Success)
        assertEquals("p1", (result as ApiResult.Success).data.id)
    }
}
