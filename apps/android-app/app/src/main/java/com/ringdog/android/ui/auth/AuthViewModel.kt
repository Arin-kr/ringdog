package com.ringdog.android.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ringdog.android.data.ApiResult
import com.ringdog.android.data.repository.AuthRepository
import com.ringdog.android.datadog.AppLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    data object Idle : AuthUiState()
    data object Loading : AuthUiState()
    data object Success : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            _uiState.value = when (val result = repository.login(email, password)) {
                is ApiResult.Success -> {
                    AppLogger.info("login_success", mapOf("email" to email))
                    AuthUiState.Success
                }
                is ApiResult.Error -> {
                    AppLogger.error("login_failure", mapOf("email" to email, "reason" to result.message))
                    AuthUiState.Error(result.message)
                }
            }
        }
    }

    fun signup(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            _uiState.value = when (val result = repository.signup(email, password)) {
                is ApiResult.Success -> AuthUiState.Success
                is ApiResult.Error -> {
                    AppLogger.error("signup_failure", mapOf("email" to email, "reason" to result.message))
                    AuthUiState.Error(result.message)
                }
            }
        }
    }
}
