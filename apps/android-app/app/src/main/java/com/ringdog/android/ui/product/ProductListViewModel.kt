package com.ringdog.android.ui.product

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.ProductDto
import com.ringdog.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProductListUiState(
    val products: List<ProductDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class ProductListViewModel(private val repository: ProductRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(ProductListUiState())
    val uiState: StateFlow<ProductListUiState> = _uiState.asStateFlow()

    init {
        loadProducts()
    }

    fun loadProducts() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getProducts()) {
                is ApiResult.Success -> _uiState.value = ProductListUiState(products = result.data.items)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }
}
