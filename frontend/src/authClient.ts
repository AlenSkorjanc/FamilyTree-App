import type { ApiError, PersonInput } from './types'

export interface UserProfileInput extends PersonInput {
  email: string
}

export interface AuthUser extends UserProfileInput {
  id: string
  displayName: string | null
  hasPassword: boolean
  emailVerified: boolean
}

interface AccessTokenResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
}

export interface AuthenticationResponse extends AccessTokenResponse {
  user: AuthUser
}

export interface AuthProviders {
  password: boolean
  google: boolean
  facebook: boolean
}

export class ApiRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
  }
}

export const apiBaseUrl = ''

let accessToken: string | null = null
let refreshPromise: Promise<string> | null = null
let authenticationFailureHandler: (() => void) | null = null

export function setAccessToken(token: string | null) { accessToken = token }
export function setAuthenticationFailureHandler(handler: (() => void) | null) { authenticationFailureHandler = handler }

async function parseError(response: Response): Promise<ApiRequestError> {
  const body = await response.json().catch(() => ({ message: response.statusText, code: 'REQUEST_FAILED' })) as Partial<ApiError>
  return new ApiRequestError(response.status, body.code ?? 'REQUEST_FAILED', body.message || response.statusText || 'Request failed')
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBaseUrl}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw await parseError(response)
        const body = await response.json() as AccessTokenResponse
        setAccessToken(body.accessToken)
        return body.accessToken
      })
      .catch((error: unknown) => {
        setAccessToken(null)
        authenticationFailureHandler?.()
        throw error
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function authenticatedRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const publicShareId = window.location.pathname.match(/^\/shared\/([0-9a-f-]+)$/i)?.[1]
  if (publicShareId) headers.set('X-Public-Share-Id', publicShareId)
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry) {
    await refreshAccessToken()
    return authenticatedRequest<T>(path, options, false)
  }
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) throw await parseError(response)
  return response.json() as Promise<T>
}

export const authApi = {
  register: (body: { firstName: string; lastName: string; email: string; password: string }) =>
    publicRequest<{ message: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    publicRequest<AuthenticationResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  refresh: refreshAccessToken,
  me: () => authenticatedRequest<AuthUser>('/api/auth/me', {}, false),
  updateProfile: (body: UserProfileInput) => authenticatedRequest<AuthUser>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  verifyEmail: (token: string) => publicRequest<{ message: string }>('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: (email: string) => publicRequest<{ message: string }>('/api/auth/verification/resend', { method: 'POST', body: JSON.stringify({ email }) }),
  forgotPassword: (email: string) => publicRequest<{ message: string }>('/api/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) => publicRequest<{ message: string }>('/api/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  requestPasswordChange: (currentPassword?: string) => authenticatedRequest<{ message: string }>('/api/auth/me/password-change-request', { method: 'POST', body: JSON.stringify({ currentPassword }) }),
  uploadProfilePhoto: async (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return authenticatedRequest<{ photoUrl: string }>('/api/auth/me/photo', { method: 'POST', body })
  },
  deleteProfile: async () => {
    try { await authenticatedRequest<void>('/api/auth/me', { method: 'DELETE' }) }
    finally { setAccessToken(null) }
  },
  providers: () => publicRequest<AuthProviders>('/api/auth/providers'),
  logout: async () => {
    const response = await fetch(`${apiBaseUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    setAccessToken(null)
    if (!response.ok) throw await parseError(response)
  },
  logoutAll: async () => {
    try { return await authenticatedRequest<{ message: string }>('/api/auth/logout-all', { method: 'POST' }) }
    finally { setAccessToken(null) }
  },
}

export function socialLoginUrl(provider: 'google' | 'facebook') {
  return `${apiBaseUrl}/oauth2/authorization/${provider}`
}
