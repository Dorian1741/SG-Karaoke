import { useEffect, useState } from 'react'
import '../App.css'
import { request } from '../api/client'

function Health() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function checkHealth() {
      try {
        const data = await request('/health', { signal: controller.signal })
        if (data.status !== 'ok' || data.database !== 'connected') {
          throw new Error('La API devolvió un estado inesperado.')
        }
        if (!controller.signal.aborted) setHealth(data)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause.message)
      }
    }
    controller.signal.addEventListener('abort', () => {
      if (controller.signal.reason?.name === 'TimeoutError') {
        setError('La API tardó demasiado en responder.')
      }
    })
    const requestTimeout = setTimeout(
      () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
      10000,
    )
    checkHealth().finally(() => clearTimeout(requestTimeout))
    return () => {
      clearTimeout(requestTimeout)
      controller.abort()
    }
  }, [attempt])

  return (
    <main className="health-page">
      <p className="eyebrow">ADMINISTRACIÓN DE KARAOKE</p>
      <h1>KaraokeOS</h1>
      <p>El punto de partida para administrar tus establecimientos y salas.</p>
      <section aria-labelledby="health-title">
        <h2 id="health-title">Estado del sistema</h2>
        <div role="status" aria-live="polite">
          {error ? (
            <p className="error">No se pudo conectar. {error}</p>
          ) : health ? (
            <>
              <p className="success">API conectada</p>
              <p>PostgreSQL disponible</p>
            </>
          ) : (
            <p>Comprobando conexión con la API…</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setHealth(null)
            setError('')
            setAttempt((value) => value + 1)
          }}
        >
          Volver a comprobar
        </button>
      </section>
    </main>
  )
}

export default Health
