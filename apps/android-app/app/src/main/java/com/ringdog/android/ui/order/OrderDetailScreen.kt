package com.ringdog.android.ui.order

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun OrderDetailScreen(viewModel: OrderDetailViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it) }

        uiState.order?.let { order ->
            Text("주문 #${order.id}")
            Text("상태: ${order.status}")
            Text("총액: ₩${order.totalAmount}")
            order.items.forEach { item ->
                Text("- ${item.product.name} x${item.quantity} (₩${item.unitPrice})")
            }
            if (order.status == "PENDING" || order.status == "PAID") {
                Button(onClick = { viewModel.cancelOrder() }) {
                    Text("주문 취소")
                }
            }
        }
    }
}
