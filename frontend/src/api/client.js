// All requests to the Laravel backend go through this helper.
const API_URL = 'http://127.0.0.1:8000/api'

/**
 * Perform an API request.
 * @param {string} path   e.g. '/login'
 * @param {object} opts   { method, body, token }
 *                        body is auto-JSON-stringified
 * @returns parsed JSON response
 * @throws an Error carrying the server's message when !res.ok
 */
export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}` // JWT-style auth

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({})) // tolerate empty bodies

  if (!res.ok) {
    // Laravel returns 422 with { errors: {...} } for validation failures
    const message =
      data.message ||
      (data.errors && Object.values(data.errors).flat().join(' ')) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }

  return data
}
