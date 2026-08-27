package com.ringdog.android.ui.order

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.repository.OrderRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

private fun order(status: String) = OrderDto("o1", "u1", "19.99", null, status, "2026-01-01", emptyList())

@OptIn(ExperimentalCoroutinesApi::class)
class OrderDetailViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<OrderRepository>()

    @Test
    fun `loads the order on init`() = runTest {
        coEvery { repository.getOrder("o1") } returns ApiResult.Success(order("PENDING"))

        val viewModel = OrderDetailViewModel("o1", repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals("PENDING", awaitItem().order?.status)
        }
    }

    @Test
    fun `cancelOrder updates the order with the cancelled status`() = runTest {
        coEvery { repository.getOrder("o1") } returns ApiResult.Success(order("PENDING"))
        coEvery { repository.cancelOrder("o1") } returns ApiResult.Success(order("CANCELLED"))
        val viewModel = OrderDetailViewModel("o1", repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals("PENDING", awaitItem().order?.status)
            viewModel.cancelOrder()
            advanceUntilIdle()
            assertEquals("CANCELLED", awaitItem().order?.status)
        }
    }
}
