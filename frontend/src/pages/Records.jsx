import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOptions, request } from '../api/client'
import RecordActions, { TrashSwitch } from '../components/RecordActions'
import { useAuth } from '../auth/useAuth'
import {
  Alert,
  EmptyState,
  Field,
  FormActions,
  Loading,
  Modal,
  Notice,
  PageTitle,
  Pagination,
  Status,
} from '../components/UI'

const statuses = {
  available: 'Disponible',
  cleaning: 'En limpieza',
  maintenance: 'En mantenimiento',
}
const initialFilters = { search: '', is_active: '' }

export default function Records({ kind }) {
  const isRoom = kind === 'rooms'
  const label = isRoom ? 'sala' : 'sucursal'
  const { tenant } = useAuth()
  const canManage = ['owner', 'admin'].includes(tenant.role)
  const [trashed, setTrashed] = useState(false)
  const [result, setResult] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [optionsError, setOptionsError] = useState(null)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState(initialFilters)
  const [revision, setRevision] = useState(0)
  const filterRef = useRef(null)
  const hasActiveBranch = branches.some((branch) => branch.is_active)
  const canCreate = !isRoom || (!branchesLoading && hasActiveBranch)
  const hasFilters = Object.values(filters).some((value) => value !== '')
  useEffect(() => {
    const controller = new AbortController()
    if (isRoom)
      getOptions('/branches', controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setBranches(data)
            setOptionsError(null)
          }
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setOptionsError(cause)
        })
        .finally(() => {
          if (!controller.signal.aborted) setBranchesLoading(false)
        })
    return () => controller.abort()
  }, [isRoom, revision])
  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({
      page,
      per_page: 15,
      ...(trashed ? { trashed: 'only' } : {}),
      ...Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== ''),
      ),
    })
    request(`/${kind}?${query}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data)
          setError(null)
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [kind, page, filters, revision, trashed])
  function refresh() {
    setError(null)
    setLoading(true)
    setRevision((value) => value + 1)
  }
  function openForm(record = {}) {
    setEditing(record)
    setFormError(null)
  }
  function filter(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setPage(1)
    setFilters(Object.fromEntries(new FormData(event.currentTarget)))
  }
  function resetFilters() {
    filterRef.current?.reset()
    setLoading(true)
    setError(null)
    setPage(1)
    setFilters({ ...initialFilters })
  }
  async function save(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    if (isRoom) {
      data.capacity = Number(data.capacity)
      if (editing.id && data.branch_id === editing.branch_id)
        delete data.branch_id
    }
    setBusy(true)
    setFormError(null)
    try {
      await request(`/${kind}${editing.id ? `/${editing.id}` : ''}`, {
        method: editing.id ? 'PATCH' : 'POST',
        body: data,
      })
      setSuccess(
        `${isRoom ? 'Sala' : 'Sucursal'} "${data.name}" ${editing.id ? 'actualizada' : 'creada'} correctamente.`,
      )
      setEditing(null)
      refresh()
    } catch (cause) {
      setFormError(cause)
    } finally {
      setBusy(false)
    }
  }
  function changeView(value) {
    setTrashed(value)
    resetFilters()
  }
  function changed(message, action) {
    setSuccess(message)
    if (action === 'delete' || action === 'restore') setPage(1)
    refresh()
  }
  const fields = formError?.errors || {}
  return (
    <>
      <PageTitle
        title={isRoom ? 'Salas' : 'Sucursales'}
        description={
          isRoom
            ? 'Consulta tus salas, cuántas personas caben y cuáles están disponibles.'
            : 'Una sucursal es una ubicación de tu bar. Si tienes un solo local, empieza con una.'
        }
      >
        {canManage && !trashed && (
          <button disabled={!canCreate} onClick={() => openForm()}>
            + {isRoom ? 'Nueva sala' : 'Nueva sucursal'}
          </button>
        )}
      </PageTitle>
      <Notice onDismiss={() => setSuccess('')}>{success}</Notice>
      <Alert error={error || optionsError} />
      {(error || optionsError) && (
        <button type="button" className="secondary mb-5" onClick={refresh}>
          Volver a cargar
        </button>
      )}
      {isRoom &&
        canManage &&
        !trashed &&
        !branchesLoading &&
        !optionsError &&
        !hasActiveBranch && (
          <div className="help-banner">
            <div>
              <strong>Primero necesitas una sucursal activa</strong>
              <p>Así podrás indicar en qué local está cada sala.</p>
            </div>
            <Link className="button-link secondary" to="/branches">
              Ir a sucursales
            </Link>
          </div>
        )}
      {canManage && <TrashSwitch trashed={trashed} onChange={changeView} />}
      {trashed && (
        <p className="muted mb-5">
          Los registros se conservan aquí. Al restaurarlos volverán al listado
          como inactivos.
        </p>
      )}
      <form
        ref={filterRef}
        className="filters"
        onSubmit={filter}
        aria-label={`Buscar ${isRoom ? 'salas' : 'sucursales'}`}
      >
        <Field
          label="Buscar por nombre"
          name="search"
          placeholder={isRoom ? 'Ej. Sala principal' : 'Ej. Local centro'}
        />
        <Field label="Actividad">
          <select name="is_active" disabled={trashed}>
            <option value="">Todas</option>
            <option value="1">Activas</option>
            <option value="0">Inactivas</option>
          </select>
        </Field>
        {isRoom && (
          <>
            <Field label="Sucursal">
              <select name="branch_id">
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estado de la sala">
              <select name="operational_status">
                <option value="">Todos los estados</option>
                {Object.entries(statuses).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <div className="filter-actions">
          <button className="secondary">Buscar</button>
          {hasFilters && (
            <button
              type="button"
              className="text-button"
              onClick={resetFilters}
            >
              Quitar filtros
            </button>
          )}
        </div>
      </form>
      {loading ? (
        <Loading>Cargando {isRoom ? 'salas' : 'sucursales'}…</Loading>
      ) : (
        !error && (
          <div className="card table-wrap">
            <table className="responsive-table">
              <caption className="sr-only">
                {isRoom
                  ? 'Salas de tu establecimiento'
                  : 'Sucursales de tu establecimiento'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">{isRoom ? 'Sucursal' : 'Dirección'}</th>
                  {isRoom && (
                    <>
                      <th scope="col">Capacidad</th>
                      <th scope="col">Estado de la sala</th>
                    </>
                  )}
                  <th scope="col">Actividad</th>
                  {canManage && <th scope="col">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {result?.data.map((record) => (
                  <tr key={record.id}>
                    <td data-label="Nombre" className="record-name">
                      {record.name}
                    </td>
                    <td data-label={isRoom ? 'Sucursal' : 'Dirección'}>
                      {isRoom
                        ? record.branch?.name
                        : record.address || 'Sin dirección registrada'}
                    </td>
                    {isRoom && (
                      <>
                        <td data-label="Capacidad">
                          {record.capacity} personas
                        </td>
                        <td data-label="Estado">
                          {statuses[record.operational_status]}
                        </td>
                      </>
                    )}
                    <td data-label="Actividad">
                      <Status
                        active={record.is_active}
                        inactiveLabel={trashed ? 'En papelera' : 'Inactivo'}
                      />
                    </td>
                    {canManage && (
                      <td data-label="Acciones" className="actions-cell">
                        <div className="row-actions">
                          {!trashed && (
                            <button
                              type="button"
                              className="secondary"
                              aria-label={`Editar ${record.name}`}
                              onClick={() => openForm(record)}
                            >
                              Editar
                            </button>
                          )}
                          <RecordActions
                            resource={kind}
                            record={record}
                            onChanged={changed}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!result?.data.length && (
              <EmptyState
                title={
                  trashed
                    ? 'La papelera está vacía'
                    : hasFilters
                      ? 'No encontramos coincidencias'
                      : `Todavía no hay ${isRoom ? 'salas' : 'sucursales'}`
                }
                description={
                  trashed
                    ? 'Aquí aparecerán los registros que elimines. Su información se conserva para poder restaurarlos.'
                    : hasFilters
                      ? 'Prueba con otro nombre o quita los filtros para ver todos los registros.'
                      : isRoom
                        ? 'Crea tu primera sala e indica su sucursal y capacidad.'
                        : 'Agrega la ubicación de tu bar para empezar a organizar sus salas.'
                }
              >
                {hasFilters ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={resetFilters}
                  >
                    Quitar filtros
                  </button>
                ) : (
                  canManage &&
                  !trashed &&
                  canCreate && (
                    <button onClick={() => openForm()}>
                      Crear primera {label}
                    </button>
                  )
                )}
              </EmptyState>
            )}
          </div>
        )
      )}
      {!error && (
        <Pagination
          meta={result?.meta}
          disabled={loading}
          onPage={(value) => {
            setLoading(true)
            setPage(value)
          }}
        />
      )}
      {editing && (
        <Modal
          title={`${editing.id ? 'Editar' : 'Crear'} ${label}`}
          description="Los campos con * son obligatorios. Puedes cancelar sin guardar los cambios."
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <Alert error={formError} />
          <form onSubmit={save} aria-busy={busy}>
            <Field
              label="Nombre"
              name="name"
              defaultValue={editing.name || ''}
              required
              maxLength={255}
              hint={
                isRoom
                  ? 'El nombre que usará tu equipo, por ejemplo: Sala principal.'
                  : 'Un nombre fácil de reconocer, por ejemplo: Local centro.'
              }
              error={fields.name}
            />
            {isRoom ? (
              <>
                <Field
                  label="Sucursal"
                  hint="Elige una sucursal activa de tu negocio. Cambiarla conserva el historial de precios de la sala."
                  error={fields.branch_id}
                >
                  <select
                    name="branch_id"
                    defaultValue={editing.branch_id || ''}
                    required
                  >
                    <option value="" disabled>
                      Seleccionar sucursal
                    </option>
                    {branches
                      .filter(
                        (branch) =>
                          branch.is_active || branch.id === editing.branch_id,
                      )
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                          {!branch.is_active ? ' (inactiva)' : ''}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Descripción" optional error={fields.description}>
                  <textarea
                    name="description"
                    defaultValue={editing.description || ''}
                    maxLength={5000}
                    placeholder="Ej. Sala con sofá y mesa central"
                  />
                </Field>
                <Field
                  label="Capacidad"
                  name="capacity"
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  defaultValue={editing.capacity || 1}
                  required
                  hint="Número máximo de personas que pueden usar la sala."
                  error={fields.capacity}
                />
                <Field
                  label="Estado de la sala"
                  hint="Usa limpieza o mantenimiento cuando la sala todavía no esté lista."
                  error={fields.operational_status}
                >
                  <select
                    name="operational_status"
                    defaultValue={editing.operational_status || 'available'}
                  >
                    {Object.entries(statuses).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <Field
                label="Dirección"
                optional
                hint="Puedes agregarla ahora o completar este dato después."
                error={fields.address}
              >
                <textarea
                  name="address"
                  defaultValue={editing.address || ''}
                  maxLength={2000}
                  placeholder="Calle, número y una referencia"
                />
              </Field>
            )}
            <FormActions
              busy={busy}
              onCancel={() => setEditing(null)}
              label={editing.id ? 'Guardar cambios' : `Crear ${label}`}
            />
          </form>
        </Modal>
      )}
    </>
  )
}
