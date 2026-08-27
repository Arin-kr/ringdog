package com.ringdog.android.ui.product

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.repository.CartRepository
import com.ringdog.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProductDetailUiState(
    val product: ProductDto? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val addedToCart: Boolean = false,
)

class ProductDetailViewModel(
    private val productId: String,
    private val productRepository: ProductRepository,
    private val cartRepository: CartRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProductDetailUiState())
    val uiState: StateFlow<ProductDetailUiState> = _uiState.asStateFlow()

    init {
        loadProduct()
    }

    fun loadProduct() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = productRepository.getProduct(productId)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(product = result.data, isLoading = false)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun addToCart() {
        viewModelScope.launch {
            when (val result = cartRepository.addItem(productId, 1)) {
                is ApiResult.Success -> {
                    GlobalRumMonitor.get().addAction(
                        RumActionType.TAP,
                        "add_to_cart",
                        mapOf("product_id" to productId),
                    )
                    _uiState.value = _uiState.value.copy(addedToCart = true)
                }
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(errorMessage = result.message)
            }
        }
    }
}
