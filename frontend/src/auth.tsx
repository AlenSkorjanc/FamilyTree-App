import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, setAccessToken, setAuthenticationFailureHandler, type AuthUser, type AuthenticationResponse } from './authClient'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>
  restore: () => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setLoading] = useState(true)

  const acceptAuthentication = useCallback((response: AuthenticationResponse) => {
    setAccessToken(response.accessToken)
    setUser(response.user)
  }, [])

  const restore = useCallback(async () => {
    try {
      await authApi.refresh()
      setUser(await authApi.me())
      return true
    } catch {
      setAccessToken(null)
      setUser(null)
      return false
    }
  }, [])

  useEffect(() => {
    let active = true
    setAuthenticationFailureHandler(() => {
      if (!active) return
      setUser(null)
    })
    void restore().finally(() => { if (active) setLoading(false) })
    return () => { active = false; setAuthenticationFailureHandler(null) }
  }, [restore])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isLoading,
    login: async (email, password) => acceptAuthentication(await authApi.login({ email, password })),
    register: async (input) => acceptAuthentication(await authApi.register(input)),
    restore,
    logout: async () => {
      try { await authApi.logout() } finally { setUser(null) }
    },
  }), [acceptAuthentication, isLoading, restore, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function navigate(path: string, replace = false) {
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function safeReturnTarget(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}
