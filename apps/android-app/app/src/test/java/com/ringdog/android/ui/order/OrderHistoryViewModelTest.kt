package com.ringdog.android.ui.order

import app.cash.turbine.test
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.datadog.android.rum.RumMonitor
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CheckoutResponse
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.remote.dto.OrderListResponse
import com.ringdog.android.data.repository.OrderRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test

private fun order(id: String) = OrderDto(id, "u1", "19.99", null, "PENDING", "2026-01-01", emptyList())

@OptIn(ExperimentalCoroutinesApi::class)
class OrderHistoryViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<OrderRepository>()

    @Before
    fun setUp() {
        mockkStatic(GlobalRumMonitor::class)
    }

    @After
    fun tearDown() {
        unmockkStatic(GlobalRumMonitor::class)
    }

    @Test
    fun `loads orders on init`() = runTest {
        coEvery { repository.getOrders() } returns ApiResult.Success(OrderListResponse(listOf(order("o1"))))

        val viewModel = OrderHistoryViewModel(repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals(1, awaitItem().orders.size)
        }
    }

    @Test
    fun `checkout on success reports a RUM action, records the order id, and reloads`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { repository.getOrders() } returnsMany listOf(
            ApiResult.Success(OrderListResponse(emptyList())),
            ApiResult.Success(OrderListResponse(listOf(order("o1")))),
        )
        coEvery { repository.checkout(null) } returns ApiResult.Success(CheckoutResponse("o1", "PENDING", 19.99))

        val viewModel = OrderHistoryViewModel(repository)
        viewModel.checkout()
        advanceUntilIdle()

        verify {
            rumMonitor.addAction(
                RumActionType.CUSTOM,
                "place_order",
                mapOf("order_id" to "o1", "total_amount" to 19.99),
            )
        }
        assertEquals("o1", viewModel.uiState.value.lastCheckoutOrderId)
        assertEquals(1, viewModel.uiState.value.orders.size)
    }

    @Test
    fun `checkout on failure surfaces an error and does not report a RUM action`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { repository.getOrders() } returns ApiResult.Success(OrderListResponse(emptyList()))
        coEvery { repository.checkout(null) } returns ApiResult.Error("Cart is empty")

        val viewModel = OrderHistoryViewModel(repository)
        viewModel.checkout()
        advanceUntilIdle()

        verify(exactly = 0) { rumMonitor.addAction(any(), any(), any()) }
        assertEquals("Cart is empty", viewModel.uiState.value.errorMessage)
    }
}
