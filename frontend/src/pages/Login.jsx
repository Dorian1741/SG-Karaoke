import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Alert, Field, PasswordField } from '../components/UI'

export default function Login() {
  const { session, login, error: sessionError } = useAuth()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    document.title = 'Iniciar sesión · KaraokeOS'
  }, [])
  async function submit(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    data.email = data.email.trim()
    setBusy(true)
    setError(null)
    try {
      await login(data)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }
  return session ? (
    <Navigate to="/" replace />
  ) : (
    <main className="login-page">
      <div className="login-intro">
        <p className="eyebrow">KARAOKEOS</p>
        <h1>
          Tu espacio.
          <br />
          Tu ritmo.
          <br />
          <span>Todo bajo control.</span>
        </h1>
        <p className="muted">
          Tus sucursales, salas, precios y equipo en un solo lugar.
        </p>
      </div>
      <section className="card login-card" aria-labelledby="login-title">
        <h2 id="login-title">Bienvenido de nuevo</h2>
        <p className="muted mb-6">
          Entra con el correo y la contraseña que te asignó el propietario.
        </p>
        <Alert error={error || sessionError} />
        <form onSubmit={submit} aria-busy={busy}>
          <Field
            label="Correo electrónico"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="nombre@ejemplo.com"
            required
            maxLength={255}
            error={error?.errors?.email}
          />
          <PasswordField
            name="password"
            autoComplete="current-password"
            required
            error={error?.errors?.password}
          />
          <button className="w-full" disabled={busy}>
            {busy ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="muted login-help">
          Si no recuerdas tus datos de acceso, pide ayuda al propietario de tu
          establecimiento.
        </p>
      </section>
    </main>
  )
}
