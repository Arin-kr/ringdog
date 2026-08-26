package com.ringdog.android.ui.cart

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.CartListResponse
import com.ringdog.android.data.repository.CartRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CartViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<CartRepository>()
    private val item = CartItemDto(id = "c1", userId = "u1", productId = "p1", quantity = 1, createdAt = "2026-01-01")

    @Test
    fun `loads the cart on init`() = runTest {
        coEvery { repository.getCart() } returns ApiResult.Success(CartListResponse(listOf(item)))

        val viewModel = CartViewModel(repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals(listOf(item), awaitItem().items)
        }
    }

    @Test
    fun `removeFromCart reloads the cart on success`() = runTest {
        coEvery { repository.getCart() } returnsMany listOf(
            ApiResult.Success(CartListResponse(listOf(item))),
            ApiResult.Success(CartListResponse(emptyList())),
        )
        coEvery { repository.removeItem("c1") } returns ApiResult.Success(Unit)
        val viewModel = CartViewModel(repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals(1, awaitItem().items.size)
            viewModel.removeFromCart("c1")
            // Skip the isLoading state
            awaitItem()
            assertEquals(0, awaitItem().items.size)
        }
    }

    @Test
    fun `getCart failure surfaces an error message`() = runTest {
        coEvery { repository.getCart() } returns ApiResult.Error("Network error")

        val viewModel = CartViewModel(repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals("Network error", awaitItem().errorMessage)
        }
    }
}
