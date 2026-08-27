package com.ringdog.android.ui.order

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.repository.OrderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OrderDetailUiState(
    val order: OrderDto? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class OrderDetailViewModel(
    private val orderId: String,
    private val repository: OrderRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(OrderDetailUiState())
    val uiState: StateFlow<OrderDetailUiState> = _uiState.asStateFlow()

    init {
        loadOrder()
    }

    fun loadOrder() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getOrder(orderId)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(order = result.data, isLoading = false)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun cancelOrder() {
        viewModelScope.launch {
            when (val result = repository.cancelOrder(orderId)) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(order = result.data)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(errorMessage = result.message)
            }
        }
    }
}
