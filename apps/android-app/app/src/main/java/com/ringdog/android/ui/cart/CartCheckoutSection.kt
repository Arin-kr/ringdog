package com.ringdog.android.ui.cart

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ringdog.android.ui.order.OrderHistoryViewModel

@Composable
fun CartCheckoutSection(
    orderViewModel: OrderHistoryViewModel,
    onCheckoutSuccess: (orderId: String) -> Unit,
) {
    val orderUiState by orderViewModel.uiState.collectAsState()

    LaunchedEffect(orderUiState.lastCheckoutOrderId) {
        orderUiState.lastCheckoutOrderId?.let(onCheckoutSuccess)
    }

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        orderUiState.errorMessage?.let { Text(it) }
        Button(
            onClick = { orderViewModel.checkout() },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("주문하기")
        }
    }
}
