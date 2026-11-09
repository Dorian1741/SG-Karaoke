import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { roleLabels } from '../auth/roles'
import { Alert, Icon, Loading } from './UI'

export default function Layout() {
  const { session, tenant, tenants, selectTenant, logout } = useAuth()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const links = [
    ['/', 'Inicio', 'Tu negocio de un vistazo', 'home'],
    ['/branches', 'Sucursales', 'Ubicaciones de tu negocio', 'branch'],
    ['/rooms', 'Salas', 'Capacidad y disponibilidad', 'room'],
    ['/rates', 'Precios por hora', 'Precios vigentes e historial', 'price'],
    [
      '/administration',
      'Mi negocio y equipo',
      'Información y permisos',
      'team',
    ],
  ]
  const current =
    links.find(([to]) => to === location.pathname)?.[1] || 'Inicio'
  useEffect(() => {
    document.title = `${current} · KaraokeOS`
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [current])
  async function changeTenant(event) {
    setError(null)
    setBusy(true)
    try {
      await selectTenant(event.target.value)
      setMenuOpen(false)
      navigate('/')
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }
  async function signOut() {
    setBusy(true)
    setError(null)
    try {
      await logout()
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <div className="sidebar-heading">
          <div className="brand">
            K<span>OS</span>
            <small>KaraokeOS</small>
          </div>
          <button
            type="button"
            className="secondary menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="sidebar-panel"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Icon name="menu" />
            {menuOpen ? 'Cerrar menú' : 'Menú'}
          </button>
        </div>
        <div
          id="sidebar-panel"
          className={`sidebar-panel${menuOpen ? ' is-open' : ''}`}
        >
          <div className="tenant-selector">
            <label htmlFor="active-tenant">Establecimiento activo</label>
            <select
              id="active-tenant"
              value={tenant?.id || ''}
              onChange={changeTenant}
              disabled={busy}
            >
              <option value="" disabled>
                Seleccionar establecimiento
              </option>
              {tenants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {tenants.length > 1 && (
              <p className="field-hint">
                Elige el negocio que quieres administrar.
              </p>
            )}
          </div>
          <nav aria-label="Navegación principal">
            {links.map(([to, label, hint, icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={icon} />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </NavLink>
            ))}
          </nav>
          <div className="account">
            <div>
              <strong>{session.user.name}</strong>
              <small>
                {roleLabels[tenant?.role] || 'Selecciona un establecimiento'}
              </small>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={signOut}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>
            {tenant?.name || 'KaraokeOS'}
            <span className="breadcrumb-separator" aria-hidden="true">
              {' '}
              /{' '}
            </span>
            <strong>{current}</strong>
          </span>
          <span className="muted">{roleLabels[tenant?.role] || ''}</span>
        </div>
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          <Alert error={error} />
          {busy ? (
            <Loading>Actualizando tu establecimiento…</Loading>
          ) : (
            <Outlet key={tenant?.id || 'selection'} />
          )}
        </main>
      </div>
    </div>
  )
}
