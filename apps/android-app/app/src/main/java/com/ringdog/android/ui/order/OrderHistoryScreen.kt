package com.ringdog.android.ui.order

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun OrderHistoryScreen(
    viewModel: OrderHistoryViewModel,
    onOrderClick: (String) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("주문 내역")

        if (uiState.isLoading) {
            CircularProgressIndicator()
        }

        uiState.errorMessage?.let { Text(it) }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(uiState.orders, key = { it.id }) { order ->
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onOrderClick(order.id) },
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("주문 #${order.id.take(8)}")
                    Text("${order.status} · ₩${order.totalAmount}")
                }
            }
        }
    }
}
