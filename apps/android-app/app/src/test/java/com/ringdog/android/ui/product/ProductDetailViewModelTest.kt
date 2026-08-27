package com.ringdog.android.ui.product

import app.cash.turbine.test
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.datadog.android.rum.RumMonitor
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.repository.CartRepository
import com.ringdog.android.data.repository.ProductRepository
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

@OptIn(ExperimentalCoroutinesApi::class)
class ProductDetailViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val productRepository = mockk<ProductRepository>()
    private val cartRepository = mockk<CartRepository>()
    private val product = ProductDto("p1", "Ring", "desc", "19.99", 5, listOf("cute"), null, "2026-01-01")

    @Before
    fun setUp() {
        mockkStatic(GlobalRumMonitor::class)
    }

    @After
    fun tearDown() {
        unmockkStatic(GlobalRumMonitor::class)
    }

    @Test
    fun `loads the product on init`() = runTest {
        coEvery { productRepository.getProduct("p1") } returns ApiResult.Success(product)

        val viewModel = ProductDetailViewModel("p1", productRepository, cartRepository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals(product, awaitItem().product)
        }
    }

    @Test
    fun `addToCart on success reports a RUM action and flags addedToCart`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { productRepository.getProduct("p1") } returns ApiResult.Success(product)
        val cartItem = CartItemDto("c1", "u1", "p1", 1, "2026-01-01")
        coEvery { cartRepository.addItem("p1", 1) } returns ApiResult.Success(cartItem)

        val viewModel = ProductDetailViewModel("p1", productRepository, cartRepository)
        viewModel.addToCart()
        advanceUntilIdle()

        verify { rumMonitor.addAction(RumActionType.TAP, "add_to_cart", mapOf("product_id" to "p1")) }
        assertEquals(true, viewModel.uiState.value.addedToCart)
    }

    @Test
    fun `addToCart on failure surfaces an error and does not report a RUM action`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { productRepository.getProduct("p1") } returns ApiResult.Success(product)
        coEvery { cartRepository.addItem("p1", 1) } returns ApiResult.Error("Product not found")

        val viewModel = ProductDetailViewModel("p1", productRepository, cartRepository)
        viewModel.addToCart()
        advanceUntilIdle()

        verify(exactly = 0) { rumMonitor.addAction(any(), any(), any()) }
        assertEquals("Product not found", viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `onNavigatedToCart resets addedToCart so navigation does not re-trigger`() = runTest {
        val rumMonitor = mockk<RumMonitor>(relaxed = true)
        every { GlobalRumMonitor.get() } returns rumMonitor
        coEvery { productRepository.getProduct("p1") } returns ApiResult.Success(product)
        val cartItem = CartItemDto("c1", "u1", "p1", 1, "2026-01-01")
        coEvery { cartRepository.addItem("p1", 1) } returns ApiResult.Success(cartItem)

        val viewModel = ProductDetailViewModel("p1", productRepository, cartRepository)
        viewModel.addToCart()
        advanceUntilIdle()
        assertEquals(true, viewModel.uiState.value.addedToCart)

        viewModel.onNavigatedToCart()

        assertEquals(false, viewModel.uiState.value.addedToCart)
    }
}
