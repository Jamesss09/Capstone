// All requests to the Laravel backend go through this helper.
//
// HOST MUST MATCH THE FRONTEND (localhost, not 127.0.0.1). The refresh token is
// a SameSite=lax cookie, and SameSite is decided by hostname, not port — so
// localhost:5173 -> localhost:8000 is same-site and the cookie is sent, whereas
// 127.0.0.1 would be treated as a different site and silently dropped.
const API_URL = 'http://localhost:8000/api'

const REFRESH_PATH = '/refresh'

/** Error that keeps the HTTP status so callers can special-case 401/403. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// The access token is short-lived (15 min) and deliberately NOT persisted: it
// lives here in module memory only, so a page reload starts from the httpOnly
// refresh cookie instead of whatever stale value was sitting in storage.
let accessToken = null

// Fired when the session is definitively over, so AuthContext can show login.
let onUnauthorized = null
// Fired whenever the access token changes (login, or a silent background refresh).
let onTokenChange = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

/** Subscribe to access-token changes (including silent refreshes). */
export function onTokenChangeListener(fn) {
  onTokenChange = fn
  return () => {
    if (onTokenChange === fn) onTokenChange = null
  }
}

function setAccessToken(token) {
  accessToken = token
  onTokenChange?.(token)
}

/** Publish a freshly issued access token (login) or clear it (logout). */
export function storeAccessToken(token) {
  setAccessToken(token)
}

export function getAccessToken() {
  return accessToken
}

/**
 * Trade the httpOnly refresh cookie for a fresh access token. Called on boot to
 * restore a session and, on demand, when an access token expires mid-session.
 * Collapses concurrent callers onto a single in-flight request.
 */
let refreshInFlight = null

export function refreshSession() {
  refreshInFlight ??= fetch(`${API_URL}${REFRESH_PATH}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include', // required or the browser withholds the cookie
  })
    .then((res) => {
      if (!res.ok) throw new ApiError('Session expired.', res.status)
      return res.json()
    })
    .then((data) => {
      setAccessToken(data.token)
      return data
    })
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

/**
 * Perform an API request.
 * @param {string} path   e.g. '/login'
 * @param {object} opts   { method, body, token, _retried }
 *                        body is auto-JSON-stringified
 * @returns parsed JSON response
 * @throws an Error carrying the server's message when !res.ok
 *
 * A 401 triggers one silent refresh + retry, so a 15-minute access token
 * expiring never surfaces to the user.
 */
export async function api(path, { method = 'GET', body, token, _retried = false } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  // Prefer the module token: after a silent refresh it is newer than whatever
  // `token` a page captured at render time.
  const bearer = accessToken ?? token
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  const data = await res.json().catch(() => ({})) // tolerate empty bodies

  if (!res.ok) {
    const isAuthPath = path === '/login' || path === REFRESH_PATH

    // Access token expired or was revoked — try the refresh cookie once.
    if (res.status === 401 && !isAuthPath && !_retried) {
      try {
        await refreshSession()
        return await api(path, { method, body, token: accessToken, _retried: true })
      } catch {
        // The refresh token is gone too, so the session is genuinely over.
        setAccessToken(null)
        onUnauthorized?.()
        throw new ApiError('Your session has expired. Please sign in again.', 401)
      }
    }

    // Laravel returns 422 with { errors: {...} } for validation failures
    const message =
      data.message ||
      (data.errors && Object.values(data.errors).flat().join(' ')) ||
      `Request failed (${res.status})`

    if (res.status === 401 && !isAuthPath) {
      setAccessToken(null)
      onUnauthorized?.()
    }

    throw new ApiError(message, res.status)
  }

  return data
}