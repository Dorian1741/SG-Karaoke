import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { roleLabels } from '../auth/roles'
import { Alert, EmptyState, Icon, Loading, PageTitle } from '../components/UI'

export default function Dashboard() {
  const { tenant, tenants, session, selectTenant } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!tenant) return
    const controller = new AbortController()
    request('/dashboard', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result.data)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
    return () => controller.abort()
  }, [tenant, revision])
  async function choose(id) {
    setBusy(true)
    setError(null)
    try {
      await selectTenant(id)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }
  if (!tenant)
    return (
      <>
        <PageTitle
          title="¿Qué establecimiento quieres abrir?"
          description="Selecciona tu negocio para ver sus salas, precios y equipo."
        />
        <Alert error={error} />
        <div className="grid gap-4 md:grid-cols-2">
          {tenants.map((item) => (
            <button
              key={item.id}
              className="card tenant-choice"
              disabled={busy}
              onClick={() => choose(item.id)}
            >
              <Icon name="branch" />
              <span>
                {item.name}
                <small>{roleLabels[item.role]}</small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
        {!tenants.length && (
          <EmptyState
            title="Todavía no tienes un establecimiento asignado"
            description="Pide al propietario que te dé acceso. Cuando lo haga, tu negocio aparecerá aquí."
          />
        )}
      </>
    )
  const canManage = ['owner', 'admin'].includes(tenant.role)
  const steps = [
    {
      to: '/branches',
      title: 'Tus sucursales',
      hint: 'Una sucursal es la ubicación de tu bar. Si tienes un solo local, solo necesitas una.',
      action: canManage ? 'Gestionar sucursales' : 'Ver sucursales',
      icon: 'branch',
    },
    {
      to: '/rooms',
      title: 'Tus salas',
      hint: 'Revisa cuántas personas caben y si la sala está disponible, en limpieza o en mantenimiento.',
      action: canManage ? 'Gestionar salas' : 'Ver salas',
      icon: 'room',
    },
    {
      to: '/rates',
      title: 'El precio por hora',
      hint: 'Consulta el precio vigente de cada sala y los cambios anteriores.',
      action: canManage ? 'Configurar precios' : 'Ver precios',
      icon: 'price',
    },
  ]
  return (
    <>
      <PageTitle
        title="Inicio"
        description={`Hola, ${session.user.name}. Este es tu espacio en ${tenant.name}.`}
      />
      <Alert error={error} />
      {error && (
        <button
          className="secondary mb-6"
          onClick={() => {
            setError(null)
            setData(null)
            setRevision((value) => value + 1)
          }}
        >
          Volver a cargar el resumen
        </button>
      )}
      {!data && !error ? (
        <Loading>Cargando el resumen de tu negocio…</Loading>
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                [
                  'Sucursales',
                  data.branches,
                  '/branches',
                  'Ubicaciones registradas',
                ],
                [
                  'Salas',
                  data.rooms,
                  '/rooms',
                  'Salas registradas en tu negocio',
                ],
                [
                  'Salas disponibles',
                  data.available_rooms,
                  '/rooms',
                  'Solo salas y sucursales activas',
                ],
              ].map(([label, value, to, hint]) => (
                <Link className="card stat" to={to} key={label}>
                  <span className="stat-label">
                    {label}
                    <Icon name="arrow" />
                  </span>
                  <strong>{value}</strong>
                  <small className="muted">{hint}</small>
                </Link>
              ))}
            </div>
            <section
              className="getting-started"
              aria-labelledby="getting-started-title"
            >
              <div className="section-heading">
                <div>
                  <h2 id="getting-started-title">Todo a mano</h2>
                  <p className="muted">
                    Empieza por tus sucursales, continúa con las salas y define
                    sus precios.
                  </p>
                </div>
              </div>
              <div className="guide-grid">
                {steps.map((step, index) => (
                  <article className="card guide-card" key={step.to}>
                    <div className="guide-number">
                      <Icon name={step.icon} />
                      <span>Paso {index + 1}</span>
                    </div>
                    <h3>{step.title}</h3>
                    <p className="muted">{step.hint}</p>
                    <Link className="button-link secondary" to={step.to}>
                      {step.action}
                      <Icon name="arrow" />
                    </Link>
                  </article>
                ))}
              </div>
            </section>
            {tenant.role === 'owner' && (
              <section className="team-callout">
                <Icon name="team" />
                <div>
                  <h2>¿Trabajas con más personas?</h2>
                  <p className="muted">
                    Agrega a tu equipo y elige qué puede hacer cada persona.
                  </p>
                </div>
                <Link className="button-link secondary" to="/administration">
                  Gestionar mi equipo
                </Link>
              </section>
            )}
          </>
        )
      )}
    </>
  )
}
