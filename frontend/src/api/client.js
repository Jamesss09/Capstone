// All requests to the Laravel backend go through this helper.
const API_URL = 'http://127.0.0.1:8000/api'

/** Error that keeps the HTTP status so callers can special-case 401/403. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Fired whenever the backend rejects our credentials, so the app can drop the
// stored session and fall back to the login screen instead of rendering a
// dashboard built on a dead token.
let onUnauthorized = null

/** Register the callback to run on 401 (AuthContext clears its state there). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

/**
 * Perform an API request.
 * @param {string} path   e.g. '/login'
 * @param {object} opts   { method, body, token, signal }
 *                        body is auto-JSON-stringified
 * @returns parsed JSON response
 * @throws an Error carrying the server's message when !res.ok
 */
export async function api(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}` // JWT-style auth

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  const data = await res.json().catch(() => ({})) // tolerate empty bodies

  if (!res.ok) {
    // Laravel returns 422 with { errors: {...} } for validation failures
    const message =
      data.message ||
      (data.errors && Object.values(data.errors).flat().join(' ')) ||
      `Request failed (${res.status})`

    // 401 = the token is revoked, expired, or its user is gone. Clear the
    // session so the router lands on /login. (A failed login attempt is a 422,
    // but skip the path anyway so the handler never fires on our own login call.)
    if (res.status === 401 && path !== '/login') onUnauthorized?.()

    throw new ApiError(message, res.status)
  }

  return data
}
