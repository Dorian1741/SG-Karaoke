import { useCallback, useEffect, useState } from 'react'
import { csrf, request } from '../api/client'

import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async (signal) => {
    const result = await request('/auth/me', { quiet: true, signal })
    const available = await request('/tenants', { quiet: true, signal })
    if (signal?.aborted) return
    setSession(result.data)
    setTenants(available.data)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        await refresh(controller.signal)
      } catch (cause) {
        if (!controller.signal.aborted && cause.status !== 401)
          setError(cause.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    const expired = () => {
      setSession(null)
      setTenants([])
      setError('Tu sesión expiró. Vuelve a iniciar sesión.')
    }
    window.addEventListener('auth-expired', expired)
    return () => {
      controller.abort()
      window.removeEventListener('auth-expired', expired)
    }
  }, [refresh])

  async function login(credentials) {
    await csrf()
    await request('/auth/login', {
      method: 'POST',
      body: credentials,
      quiet: true,
    })
    await refresh()
    setError('')
  }

  async function logout() {
    await request('/auth/logout', { method: 'POST' })
    setSession(null)
    setTenants([])
  }

  async function selectTenant(id) {
    await request('/tenants/select', {
      method: 'POST',
      body: { tenant_id: id },
    })
    await refresh()
  }

  const tenant = tenants.find((item) => item.id === session?.active_tenant_id)
  return (
    <AuthContext.Provider
      value={{
        session,
        tenants,
        tenant,
        loading,
        error,
        login,
        logout,
        selectTenant,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
