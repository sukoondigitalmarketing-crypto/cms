export function getAuthToken(): string | null {
  return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
}

export function setAuthToken(token: string, rememberMe = true) {
  clearAuthToken();
  if (rememberMe) {
    localStorage.setItem('auth_token', token);
  } else {
    sessionStorage.setItem('auth_token', token);
  }
}

export function clearAuthToken() {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
}

export function createAuthHeaders(contentType = false): HeadersInit {
  const headers: Record<string, string> = {};
  const token = getAuthToken();

  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}
