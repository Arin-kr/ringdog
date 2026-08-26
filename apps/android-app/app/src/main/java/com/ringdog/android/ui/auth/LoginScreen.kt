package com.ringdog.android.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    onNavigateToSignup: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) onLoginSuccess()
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("RingDog 로그인")
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("이메일") })
        OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("비밀번호") })

        if (uiState is AuthUiState.Error) {
            Text((uiState as AuthUiState.Error).message)
        }

        if (uiState is AuthUiState.Loading) {
            CircularProgressIndicator()
        } else {
            Button(
                onClick = { viewModel.login(email, password) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("로그인")
            }
        }

        TextButton(onClick = onNavigateToSignup) {
            Text("계정이 없으신가요? 회원가입")
        }
    }
}
