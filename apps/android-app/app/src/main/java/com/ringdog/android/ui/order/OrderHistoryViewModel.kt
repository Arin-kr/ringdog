package com.ringdog.android.ui.order

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.datadog.android.rum.GlobalRumMonitor
import com.datadog.android.rum.RumActionType
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.remote.dto.OrderDto
import com.ringdog.android.data.repository.OrderRepository
import com.ringdog.android.datadog.AppLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OrderHistoryUiState(
    val orders: List<OrderDto> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val lastCheckoutOrderId: String? = null,
)

class OrderHistoryViewModel(private val repository: OrderRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(OrderHistoryUiState())
    val uiState: StateFlow<OrderHistoryUiState> = _uiState.asStateFlow()

    init {
        loadOrders()
    }

    fun loadOrders() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.getOrders()) {
                is ApiResult.Success -> _uiState.value = _uiState.value.copy(orders = result.data.items, isLoading = false)
                is ApiResult.Error -> _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = result.message)
            }
        }
    }

    fun checkout(couponCode: String? = null) {
        viewModelScope.launch {
            when (val result = repository.checkout(couponCode)) {
                is ApiResult.Success -> {
                    GlobalRumMonitor.get().addAction(
                        RumActionType.CUSTOM,
                        "place_order",
                        mapOf("order_id" to result.data.orderId, "total_amount" to result.data.totalAmount),
                    )
                    _uiState.value = _uiState.value.copy(lastCheckoutOrderId = result.data.orderId)
                    loadOrders()
                }
                is ApiResult.Error -> {
                    AppLogger.error("order_failure", mapOf("reason" to result.message, "coupon_code" to couponCode))
                    _uiState.value = _uiState.value.copy(errorMessage = result.message)
                }
            }
        }
    }
}
