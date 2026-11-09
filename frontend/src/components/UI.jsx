import { cloneElement, useEffect, useId, useRef, useState } from 'react'

export function Icon({ name, ...props }) {
  const paths = {
    home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    branch:
      'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    room: 'M4 21V3h13v18M1 21h21M13 12h.01M17 6h3v15',
    price: 'M12 2v20M17 5H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6',
    team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    menu: 'M4 6h16M4 12h16M4 18h16',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    check: 'm5 12 4 4L19 6',
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name] || paths.home} />
    </svg>
  )
}

export function Alert({ error }) {
  const ref = useRef(null)
  useEffect(() => {
    if (error) ref.current?.focus()
  }, [error])
  if (!error) return null
  function focusField(field) {
    const root = ref.current.closest('dialog') || ref.current.closest('main')
    root?.querySelector(`[name="${CSS.escape(field)}"]`)?.focus()
  }
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="alert">
      <strong>
        {error.errors && Object.keys(error.errors).length
          ? 'Revisa los campos indicados para continuar.'
          : error.message || error}
      </strong>
      {error.errors && (
        <ul>
          {Object.entries(error.errors).flatMap(([field, messages]) =>
            messages.map((message) => (
              <li key={`${field}-${message}`}>
                <button
                  type="button"
                  className="error-link"
                  onClick={() => focusField(field)}
                >
                  {message}
                </button>
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  )
}

export function Notice({ children, onDismiss }) {
  if (!children) return null
  return (
    <div className="notice">
      <div role="status">
        <Icon name="check" />
        <span>{children}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="secondary"
          aria-label="Cerrar mensaje de confirmación"
          onClick={onDismiss}
        >
          Cerrar
        </button>
      )}
    </div>
  )
}

export function Loading({ children = 'Cargando datos…' }) {
  return (
    <p role="status" className="loading-state">
      <span className="loading-dot" aria-hidden="true" />
      {children}
    </p>
  )
}

export function EmptyState({ title, description, children }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}

export function PageTitle({ title, description, children }) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </header>
  )
}

export function Modal({
  title,
  description,
  busy = false,
  initialFocus = 'field',
  onClose,
  children,
}) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement
    dialog.showModal()
    dialog
      .querySelector(
        initialFocus === 'cancel'
          ? '[data-cancel]'
          : 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      ?.focus()
    return () => {
      dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
      else
        document.getElementById('main-content')?.focus({ preventScroll: true })
    }
  }, [initialFocus])
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
    >
      <div className="dialog-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onClose}
          aria-label="Cerrar formulario"
        >
          Cerrar
        </button>
      </div>
      {description && (
        <p id={`${id}-description`} className="muted dialog-description">
          {description}
        </p>
      )}
      {children}
    </dialog>
  )
}

export function Field({
  label,
  children,
  hint,
  error,
  optional = false,
  ...props
}) {
  const id = useId()
  const message = Array.isArray(error) ? error[0] : error
  const childProps = children?.props || props
  const required = childProps.required
  const describedBy =
    [hint && `${id}-hint`, message && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  const accessibility = {
    id: childProps.id || id,
    'aria-labelledby': `${id}-label`,
    'aria-describedby': describedBy,
    'aria-invalid': message ? true : undefined,
  }
  const control = children ? (
    cloneElement(children, accessibility)
  ) : (
    <input {...props} {...accessibility} />
  )
  return (
    <div className={`field${message ? ' has-error' : ''}`}>
      <label htmlFor={accessibility.id}>
        <span id={`${id}-label`}>{label}</span>
        {required && (
          <span className="required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {optional && <span className="optional-label"> (opcional)</span>}
      </label>
      {control}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="field-error">
          {message}
        </p>
      )}
    </div>
  )
}

export function PasswordField({ label = 'Contraseña', ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-field">
      <Field label={label} {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="text-button"
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      </button>
    </div>
  )
}

export function FormActions({ busy, onCancel, label = 'Guardar cambios' }) {
  return (
    <div className="form-actions">
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={onCancel}
      >
        Cancelar
      </button>
      <button disabled={busy}>{busy ? 'Guardando…' : label}</button>
    </div>
  )
}

export function Pagination({ meta, onPage, disabled }) {
  if (!meta) return null
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="pagination-total" role="status">
        {meta.total} {meta.total === 1 ? 'registro' : 'registros'}
      </span>
      {meta.last_page > 1 && (
        <>
          <button
            type="button"
            className="secondary"
            disabled={disabled || meta.current_page <= 1}
            onClick={() => onPage(meta.current_page - 1)}
          >
            Anterior
          </button>
          <span>
            Página {meta.current_page} de {meta.last_page}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={disabled || meta.current_page >= meta.last_page}
            onClick={() => onPage(meta.current_page + 1)}
          >
            Siguiente
          </button>
        </>
      )}
    </nav>
  )
}

export function Status({
  active,
  activeLabel = 'Activo',
  inactiveLabel = 'Inactivo',
}) {
  return (
    <span className={`badge ${active ? 'active' : ''}`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}
