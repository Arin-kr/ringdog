package com.ringdog.android.ui.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.CartItemDto
import com.ringdog.android.data.repository.CartRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CartUiState(
    val items: List<CartItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class CartViewModel(private val repository: CartRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(CartUiState())
    val uiState: StateFlow<CartUiState> = _uiState.asStateFlow()

    init {
        loadCart()
    }

    fun loadCart() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getCart()) {
                is ApiResult.Success -> _uiState.value = CartUiState(items = result.data.items)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun removeFromCart(cartItemId: String) {
        viewModelScope.launch {
            when (repository.removeItem(cartItemId)) {
                is ApiResult.Success -> loadCart()
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(errorMessage = "장바구니 항목 삭제에 실패했습니다")
            }
        }
    }
}
