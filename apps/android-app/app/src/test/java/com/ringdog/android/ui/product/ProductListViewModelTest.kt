package com.ringdog.android.ui.product

import app.cash.turbine.test
import com.ringdog.android.MainDispatcherRule
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.remote.dto.ProductListResponse
import com.ringdog.android.data.repository.ProductRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ProductListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val repository = mockk<ProductRepository>()
    private val product = ProductDto("p1", "Ring", "desc", "19.99", 5, listOf("cute"), null, "2026-01-01")

    @Test
    fun `loads products on init`() = runTest {
        coEvery { repository.getProducts(1, 20) } returns ApiResult.Success(
            ProductListResponse(listOf(product), 1, 20, 1),
        )

        val viewModel = ProductListViewModel(repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals(listOf(product), awaitItem().products)
        }
    }

    @Test
    fun `surfaces the error message on failure`() = runTest {
        coEvery { repository.getProducts(1, 20) } returns ApiResult.Error("Network error")

        val viewModel = ProductListViewModel(repository)
        advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals("Network error", awaitItem().errorMessage)
        }
    }
}
